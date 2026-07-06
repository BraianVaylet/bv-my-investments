import { fetchJson, toNum } from './http';
import {
  normalizeInstrumentType,
  type ProviderAsset,
  type ProviderQuote,
  type QuoteProvider,
} from './types';

const BASE = 'https://criptoya.com/api';

/** Exchanges preferidos para valuar (donde opera el usuario, doc 03 §2). */
const PREFERRED_EXCHANGES = ['lemoncash', 'lemoncashp2p', 'binance', 'binancep2p', 'ripio'];

/**
 * CriptoYa: precio por exchange argentino en ARS. Una request por moneda
 * (la API es por coin), solo se usa como último fallback de cripto.
 */
export const criptoyaProvider: QuoteProvider = {
  id: 'criptoya',

  supports(asset: ProviderAsset): boolean {
    return (
      Boolean(asset.providerSymbols.criptoya) ||
      normalizeInstrumentType(asset.instrumentTypeName) === 'cripto'
    );
  },

  async getQuotes(assets: ProviderAsset[]): Promise<Map<string, ProviderQuote>> {
    const result = new Map<string, ProviderQuote>();
    await Promise.all(
      assets.map(async (asset) => {
        const coin = (asset.providerSymbols.criptoya ?? asset.ticker).toLowerCase();
        try {
          const data = await fetchJson<
            Record<string, { ask?: number; bid?: number; totalAsk?: number; totalBid?: number }>
          >(`${BASE}/${coin}/ars/1`);
          if (!data || typeof data !== 'object') return;
          const exchange = PREFERRED_EXCHANGES.find((e) => data[e]) ?? Object.keys(data)[0];
          if (!exchange) return;
          const q = data[exchange];
          const ask = toNum(q?.totalAsk) ?? toNum(q?.ask);
          const bid = toNum(q?.totalBid) ?? toNum(q?.bid);
          const price = ask && bid ? (ask + bid) / 2 : (ask ?? bid);
          if (price && price > 0) result.set(asset.id, { price, currency: 'ARS' });
        } catch {
          // sin dato para esta coin
        }
      }),
    );
    return result;
  },
};
