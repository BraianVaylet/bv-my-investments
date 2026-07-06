import { config } from '../config';
import { fetchJson, toNum } from './http';
import {
  normalizeInstrumentType,
  type ProviderAsset,
  type ProviderQuote,
  type QuoteProvider,
} from './types';

const BASE = 'https://api.coingecko.com/api/v3';

/** CoinGecko: `simple/price` acepta múltiples ids → 1 request para toda la cartera cripto. */
export const coingeckoProvider: QuoteProvider = {
  id: 'coingecko',

  supports(asset: ProviderAsset): boolean {
    return (
      Boolean(asset.providerSymbols.coingecko) ||
      normalizeInstrumentType(asset.instrumentTypeName) === 'cripto'
    );
  },

  async getQuotes(assets: ProviderAsset[]): Promise<Map<string, ProviderQuote>> {
    const idByAsset = new Map<string, string>();
    for (const asset of assets) {
      idByAsset.set(asset.id, asset.providerSymbols.coingecko ?? asset.ticker.toLowerCase());
    }
    const ids = [...new Set(idByAsset.values())].join(',');
    const headers: Record<string, string> = {};
    if (config.coingeckoKey) headers['x-cg-demo-api-key'] = config.coingeckoKey;

    const data = await fetchJson<Record<string, Record<string, number>>>(
      `${BASE}/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`,
      { headers },
    );

    const result = new Map<string, ProviderQuote>();
    for (const [assetId, cgId] of idByAsset) {
      const entry = data[cgId];
      const price = entry ? toNum(entry.usd) : undefined;
      if (price && price > 0) {
        result.set(assetId, { price, currency: 'USD', changePct: toNum(entry!.usd_24h_change) });
      }
    }
    return result;
  },
};
