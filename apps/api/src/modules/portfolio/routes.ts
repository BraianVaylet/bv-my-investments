import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { round2, round8, UNIT_EPS } from '../../core/money';
import { Snapshot } from '../../models/snapshot.model';
import { getSettings } from '../../models/settings.model';
import { loadPortfolio, positionToDTO, summaryFromRaw } from './service';

const currencyQuery = z.object({ currency: z.enum(['ARS', 'USD']).optional() });

async function resolveDisplay(currency?: 'ARS' | 'USD') {
  if (currency) return currency;
  const settings = await getSettings();
  return settings.defaultDisplayCurrency;
}

export async function portfolioRoutes(app: FastifyInstance) {
  app.get('/portfolio', async (request) => {
    const { currency } = currencyQuery.parse(request.query);
    const display = await resolveDisplay(currency);
    const data = await loadPortfolio();
    const fxValue = data.fx?.value ?? null;
    const positions = data.raw
      .filter((r) => r.state.units > UNIT_EPS)
      .map((r) => positionToDTO(r, display, fxValue))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return { currency: display, positions, fx: summaryFromRaw(data, display).fx };
  });

  app.get('/portfolio/summary', async (request) => {
    const { currency } = currencyQuery.parse(request.query);
    const display = await resolveDisplay(currency);
    const data = await loadPortfolio();
    return summaryFromRaw(data, display);
  });

  app.get('/portfolio/closed', async (request) => {
    const { currency } = currencyQuery.parse(request.query);
    const display = await resolveDisplay(currency);
    const data = await loadPortfolio();
    const fxValue = data.fx?.value ?? null;
    return data.raw
      .filter((r) => r.state.units <= UNIT_EPS && r.state.totalBought > 0)
      .map((r) => {
        const dto = positionToDTO(r, display, fxValue);
        return {
          assetId: dto.assetId,
          ticker: dto.ticker,
          name: dto.name,
          instrumentTypeName: dto.instrumentTypeName,
          totalBought: round8(r.state.totalBought),
          totalSold: round8(r.state.totalSold),
          realized: dto.realized,
          opCurrency: dto.opCurrency,
        };
      })
      .sort((a, b) => b.realized - a.realized);
  });

  app.get('/portfolio/history', async (request) => {
    const q = z
      .object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() })
      .parse(request.query);
    const filter: Record<string, unknown> = {};
    if (q.from || q.to) {
      filter.date = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
    }
    const snapshots = await Snapshot.find(filter).sort({ date: 1 });
    return snapshots.map((s) => ({
      date: s.date.toISOString().slice(0, 10),
      valueARS: round2(s.totals.valueARS),
      valueUSD: round2(s.totals.valueUSD),
      invested: round2(s.totals.invested),
      realized: round2(s.totals.realized),
      unrealized: round2(s.totals.unrealized),
      fx: s.fx,
    }));
  });
}
