/**
 * Backfill de snapshots (F7 opcional): reconstruye la valuación diaria del
 * portafolio hacia atrás para poblar el gráfico de evolución.
 *
 * Uso:
 *   pnpm --filter @bv/api backfill:snapshots -- [--days 365] [--dry-run]
 *
 * - Precios: histórico diario de los proveedores (limitado a ~1 año, doc 03).
 * - FX: histórico CCL de ArgentinaDatos (RB-10: cada snapshot guarda su FX).
 * - No pisa snapshots existentes (el del cron diario manda).
 * - Para cada día toma el último precio/FX disponible hasta esa fecha.
 */
import '../env';
import mongoose from 'mongoose';
import { connectDb } from '../db';
import { round2, round8, UNIT_EPS } from '../core/money';
import { replay, type CorporateEventInput, type ReplayOp } from '../core/position';
import { fetchJson, toNum } from '../providers/http';
import { Asset } from '../models/asset.model';
import { Currency } from '../models/masters.model';
import { CorporateEvent } from '../models/corporateEvent.model';
import { Operation } from '../models/operation.model';
import { Snapshot } from '../models/snapshot.model';
import { getPriceHistory, type PriceHistory } from '../modules/quotes/history';
import { toProviderAsset } from '../modules/quotes/service';

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Serie diaria → lookup del último valor disponible hasta la fecha. */
class DailySeries {
  private dates: string[];
  private values = new Map<string, number>();

  constructor(points: { date: string; value: number }[]) {
    for (const p of points) this.values.set(p.date, p.value);
    this.dates = [...this.values.keys()].sort();
  }

  at(day: string): number | null {
    if (this.values.has(day)) return this.values.get(day)!;
    let candidate: string | null = null;
    for (const d of this.dates) {
      if (d > day) break;
      candidate = d;
    }
    return candidate ? this.values.get(candidate)! : null;
  }

  get first(): string | null {
    return this.dates[0] ?? null;
  }
}

