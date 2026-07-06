import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { round2, UNIT_EPS } from '../../core/money';
import { convert, loadPortfolio } from '../portfolio/service';
import { Currency, Platform } from '../../models/masters.model';
import { Operation } from '../../models/operation.model';
import { getSettings } from '../../models/settings.model';
import { getFx } from '../quotes/fx';
import { replay } from '../../core/position';

const currencyQuery = z.object({ currency: z.enum(['ARS', 'USD']).optional() });

async function resolveDisplay(currency?: 'ARS' | 'USD') {
  if (currency) return currency;
  return (await getSettings()).defaultDisplayCurrency;
}

export async function statsRoutes(app: FastifyInstance) {
  /**
   * RF-7.2: invertido / vendido / resultado por mes.
   * Conversión a la moneda pedida con el FX actual (v1; FX histórico queda para F+).
   */
  app.get('/stats/monthly', async (request) => {
    const { currency } = currencyQuery.parse(request.query);
    const display = await resolveDisplay(currency);
    const settings = await getSettings();
    const fx = await getFx(settings.fxKind);
    const fxValue = fx?.value ?? null;

    const [ops, currencies] = await Promise.all([
      Operation.find().select('type assetId units unitPrice currencyId date createdAt'),
      Currency.find(),
    ]);
    const codeById = new Map(currencies.map((c) => [c.id, c.code]));

    // realizado por venta: replay por activo (RB-06)
    const opsByAsset = new Map<string, typeof ops>();
    for (const op of ops) {
      const key = String(op.assetId);
      (opsByAsset.get(key) ?? opsByAsset.set(key, []).get(key)!).push(op);
    }
    const realizedByOp = new Map<string, number>();
    for (const assetOps of opsByAsset.values()) {
      try {
        const state = replay(
          assetOps.map((o) => ({
            id: o.id,
            type: o.type,
            units: o.units,
            unitPrice: o.unitPrice,
            date: o.date,
            createdAt: o.createdAt,
          })),
        );
        for (const ev of state.sellEvents) realizedByOp.set(ev.opId, ev.realized);
      } catch {
        // set inconsistente: se omite
      }
    }

    const months = new Map<string, { invested: number; sold: number; result: number }>();
    for (const op of ops) {
      const month = op.date.toISOString().slice(0, 7);
      const entry = months.get(month) ?? { invested: 0, sold: 0, result: 0 };
      const code = codeById.get(String(op.currencyId)) ?? 'ARS';
      const total = convert(op.units * op.unitPrice, code, display, fxValue);
      if (total !== null) {
        if (op.type === 'buy') entry.invested += total;
        else entry.sold += total;
      }
      if (op.type === 'sell') {
        const realized = realizedByOp.get(op.id);
        if (realized !== undefined) {
          const converted = convert(realized, code, display, fxValue);
          if (converted !== null) entry.result += converted;
        }
      }
      months.set(month, entry);
    }

    return [...months.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, e]) => ({
        month,
        invested: round2(e.invested),
        sold: round2(e.sold),
        result: round2(e.result),
      }));
  });

  /** RF-7.1: distribución del valor actual por tipo de instrumento / plataforma / moneda. */
  app.get('/stats/allocation', async (request) => {
    const { currency } = currencyQuery.parse(request.query);
    const display = await resolveDisplay(currency);
    const data = await loadPortfolio();
    const fxValue = data.fx?.value ?? null;
    const platforms = await Platform.find();
    const platformName = new Map(platforms.map((p) => [p.id, p.name]));

    const byType = new Map<string, number>();
    const byPlatform = new Map<string, number>();
    const byCurrency = new Map<string, number>();
    let total = 0;

    for (const r of data.raw) {
      if (r.state.units <= UNIT_EPS || !r.quote) continue;
      const value = convert(r.state.units * r.quote.price, r.quote.currency, display, fxValue);
      if (value === null || value <= 0) continue;
      total += value;

      const typeName = r.asset.instrumentTypeId?.name ?? 'Sin tipo';
      byType.set(typeName, (byType.get(typeName) ?? 0) + value);
      byCurrency.set(r.opCurrencyCode, (byCurrency.get(r.opCurrencyCode) ?? 0) + value);

      // unidades netas por plataforma → valor proporcional (clamp de negativos)
      const entries = Object.entries(r.state.unitsByPlatform).filter(([, u]) => u > UNIT_EPS);
      const totalUnits = entries.reduce((acc, [, u]) => acc + u, 0);
      if (totalUnits > 0) {
        for (const [platformId, units] of entries) {
          const name = platformName.get(platformId) ?? 'Otra';
          byPlatform.set(name, (byPlatform.get(name) ?? 0) + (value * units) / totalUnits);
        }
      }
    }

    const toSlices = (m: Map<string, number>) =>
      [...m.entries()]
        .map(([label, value]) => ({
          label,
          value: round2(value),
          pct: total > 0 ? round2((value / total) * 100) : 0,
        }))
        .sort((a, b) => b.value - a.value);

    return {
      currency: display,
      byInstrumentType: toSlices(byType),
      byPlatform: toSlices(byPlatform),
      byCurrency: toSlices(byCurrency),
    };
  });
}
