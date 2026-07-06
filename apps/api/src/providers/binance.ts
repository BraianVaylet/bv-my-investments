import { fetchJson, toNum } from './http';
import {
  normalizeInstrumentType,
  type ProviderAsset,
  type ProviderQuote,
  type QuoteProvider,
} from './types';

const BASE = 'https://api.binance.com/api/v3';

interface Ticker24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
}

/** Binance pública: fallback de CoinGecko para pares que listan (BTCUSDT, etc.). */
export const binanceProvider: QuoteProvider = {
  id: 'binance',

  supports(asset: ProviderAsset): boolean {
    return (
      Boolean(asset.providerSymbols.binance) ||
      normalizeInstrumentType(asset.instrumentTypeName) === 'cripto'
    );
  },

  async getQuotes(assets: ProviderAsset[]): Promise<Map<string, ProviderQuote>> {
    const symbolByAsset = new Map<string, string>();
    for (const asset of assets) {
      symbolByAsset.set(
        asset.id,
        (asset.providerSymbols.binance ?? `${asset.ticker}USDT`).toUpperCase(),
      );
    }
    const symbols = JSON.stringify([...new Set(symbolByAsset.values())]);
    // Si algún símbolo no existe la API devuelve 400 para todo el batch:
    // se pide de a uno solo si el batch falla.
    let tickers: Ticker24h[];
    try {
      tickers = await fetchJson<Ticker24h[]>(
        `${BASE}/ticker/24hr?symbols=${encodeURIComponent(symbols)}`,
      );
    } catch {
      const settled = await Promise.allSettled(
        [...new Set(symbolByAsset.values())].map((s) =>
          fetchJson<Ticker24h>(`${BASE}/ticker/24hr?symbol=${s}`),
        ),
      );
      tickers = settled
        .filter((r): r is PromiseFulfilledResult<Ticker24h> => r.status === 'fulfilled')
        .map((r) => r.value);
    }

    const bySymbol = new Map(tickers.map((t) => [t.symbol, t]));
    const result = new Map<string, ProviderQuote>();
    for (const [assetId, symbol] of symbolByAsset) {
      const t = bySymbol.get(symbol);
      const price = t ? toNum(t.lastPrice) : undefined;
      if (price && price > 0) {
        result.set(assetId, { price, currency: 'USD', changePct: toNum(t!.priceChangePercent) });
      }
    }
    return result;
  },
};
