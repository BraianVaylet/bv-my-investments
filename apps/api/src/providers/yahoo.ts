import { fetchJson, toNum } from './http';
import {
  normalizeInstrumentType,
  type ProviderAsset,
  type ProviderQuote,
  type QuoteProvider,
} from './types';

const BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

interface YahooChart {
  chart?: {
    result?: {
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        currency?: string;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
      };
      indicators?: { quote?: { high?: (number | null)[]; low?: (number | null)[] }[] };
    }[];
  };
}

function yahooSymbol(asset: ProviderAsset): string {
  if (asset.providerSymbols.yahoo) return asset.providerSymbols.yahoo;
  const type = normalizeInstrumentType(asset.instrumentTypeName);
  // Tickers BYMA en Yahoo llevan sufijo .BA
  if (['cedear', 'accion', 'bono', 'letra', 'on'].includes(type)) return `${asset.ticker}.BA`;
  if (type === 'cripto') return `${asset.ticker}-USD`;
  return asset.ticker;
}

/**
 * Yahoo Finance no oficial (endpoint chart): fallback, nunca primario (doc 03 §2).
 * Trae 52w nativo o se calcula desde el rango 1y del mismo response.
 */
export const yahooProvider: QuoteProvider = {
  id: 'yahoo',

  supports(): boolean {
    return true; // cubre casi todo; su lugar en la cadena lo limita a fallback
  },

  async getQuotes(assets: ProviderAsset[]): Promise<Map<string, ProviderQuote>> {
    const result = new Map<string, ProviderQuote>();
    await Promise.all(
      assets.map(async (asset) => {
        try {
          const data = await fetchJson<YahooChart>(
            `${BASE}/${encodeURIComponent(yahooSymbol(asset))}?range=1y&interval=1d`,
            { headers: { 'user-agent': 'Mozilla/5.0' } },
          );
          const r = data.chart?.result?.[0];
          const meta = r?.meta;
          const price = toNum(meta?.regularMarketPrice);
          if (!price || price <= 0) return;

          let high52 = toNum(meta?.fiftyTwoWeekHigh);
          let low52 = toNum(meta?.fiftyTwoWeekLow);
          const quote = r?.indicators?.quote?.[0];
          if ((high52 === undefined || low52 === undefined) && quote) {
            const highs = (quote.high ?? []).filter((v): v is number => typeof v === 'number');
            const lows = (quote.low ?? []).filter((v): v is number => typeof v === 'number');
            if (highs.length) high52 = Math.max(...highs);
            if (lows.length) low52 = Math.min(...lows);
          }

          const prev = toNum(meta?.chartPreviousClose) ?? toNum(meta?.previousClose);
          const changePct = prev && prev > 0 ? ((price - prev) / prev) * 100 : undefined;
          const currency = meta?.currency === 'ARS' ? 'ARS' : 'USD';
          result.set(asset.id, { price, currency, changePct, high52, low52 });
        } catch {
          // sin dato: sigue la cadena
        }
      }),
    );
    return result;
  },
};
