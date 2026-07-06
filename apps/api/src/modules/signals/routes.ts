import type { FastifyInstance } from 'fastify';
import { round2, UNIT_EPS } from '../../core/money';
import { getSettings } from '../../models/settings.model';
import { loadPortfolio } from '../portfolio/service';

interface Signal {
  kind: 'buy' | 'sell' | 'near-52w-low' | 'near-52w-high' | 'daily-move';
  assetId: string;
  ticker: string;
  message: string;
  value?: number;
}

/**
 * RF-8: señales informativas (sin recomendación financiera).
 * Comparaciones precio vs PPC en la misma moneda: si difieren, se omite la señal
 * (mejor silencio que una señal falsa por moneda cruzada).
 */
export async function signalsRoutes(app: FastifyInstance) {
  app.get('/signals', async () => {
    const settings = await getSettings();
    const data = await loadPortfolio();
    const signals: Signal[] = [];

    for (const r of data.raw) {
      if (r.state.units <= UNIT_EPS || !r.quote) continue;
      const { asset, state, quote } = r;
      const base = { assetId: asset.id as string, ticker: asset.ticker as string };
      const sameCurrency = quote.currency === r.opCurrencyCode;

      // RF-8.1: comprar si precio actual < PPC
      if (sameCurrency && state.avgCost > 0 && quote.price < state.avgCost) {
        const pct = ((state.avgCost - quote.price) / state.avgCost) * 100;
        signals.push({
          ...base,
          kind: 'buy',
          value: round2(pct),
          message: `Precio ${round2(pct)}% debajo de tu PPC`,
        });
      }

      // RF-8.2: vender si rendimiento no realizado > umbral
      if (sameCurrency && state.avgCost > 0) {
        const pct = ((quote.price - state.avgCost) / state.avgCost) * 100;
        if (pct > settings.sellSignalPct) {
          signals.push({
            ...base,
            kind: 'sell',
            value: round2(pct),
            message: `Rendimiento no realizado +${round2(pct)}% (umbral ${settings.sellSignalPct}%)`,
          });
        }
      }

      // RF-8.3: cercanía a extremos de 52 semanas
      if (quote.low52 && quote.low52 > 0) {
        const pct = ((quote.price - quote.low52) / quote.low52) * 100;
        if (pct >= 0 && pct <= settings.near52wPct) {
          signals.push({
            ...base,
            kind: 'near-52w-low',
            value: round2(pct),
            message: `A ${round2(pct)}% del mínimo de 52 semanas`,
          });
        }
      }
      if (quote.high52 && quote.high52 > 0) {
        const pct = ((quote.high52 - quote.price) / quote.high52) * 100;
        if (pct >= 0 && pct <= settings.near52wPct) {
          signals.push({
            ...base,
            kind: 'near-52w-high',
            value: round2(pct),
            message: `A ${round2(pct)}% del máximo de 52 semanas`,
          });
        }
      }

      // RF-8.3: variación diaria fuerte
      if (quote.changePct !== undefined && Math.abs(quote.changePct) >= settings.dailyMovePct) {
        signals.push({
          ...base,
          kind: 'daily-move',
          value: round2(quote.changePct),
          message: `Variación diaria ${quote.changePct > 0 ? '+' : ''}${round2(quote.changePct)}%`,
        });
      }
    }

    return signals;
  });
}
