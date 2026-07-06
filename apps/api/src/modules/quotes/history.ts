import { config } from '../../config';
import { fetchJson, toNum } from '../../providers/http';
import { normalizeInstrumentType, type ProviderAsset } from '../../providers/types';

export interface PricePoint {
  date: string; // YYYY-MM-DD
  price: number;
}

export interface PriceHistory {
  points: PricePoint[];
  provider: string;
  currency: string;
}

function toDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** CoinGecko market_chart: [[ms, price], ...] en USD. */
async function coingeckoHistory(asset: ProviderAsset, days: number): Promise<PriceHistory | null> {
  const id = asset.providerSymbols.coingecko ?? asset.ticker.toLowerCase();
  const headers: Record<string, string> = {};
  if (config.coingeckoKey) headers['x-cg-demo-api-key'] = config.coingeckoKey;
  try {
    const data = await fetchJson<{ prices?: [number, number][] }>(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
      { headers },
    );
    const points = (data.prices ?? [])
      .map(([ms, price]) => ({ date: toDay(ms), price }))
      .filter((p) => Number.isFinite(p.price) && p.price > 0);
    return points.length ? { points, provider: 'coingecko', currency: 'USD' } : null;
  } catch {
    return null;
  }
}

/** Binance klines diarias: [openTime, open, high, low, close, ...]. */
async function binanceHistory(asset: ProviderAsset, days: number): Promise<PriceHistory | null> {
  const symbol = (asset.providerSymbols.binance ?? `${asset.ticker}USDT`).toUpperCase();
  try {
    const data = await fetchJson<unknown[][]>(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=${Math.min(days, 1000)}`,
    );
    const points = data
      .map((k) => ({ date: toDay(Number(k[0])), price: Number(k[4]) }))
      .filter((p) => Number.isFinite(p.price) && p.price > 0);
    return points.length ? { points, provider: 'binance', currency: 'USD' } : null;
  } catch {
    return null;
  }
}

/** data912 histórico OHLC: /historical/{panel}/{ticker} (formato defensivo). */
async function data912History(asset: ProviderAsset): Promise<PriceHistory | null> {
  const type = normalizeInstrumentType(asset.instrumentTypeName);
  const panels: Record<string, string> = {
    cedear: 'arg_cedears',
    accion: 'arg_stocks',
    bono: 'arg_bonds',
    letra: 'arg_notes',
    on: 'arg_corp',
  };
  const panel = panels[type];
  if (!panel) return null;
  const symbol = (asset.providerSymbols.data912 ?? asset.ticker).toUpperCase();
  try {
    const data = await fetchJson<Record<string, unknown>[]>(
      `https://data912.com/historical/${panel}/${encodeURIComponent(symbol)}`,
    );
    if (!Array.isArray(data)) return null;
    const points = data
      .map((row) => {
        const dateRaw = row.date ?? row.d ?? row.time;
        const price = toNum(row.c) ?? toNum(row.close) ?? toNum(row.price);
        if (!dateRaw || !price || price <= 0) return null;
        const date = String(dateRaw).slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(date) ? { date, price } : null;
      })
      .filter((p): p is PricePoint => p !== null);
    return points.length ? { points, provider: 'data912', currency: 'ARS' } : null;
  } catch {
    return null;
  }
}

/** Yahoo chart 1y: timestamps + closes. */
async function yahooHistory(asset: ProviderAsset): Promise<PriceHistory | null> {
  const type = normalizeInstrumentType(asset.instrumentTypeName);
  let symbol = asset.providerSymbols.yahoo;
  if (!symbol) {
    if (['cedear', 'accion', 'bono', 'letra', 'on'].includes(type)) symbol = `${asset.ticker}.BA`;
    else if (type === 'cripto') symbol = `${asset.ticker}-USD`;
    else symbol = asset.ticker;
  }
  try {
    const data = await fetchJson<{
      chart?: {
        result?: {
          meta?: { currency?: string };
          timestamp?: number[];
          indicators?: { quote?: { close?: (number | null)[] }[] };
        }[];
      };
    }>(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`,
      {
        headers: { 'user-agent': 'Mozilla/5.0' },
      },
    );
    const r = data.chart?.result?.[0];
    const timestamps = r?.timestamp ?? [];
    const closes = r?.indicators?.quote?.[0]?.close ?? [];
    const points: PricePoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const price = closes[i];
      if (typeof price === 'number' && price > 0) {
        points.push({ date: toDay(timestamps[i]! * 1000), price });
      }
    }
    const currency = r?.meta?.currency === 'ARS' ? 'ARS' : 'USD';
    return points.length ? { points, provider: 'yahoo', currency } : null;
  } catch {
    return null;
  }
}

/**
 * Histórico de precios para el gráfico del detalle (RF-7.3).
 * Cadena por tipo, mismo criterio que las cotizaciones (doc 03 §1, fila "Histórico OHLC").
 */
export async function getPriceHistory(
  asset: ProviderAsset,
  days = 365,
): Promise<PriceHistory | null> {
  const type = normalizeInstrumentType(asset.instrumentTypeName);
  const chain =
    type === 'cripto'
      ? [
          () => coingeckoHistory(asset, days),
          () => binanceHistory(asset, days),
          () => yahooHistory(asset),
        ]
      : [() => data912History(asset), () => yahooHistory(asset)];
  for (const fetchHistory of chain) {
    const result = await fetchHistory();
    if (result) return result;
  }
  return null;
}
