import type { FastifyInstance } from 'fastify';
import { round2, UNIT_EPS } from '../../core/money';
import { getSettings } from '../../models/settings.model';
import { SignalRule, type SignalRuleDoc } from '../../models/signalRule.model';
import { convert, loadPortfolio, type PortfolioData, type RawPosition } from '../portfolio/service';

interface Signal {
  kind: 'buy' | 'sell' | 'near-52w-low' | 'near-52w-high' | 'daily-move' | 'custom';
  nature?: 'buy' | 'sell';
  ruleName?: string;
  description?: string;
  assetId: string;
  ticker: string;
  message: string;
  value?: number;
}

/**
 * Evalúa las reglas de señal configurables sobre las posiciones cargadas.
 * - percent: rendimiento no realizado vs PPC (%) — requiere posición con PPC
 *   y cotización en la misma moneda de operación.
 * - price: precio actual comparado en la moneda de la regla (convierte con FX).
 */
function evaluateRules(rules: (SignalRuleDoc & { id: string })[], data: PortfolioData): Signal[] {
  const signals: Signal[] = [];
  const fxValue = data.fx?.value ?? null;
  const open = data.raw.filter((r) => r.state.units > UNIT_EPS && r.quote);

  const evaluate = (rule: SignalRuleDoc & { id: string }, r: RawPosition) => {
    const quote = r.quote!;
    let current: number | null;
    let unit: string;
    if (rule.thresholdType === 'percent') {
      if (r.state.avgCost <= 0 || quote.currency !== r.opCurrencyCode) return;
      current = ((quote.price - r.state.avgCost) / r.state.avgCost) * 100;
      unit = '%';
    } else {
      current = convert(quote.price, quote.currency, rule.currency ?? 'ARS', fxValue);
      unit = ` ${rule.currency ?? 'ARS'}`;
    }
    if (current === null) return;
    const fired = rule.direction === 'above' ? current > rule.value : current < rule.value;
    if (!fired) return;
    signals.push({
      kind: 'custom',
      nature: rule.nature,
      ruleName: rule.name,
      description: rule.description ?? undefined,
      assetId: r.asset.id,
      ticker: r.asset.ticker,
      value: round2(current),
      message:
        rule.thresholdType === 'percent'
          ? `Rendimiento ${round2(current)}% ${rule.direction === 'above' ? 'supera' : 'debajo de'} ${rule.value}%`
          : `Precio ${round2(current)}${unit} ${rule.direction === 'above' ? 'supera' : 'debajo de'} ${rule.value}${unit}`,
    });
  };

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.scope === 'asset') {
      const target = open.find((r) => r.asset.id === String(rule.assetId));
      if (target) evaluate(rule, target);
    } else {
      for (const r of open) evaluate(rule, r);
    }
  }
  return signals;
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
    const rules = await SignalRule.find({ enabled: true });
    const signals: Signal[] = evaluateRules(rules as any, data);

    for (const r of data.raw) {
      if (r.state.units <= UNIT_EPS || !r.quote) continue;
      const { asset, state, quote } = r;
      const base = { assetId: asset.id as string, ticker: asset.ticker as string };
      const sameCurrency = quote.currency === r.opCurrencyCode;

      // RF-8.1: comprar si precio actual < PPC
      if (settings.buySignalEnabled && sameCurrency && state.avgCost > 0 && quote.price < state.avgCost) {
        const pct = ((state.avgCost - quote.price) / state.avgCost) * 100;
        signals.push({
          ...base,
          kind: 'buy',
          value: round2(pct),
          message: `Precio ${round2(pct)}% debajo de tu PPC`,
        });
      }

      // RF-8.2: vender si rendimiento no realizado > umbral
      if (settings.sellSignalEnabled && sameCurrency && state.avgCost > 0) {
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
      if (settings.near52wEnabled && quote.low52 && quote.low52 > 0) {
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
      if (settings.near52wEnabled && quote.high52 && quote.high52 > 0) {
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
      if (
        settings.dailyMoveEnabled &&
        quote.changePct !== undefined &&
        Math.abs(quote.changePct) >= settings.dailyMovePct
      ) {
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
