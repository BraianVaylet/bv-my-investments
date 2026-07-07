import { Types } from 'mongoose';
import { QuoteCache } from '../../models/quoteCache.model';
import { Stat52w } from '../../models/stat52w.model';
import { getPriceHistory } from './history';
import { getSettings } from '../../models/settings.model';
import { argentinaDatosProvider } from '../../providers/argentinadatos';
import { binanceProvider } from '../../providers/binance';
import { coingeckoProvider } from '../../providers/coingecko';
import { criptoyaProvider } from '../../providers/criptoya';
import { data912Provider } from '../../providers/data912';
import { yahooProvider } from '../../providers/yahoo';
import {
  normalizeInstrumentType,
  type ProviderAsset,
  type QuoteProvider,
} from '../../providers/types';

export interface ResolvedQuote {
  price: number;
  currency: string;
  changePct?: number;
  high52?: number;
  low52?: number;
  provider: string;
  fetchedAt: Date;
  stale: boolean;
}

export const ALL_PROVIDERS: QuoteProvider[] = [
  data912Provider,
  coingeckoProvider,
  binanceProvider,
  criptoyaProvider,
  yahooProvider,
  argentinaDatosProvider,
];

const providerById = new Map(ALL_PROVIDERS.map((p) => [p.id, p]));

/** Cadenas default por tipo de instrumento normalizado (doc 03 §3). */
function defaultChain(instrumentTypeName: string): string[] {
  const type = normalizeInstrumentType(instrumentTypeName);
  if (type === 'cripto') return ['coingecko', 'binance', 'criptoya'];
  if (type === 'fci') return ['argentinadatos'];
  if (type === 'accion us') return ['data912', 'yahoo'];
  return ['data912', 'yahoo']; // CEDEAR / Acción / Bono / Letra / default
}

/** TTL: 5 min en horario BYMA (lun-vie 11–17 ART), 60 min fuera (doc 03 §5). */
export function cacheTtlMs(now = new Date()): number {
  const artMillis = now.getTime() - 3 * 60 * 60 * 1000;
  const art = new Date(artMillis);
  const day = art.getUTCDay();
  const hour = art.getUTCHours();
  const marketOpen = day >= 1 && day <= 5 && hour >= 11 && hour < 17;
  return (marketOpen ? 5 : 60) * 60 * 1000;
}

interface GetQuotesOptions {
  force?: boolean;
}

/**
 * QuoteService.get (doc 02 §4):
 * 1) cache fresco → devuelve
 * 2) vencido → proveedor preferido del tipo → siguiente de la cadena
 * 3) todos fallan → último cache con stale: true
 */
export async function getQuotes(
  assets: ProviderAsset[],
  opts: GetQuotesOptions = {},
): Promise<Map<string, ResolvedQuote>> {
  const result = new Map<string, ResolvedQuote>();
  if (assets.length === 0) return result;

  const settings = await getSettings();
  const ttl = cacheTtlMs();
  const now = Date.now();

  const cached = await QuoteCache.find({ assetId: { $in: assets.map((a) => a.id) } }).sort({
    fetchedAt: -1,
  });
  const latestCacheByAsset = new Map<string, (typeof cached)[number]>();
  for (const c of cached) {
    const key = String(c.assetId);
    if (!latestCacheByAsset.has(key)) latestCacheByAsset.set(key, c);
  }

  const pending: ProviderAsset[] = [];
  for (const asset of assets) {
    const c = latestCacheByAsset.get(asset.id);
    if (!opts.force && c && now - c.fetchedAt.getTime() < ttl) {
      result.set(asset.id, {
        price: c.price,
        currency: c.currency,
        changePct: c.changePct ?? undefined,
        high52: c.high52 ?? undefined,
        low52: c.low52 ?? undefined,
        provider: c.provider,
        fetchedAt: c.fetchedAt,
        stale: false,
      });
    } else {
      pending.push(asset);
    }
  }
  if (pending.length === 0) {
    await enrich52w(assets, result);
    return result;
  }

  // Agrupar por cadena de proveedores (preferido del tipo primero)
  const groups = new Map<string, { chain: string[]; assets: ProviderAsset[] }>();
  for (const asset of pending) {
    const chain = [...defaultChain(asset.instrumentTypeName)];
    const preferred =
      settings.preferredProviders.get(asset.instrumentTypeName) ??
      settings.preferredProviders.get(normalizeInstrumentType(asset.instrumentTypeName));
    if (preferred && providerById.has(preferred)) {
      const idx = chain.indexOf(preferred);
      if (idx >= 0) chain.splice(idx, 1);
      chain.unshift(preferred);
    }
    const key = chain.join('>');
    const group = groups.get(key) ?? { chain, assets: [] };
    group.assets.push(asset);
    groups.set(key, group);
  }

  for (const { chain, assets: groupAssets } of groups.values()) {
    let remaining = groupAssets;
    for (const providerId of chain) {
      if (remaining.length === 0) break;
      const provider = providerById.get(providerId);
      if (!provider) continue;
      const supported = remaining.filter((a) => provider.supports(a));
      if (supported.length === 0) continue;
      try {
        const quotes = await provider.getQuotes(supported);
        const fetchedAt = new Date();
        for (const [assetId, q] of quotes) {
          result.set(assetId, { ...q, provider: provider.id, fetchedAt, stale: false });
          await QuoteCache.updateOne(
            { assetId: new Types.ObjectId(assetId), provider: provider.id },
            {
              $set: {
                price: q.price,
                currency: q.currency,
                changePct: q.changePct,
                high52: q.high52,
                low52: q.low52,
                fetchedAt,
              },
            },
            { upsert: true },
          );
        }
        remaining = remaining.filter((a) => !result.has(a.id));
      } catch {
        // proveedor caído: sigue la cadena (RF-6.3)
      }
    }

    // RF-6.4: si ninguna fuente respondió, último cache con advertencia
    for (const asset of remaining) {
      const c = latestCacheByAsset.get(asset.id);
      if (c) {
        result.set(asset.id, {
          price: c.price,
          currency: c.currency,
          changePct: c.changePct ?? undefined,
          high52: c.high52 ?? undefined,
          low52: c.low52 ?? undefined,
          provider: c.provider,
          fetchedAt: c.fetchedAt,
          stale: true,
        });
      }
      // sin cache y sin fuente: el activo queda sin quote (la UI muestra "sin dato")
    }
  }

  await enrich52w(assets, result);
  return result;
}

