import { fetchJson, toNum } from './http';
import {
  normalizeInstrumentType,
  type ProviderAsset,
  type ProviderQuote,
  type QuoteProvider,
} from './types';

const BASE = 'https://data912.com/live';

/** Paneles por tipo de instrumento normalizado. */
const PANELS_BY_TYPE: Record<string, string[]> = {
  cedear: ['arg_cedears'],
  accion: ['arg_stocks'],
  bono: ['arg_bonds', 'arg_notes', 'arg_corp'],
  letra: ['arg_notes'],
  on: ['arg_corp'],
  'accion us': ['usa_stocks', 'usa_adrs'],
};

const USD_PANELS = new Set(['usa_stocks', 'usa_adrs']);

interface PanelItem {
  symbol?: string;
  ticker?: string;
  c?: number | string;
  price?: number | string;
  last?: number | string;
  px_ask?: number | string;
  px_bid?: number | string;
  pct_change?: number | string;
  change?: number | string;
}

function parseItem(item: PanelItem): { symbol: string; price: number; changePct?: number } | null {
  const symbol = item.symbol ?? item.ticker;
  const price = toNum(item.c) ?? toNum(item.price) ?? toNum(item.last);
  if (!symbol || price === undefined || price <= 0) return null;
  const changePct = toNum(item.pct_change) ?? toNum(item.change);
  return { symbol: String(symbol).toUpperCase(), price, changePct };
}

/**
 * data912: un GET al panel devuelve todo el mercado → una sola llamada cubre
 * todos los activos del panel (doc 03 §2). Cache CDN ~2h del lado del proveedor.
 */
export const data912Provider: QuoteProvider = {
  id: 'data912',

  supports(asset: ProviderAsset): boolean {
    const type = normalizeInstrumentType(asset.instrumentTypeName);
    return Boolean(asset.providerSymbols.data912) || type in PANELS_BY_TYPE;
  },

  async getQuotes(assets: ProviderAsset[]): Promise<Map<string, ProviderQuote>> {
    const panels = new Set<string>();
    for (const asset of assets) {
      const type = normalizeInstrumentType(asset.instrumentTypeName);
      for (const p of PANELS_BY_TYPE[type] ?? ['arg_cedears', 'arg_stocks']) panels.add(p);
    }

    // symbol → { price, changePct, currency }
    const bySymbol = new Map<string, ProviderQuote>();
    await Promise.all(
      [...panels].map(async (panel) => {
        try {
          const items = await fetchJson<PanelItem[]>(`${BASE}/${panel}`);
          if (!Array.isArray(items)) return;
          const currency = USD_PANELS.has(panel) ? 'USD' : 'ARS';
          for (const item of items) {
            const parsed = parseItem(item);
            if (parsed && !bySymbol.has(parsed.symbol)) {
              bySymbol.set(parsed.symbol, {
                price: parsed.price,
                currency,
                changePct: parsed.changePct,
              });
            }
          }
        } catch {
          // panel caído: los activos que dependían de él quedan para el fallback
        }
      }),
    );

    const result = new Map<string, ProviderQuote>();
    for (const asset of assets) {
      const symbol = (asset.providerSymbols.data912 ?? asset.ticker).toUpperCase();
      const quote = bySymbol.get(symbol);
      if (quote) result.set(asset.id, quote);
    }
    return result;
  },
};

/** FX de data912 como fallback de DolarApi. */
export async function data912Fx(kind: 'ccl' | 'mep'): Promise<number | null> {
  try {
    const data = await fetchJson<unknown>(`${BASE}/${kind}`);
    if (Array.isArray(data)) {
      for (const item of data) {
        const v = toNum((item as PanelItem).c) ?? toNum((item as PanelItem).price);
        if (v && v > 0) return v;
      }
      return null;
    }
    if (data && typeof data === 'object') {
      const v = toNum((data as PanelItem).price) ?? toNum((data as PanelItem).c);
      return v && v > 0 ? v : null;
    }
    return null;
  } catch {
    return null;
  }
}