/** Histórico CCL de ArgentinaDatos (fuente del FX por día). */
async function loadFxSeries(): Promise<DailySeries> {
  const data = await fetchJson<{ fecha?: string; venta?: number | string }[]>(
    'https://api.argentinadatos.com/v1/cotizaciones/dolares/contadoconliqui',
    { timeoutMs: 20000 },
  );
  const points = (Array.isArray(data) ? data : [])
    .map((r) => ({ date: String(r.fecha ?? '').slice(0, 10), value: toNum(r.venta) ?? 0 }))
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && p.value > 0);
  return new DailySeries(points.map((p) => ({ date: p.date, value: p.value })));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const daysIdx = args.indexOf('--days');
  const days = daysIdx >= 0 ? Number(args[daysIdx + 1]) : 365;

  await connectDb();

  const [assets, ops, currencies, events] = await Promise.all([
    Asset.find().populate(['instrumentTypeId', 'quoteCurrencyId']),
    Operation.find()
      .select('type assetId units unitPrice currencyId date createdAt')
      .sort({ date: 1 }),
    Currency.find(),
    CorporateEvent.find().select('assetId date factor'),
  ]);
  if (ops.length === 0) {
    console.log('Sin operaciones: nada que reconstruir.');
    await mongoose.disconnect();
    return;
  }

  const codeById = new Map(currencies.map((c) => [c.id, c.code]));
  const opsByAsset = new Map<string, ReplayOp[]>();
  const opCurrencyByAsset = new Map<string, string>();
  for (const op of ops) {
    const key = String(op.assetId);
    const list = opsByAsset.get(key) ?? [];
    list.push({
      id: op.id,
      type: op.type,
      units: op.units,
      unitPrice: op.unitPrice,
      date: op.date,
      createdAt: op.createdAt,
    });
    opsByAsset.set(key, list);
    if (!opCurrencyByAsset.has(key)) {
      opCurrencyByAsset.set(key, codeById.get(String(op.currencyId)) ?? 'ARS');
    }
  }
  const eventsByAsset = new Map<string, CorporateEventInput[]>();
  for (const ev of events) {
    const key = String(ev.assetId);
    const list = eventsByAsset.get(key) ?? [];
    list.push({ id: ev.id, date: ev.date, factor: ev.factor });
    eventsByAsset.set(key, list);
  }

  // Históricos de precio por activo con operaciones
  console.log('Bajando históricos de precios…');
  const priceSeries = new Map<string, { series: DailySeries; currency: string }>();
  for (const asset of assets) {
    if (!opsByAsset.has(asset.id)) continue;
    const history: PriceHistory | null = await getPriceHistory(toProviderAsset(asset), days);
    if (!history) {
      console.warn(`  ! ${asset.ticker}: sin histórico de precios (queda fuera del backfill)`);
      continue;
    }
    priceSeries.set(asset.id, {
      series: new DailySeries(history.points.map((p) => ({ date: p.date, value: p.price }))),
      currency: history.currency,
    });
    console.log(`  ✓ ${asset.ticker}: ${history.points.length} puntos (${history.provider})`);
  }

  console.log('Bajando FX histórico (CCL, ArgentinaDatos)…');
  const fxSeries = await loadFxSeries();
  if (!fxSeries.first) {
    console.error('Sin FX histórico: aborto (las conversiones serían inventadas).');
    process.exit(1);
  }

  const existing = new Set((await Snapshot.find().select('date')).map((s) => dayKey(s.date)));

  const firstOpDay = dayKey(ops[0]!.date);
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  const from = firstOpDay > dayKey(start) ? firstOpDay : dayKey(start);
  const today = dayKey(new Date());

  let created = 0;
  let skipped = 0;
  const cursor = new Date(`${from}T00:00:00Z`);
  const convert = (amount: number, fromCode: string, to: 'ARS' | 'USD', fx: number): number =>
    fromCode === to ? amount : fromCode === 'ARS' ? amount / fx : amount * fx;

  while (dayKey(cursor) < today) {
    const day = dayKey(cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (existing.has(day)) {
      skipped += 1;
      continue;
    }
    const fx = fxSeries.at(day);
    if (fx === null) {
      skipped += 1;
      continue; // antes del primer dato de FX
    }

    const endOfDay = new Date(`${day}T23:59:59Z`);
    let valueARS = 0;
    let valueUSD = 0;
    let investedARS = 0;
    let realizedARS = 0;
    const positions: {
      assetId: mongoose.Types.ObjectId;
      units: number;
      price: number;
      valueARS: number;
      valueUSD: number;
    }[] = [];

    for (const [assetId, assetOps] of opsByAsset) {
      const opsToDate = assetOps.filter((o) => o.date <= endOfDay);
      if (opsToDate.length === 0) continue;
      const eventsToDate = (eventsByAsset.get(assetId) ?? []).filter((e) => e.date <= endOfDay);
      let state;
      try {
        state = replay(opsToDate, eventsToDate);
      } catch {
        continue;
      }
      const opCurrency = opCurrencyByAsset.get(assetId) ?? 'ARS';
      realizedARS += convert(state.realized, opCurrency, 'ARS', fx);
      if (state.units <= UNIT_EPS) continue;
      investedARS += convert(state.invested, opCurrency, 'ARS', fx);

      const priced = priceSeries.get(assetId);
      const price = priced?.series.at(day) ?? null;
      if (priced && price !== null) {
        const vARS = convert(state.units * price, priced.currency, 'ARS', fx);
        const vUSD = convert(state.units * price, priced.currency, 'USD', fx);
        valueARS += vARS;
        valueUSD += vUSD;
        positions.push({
          assetId: new mongoose.Types.ObjectId(assetId),
          units: round8(state.units),
          price,
          valueARS: round2(vARS),
          valueUSD: round2(vUSD),
        });
      }
    }

    if (positions.length === 0) {
      skipped += 1;
      continue;
    }

    if (!dryRun) {
      await Snapshot.updateOne(
        { date: new Date(`${day}T00:00:00Z`) },
        {
          $set: {
            fx: { kind: 'ccl', value: fx },
            totals: {
              valueARS: round2(valueARS),
              valueUSD: round2(valueUSD),
              invested: round2(investedARS),
              realized: round2(realizedARS),
              unrealized: round2(valueARS - investedARS),
            },
            positions,
          },
        },
        { upsert: true },
      );
    }
    created += 1;
  }

  console.log(
    `${dryRun ? '(dry-run) ' : ''}Snapshots reconstruidos: ${created} · omitidos (existentes/sin datos): ${skipped}`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