const STAT_52W_TTL_MS = 24 * 60 * 60 * 1000; // dato lento (doc 03 §3.4)

/**
 * Completa high52/low52 cuando el proveedor no los trae (data912, CoinGecko):
 * los calcula del histórico de precios y cachea 24 h. Solo se aplican si la
 * moneda del histórico coincide con la de la cotización (evita rangos falsos).
 */
async function enrich52w(
  assets: ProviderAsset[],
  result: Map<string, ResolvedQuote>,
): Promise<void> {
  const missing = assets.filter((a) => {
    const q = result.get(a.id);
    return q && (q.high52 === undefined || q.low52 === undefined);
  });
  if (missing.length === 0) return;

  const cached = await Stat52w.find({ assetId: { $in: missing.map((a) => a.id) } });
  const cacheByAsset = new Map(cached.map((c) => [String(c.assetId), c]));

  await Promise.all(
    missing.map(async (asset) => {
      const quote = result.get(asset.id)!;
      const hit = cacheByAsset.get(asset.id);
      if (hit && Date.now() - hit.computedAt.getTime() < STAT_52W_TTL_MS) {
        if (hit.currency === quote.currency) {
          quote.high52 ??= hit.high52;
          quote.low52 ??= hit.low52;
        }
        return;
      }
      const history = await getPriceHistory(asset, 365);
      // menos de ~1 mes de datos no es un rango anual representativo
      if (!history || history.points.length < 30) return;
      const prices = history.points.map((p) => p.price);
      const high52 = Math.max(...prices);
      const low52 = Math.min(...prices);
      await Stat52w.updateOne(
        { assetId: new Types.ObjectId(asset.id) },
        { $set: { high52, low52, currency: history.currency, computedAt: new Date() } },
        { upsert: true },
      );
      if (history.currency === quote.currency) {
        quote.high52 ??= high52;
        quote.low52 ??= low52;
      }
    }),
  );
}

/** Convierte un doc de Asset populado al shape que consumen los providers. */
export function toProviderAsset(doc: any): ProviderAsset {
  const it = doc.instrumentTypeId;
  const cur = doc.quoteCurrencyId;
  const symbols = doc.providerSymbols ?? {};
  return {
    id: doc.id ?? String(doc._id),
    ticker: doc.ticker,
    name: doc.name ?? doc.ticker,
    instrumentTypeName: typeof it === 'object' && it ? it.name : '',
    quoteCurrencyCode: typeof cur === 'object' && cur ? cur.code : 'ARS',
    providerSymbols: typeof symbols.toObject === 'function' ? symbols.toObject() : { ...symbols },
    cedearRatio: doc.cedearRatio ?? null,
  };
}
