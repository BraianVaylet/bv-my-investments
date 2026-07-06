import { afterEach, describe, expect, it, vi } from 'vitest';
import { binanceProvider } from './binance';
import { coingeckoProvider } from './coingecko';
import { data912Provider } from './data912';
import { dolarApiFx } from './dolarapi';
import { yahooProvider } from './yahoo';
import type { ProviderAsset } from './types';

/** Fixtures con la forma real de cada API (doc 03). fetch mockeado por URL. */
function mockFetch(routes: Record<string, unknown | Error>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) return new Response('not found', { status: 404 });
    const value = routes[key];
    if (value instanceof Error) throw value;
    return new Response(JSON.stringify(value), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}

function asset(partial: Partial<ProviderAsset>): ProviderAsset {
  return {
    id: 'a1',
    ticker: 'TEST',
    name: 'Test',
    instrumentTypeName: 'Cripto',
    quoteCurrencyCode: 'USD',
    providerSymbols: {},
    ...partial,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('data912', () => {
  it('parsea el panel de CEDEARs (una llamada cubre todos los tickers)', async () => {
    const spy = mockFetch({
      '/live/arg_cedears': [
        { symbol: 'AMZN', c: 25000.5, pct_change: 1.2, q_bid: 1, q_ask: 2 },
        { symbol: 'GOOGL', c: 18000, pct_change: -0.8 },
      ],
    });
    const quotes = await data912Provider.getQuotes([
      asset({ id: 'amzn', ticker: 'AMZN', instrumentTypeName: 'CEDEAR' }),
      asset({ id: 'googl', ticker: 'GOOGL', instrumentTypeName: 'CEDEAR' }),
    ]);
    expect(quotes.get('amzn')).toEqual({ price: 25000.5, currency: 'ARS', changePct: 1.2 });
    expect(quotes.get('googl')?.price).toBe(18000);
    expect(spy).toHaveBeenCalledTimes(1); // batch: un GET para ambos
  });

  it('panel caído no rompe: devuelve mapa sin esos activos', async () => {
    mockFetch({ '/live/arg_cedears': new Error('ECONNREFUSED') });
    const quotes = await data912Provider.getQuotes([
      asset({ id: 'amzn', ticker: 'AMZN', instrumentTypeName: 'CEDEAR' }),
    ]);
    expect(quotes.size).toBe(0);
  });

  it('usa providerSymbols.data912 si difiere del ticker', async () => {
    mockFetch({ '/live/arg_stocks': [{ symbol: 'GGAL', c: 5000 }] });
    const quotes = await data912Provider.getQuotes([
      asset({
        id: 'g',
        ticker: 'GALICIA',
        instrumentTypeName: 'Acción',
        providerSymbols: { data912: 'GGAL' },
      }),
    ]);
    expect(quotes.get('g')?.price).toBe(5000);
  });
});

describe('coingecko', () => {
  it('parsea simple/price con múltiples ids en una llamada', async () => {
    const spy = mockFetch({
      '/simple/price': {
        bitcoin: { usd: 63792, usd_24h_change: 1.64 },
        ethereum: { usd: 3200, usd_24h_change: -2.1 },
      },
    });
    const quotes = await coingeckoProvider.getQuotes([
      asset({ id: 'btc', ticker: 'BTC', providerSymbols: { coingecko: 'bitcoin' } }),
      asset({ id: 'eth', ticker: 'ETH', providerSymbols: { coingecko: 'ethereum' } }),
    ]);
    expect(quotes.get('btc')).toEqual({ price: 63792, currency: 'USD', changePct: 1.64 });
    expect(quotes.get('eth')?.price).toBe(3200);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]![0])).toContain('bitcoin%2Cethereum');
  });

  it('id inexistente queda fuera del mapa (sigue la cadena de fallback)', async () => {
    mockFetch({ '/simple/price': {} });
    const quotes = await coingeckoProvider.getQuotes([asset({ id: 'x', ticker: 'XXX' })]);
    expect(quotes.size).toBe(0);
  });
});

describe('binance', () => {
  it('batch OK: parsea ticker/24hr', async () => {
    mockFetch({
      'symbols=': [{ symbol: 'BTCUSDT', lastPrice: '63500.10', priceChangePercent: '2.5' }],
    });
    const quotes = await binanceProvider.getQuotes([asset({ id: 'btc', ticker: 'BTC' })]);
    expect(quotes.get('btc')).toEqual({ price: 63500.1, currency: 'USD', changePct: 2.5 });
  });

  it('batch falla (400 por símbolo inexistente) → reintenta de a uno', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('symbols=')) return new Response('bad symbol', { status: 400 });
      if (url.includes('symbol=BTCUSDT')) {
        return new Response(
          JSON.stringify({ symbol: 'BTCUSDT', lastPrice: '63500', priceChangePercent: '1' }),
          { status: 200 },
        );
      }
      return new Response('bad symbol', { status: 400 });
    });
    const quotes = await binanceProvider.getQuotes([
      asset({ id: 'btc', ticker: 'BTC' }),
      asset({ id: 'weird', ticker: 'WEIRD' }), // no lista en Binance
    ]);
    expect(quotes.get('btc')?.price).toBe(63500);
    expect(quotes.has('weird')).toBe(false);
    expect(spy.mock.calls.length).toBeGreaterThan(1); // batch + individuales
  });
});

describe('dolarapi', () => {
  it('devuelve venta del CCL', async () => {
    mockFetch({ '/dolares/contadoconliqui': { compra: 1550, venta: 1569.6 } });
    expect(await dolarApiFx('ccl')).toBe(1569.6);
  });

  it('caído → null (el caller pasa al fallback)', async () => {
    mockFetch({ '/dolares/bolsa': new Error('timeout') });
    expect(await dolarApiFx('mep')).toBeNull();
  });
});

describe('yahoo', () => {
  it('parsea precio, variación y calcula 52w del histórico si meta no lo trae', async () => {
    mockFetch({
      '/v8/finance/chart/': {
        chart: {
          result: [
            {
              meta: { regularMarketPrice: 100, chartPreviousClose: 95, currency: 'USD' },
              indicators: { quote: [{ high: [90, 120, null, 110], low: [80, 85, null, 95] }] },
            },
          ],
        },
      },
    });
    const quotes = await yahooProvider.getQuotes([
      asset({ id: 'x', ticker: 'XYZ', instrumentTypeName: 'Acción US' }),
    ]);
    const q = quotes.get('x')!;
    expect(q.price).toBe(100);
    expect(q.changePct).toBeCloseTo(((100 - 95) / 95) * 100, 5);
    expect(q.high52).toBe(120);
    expect(q.low52).toBe(80);
  });

  it('tickers BYMA llevan sufijo .BA', async () => {
    const spy = mockFetch({
      '/v8/finance/chart/': {
        chart: { result: [{ meta: { regularMarketPrice: 1, currency: 'ARS' } }] },
      },
    });
    await yahooProvider.getQuotes([
      asset({ id: 'g', ticker: 'GGAL', instrumentTypeName: 'Acción' }),
    ]);
    expect(String(spy.mock.calls[0]![0])).toContain('GGAL.BA');
  });
});
