import { round2, round8, UNIT_EPS } from '../../core/money';
import { replay, type PositionState } from '../../core/position';
import { Asset } from '../../models/asset.model';
import { Currency } from '../../models/masters.model';
import { Operation } from '../../models/operation.model';
import { getSettings } from '../../models/settings.model';
import { getFx, type ResolvedFx } from '../quotes/fx';
import { getQuotes, toProviderAsset, type ResolvedQuote } from '../quotes/service';

type Display = 'ARS' | 'USD';

/**
 * Conversión ARS⇄USD al dólar vigente (RB-10). Devuelve null si falta FX
 * y las monedas difieren: mejor "sin dato" que un número mentiroso.
 */
export function convert(
  amount: number,
  from: string,
  to: Display,
  fxValue: number | null,
): number | null {
  if (from === to) return amount;
  if (fxValue === null || fxValue <= 0) return null;
  if (from === 'ARS' && to === 'USD') return amount / fxValue;
  if (from === 'USD' && to === 'ARS') return amount * fxValue;
  return null; // moneda no soportada para conversión
}

export interface RawPosition {
  asset: any; // doc populado (instrumentTypeId, quoteCurrencyId)
  state: PositionState;
  opCurrencyCode: string;
  quote: ResolvedQuote | null;
}

export interface PortfolioData {
  raw: RawPosition[];
  fx: ResolvedFx | null;
  fxKind: 'ccl' | 'mep' | 'oficial';
}

function quoteToDTO(quote: ResolvedQuote | null) {
  if (!quote) return null;
  return {
    price: quote.price,
    currency: quote.currency,
    changePct: quote.changePct,
    high52: quote.high52,
    low52: quote.low52,
    provider: quote.provider,
    fetchedAt: quote.fetchedAt.toISOString(),
    stale: quote.stale,
  };
}

/** Carga todo lo necesario: replay por activo + quotes de abiertas + FX (doc 02 §5). */
export async function loadPortfolio(opts: { forceQuotes?: boolean } = {}): Promise<PortfolioData> {
  const [assets, ops, currencies, settings] = await Promise.all([
    Asset.find().populate(['instrumentTypeId', 'quoteCurrencyId']),
    Operation.find().select('type assetId platformId units unitPrice currencyId date createdAt'),
    Currency.find(),
    getSettings(),
  ]);
  const currencyCode = new Map(currencies.map((c) => [c.id, c.code]));
  const assetById = new Map(assets.map((a) => [a.id, a]));

  const opsByAsset = new Map<string, typeof ops>();
  for (const op of ops) {
    const key = String(op.assetId);
    const list = opsByAsset.get(key) ?? [];
    list.push(op);
    opsByAsset.set(key, list);
  }

  const raw: RawPosition[] = [];
  for (const [assetId, assetOps] of opsByAsset) {
    const asset = assetById.get(assetId);
    if (!asset) continue;
    let state: PositionState;
    try {
      state = replay(
        assetOps.map((o) => ({
          id: o.id,
          type: o.type,
          units: o.units,
          unitPrice: o.unitPrice,
          date: o.date,
          createdAt: o.createdAt,
          platformId: String(o.platformId),
        })),
      );
    } catch {
      continue; // set inconsistente: no rompe el portafolio
    }
    if (state.totalBought <= 0) continue;
    raw.push({
      asset,
      state,
      opCurrencyCode: currencyCode.get(String(assetOps[0]!.currencyId)) ?? 'ARS',
      quote: null,
    });
  }

  const open = raw.filter((r) => r.state.units > UNIT_EPS);
  if (open.length > 0) {
    const quotes = await getQuotes(
      open.map((r) => toProviderAsset(r.asset)),
      { force: opts.forceQuotes },
    );
    for (const r of open) r.quote = quotes.get(r.asset.id) ?? null;
  }

  const fx = await getFx(settings.fxKind);
  return { raw, fx, fxKind: settings.fxKind };
}

export function positionToDTO(r: RawPosition, display: Display, fxValue: number | null) {
  const { asset, state, quote } = r;
  const invested = convert(state.invested, r.opCurrencyCode, display, fxValue);
  const value = quote ? convert(state.units * quote.price, quote.currency, display, fxValue) : null;
  const realized = convert(state.realized, r.opCurrencyCode, display, fxValue);
  const unrealized = value !== null && invested !== null ? value - invested : null;
  return {
    assetId: asset.id,
    ticker: asset.ticker,
    name: asset.name,
    instrumentTypeName: asset.instrumentTypeId?.name ?? '',
    units: round8(state.units),
    avgCost: round8(state.avgCost),
    opCurrency: r.opCurrencyCode,
    invested: invested !== null ? round2(invested) : 0,
    value: value !== null ? round2(value) : null,
    unrealized: unrealized !== null ? round2(unrealized) : null,
    unrealizedPct:
      unrealized !== null && invested !== null && invested > 0
        ? round2((unrealized / invested) * 100)
        : null,
    realized: realized !== null ? round2(realized) : 0,
    quote: quoteToDTO(quote),
  };
}

export function summaryFromRaw(data: PortfolioData, display: Display) {
  const fxValue = data.fx?.value ?? null;
  const open = data.raw.filter((r) => r.state.units > UNIT_EPS);

  let invested = 0;
  let value = 0;
  let unrealized = 0;
  let realized = 0;
  let quotesMissing = 0;

  for (const r of data.raw) {
    const c = convert(r.state.realized, r.opCurrencyCode, display, fxValue);
    if (c !== null) realized += c;
  }
  for (const r of open) {
    const inv = convert(r.state.invested, r.opCurrencyCode, display, fxValue);
    const val = r.quote
      ? convert(r.state.units * r.quote.price, r.quote.currency, display, fxValue)
      : null;
    if (inv !== null) invested += inv;
    if (val !== null && inv !== null) {
      value += val;
      unrealized += val - inv;
    } else {
      quotesMissing += 1;
    }
  }

  return {
    currency: display,
    invested: round2(invested),
    value: round2(value),
    realized: round2(realized),
    unrealized: round2(unrealized),
    unrealizedPct: invested > 0 ? round2((unrealized / invested) * 100) : null,
    totalResultPct: invested > 0 ? round2(((unrealized + realized) / invested) * 100) : null,
    fx: data.fx
      ? {
          kind: data.fx.kind,
          value: data.fx.value,
          provider: data.fx.provider,
          fetchedAt: data.fx.fetchedAt.toISOString(),
          stale: data.fx.stale,
        }
      : null,
    quotesMissing,
  };
}

/** Posición individual para el detalle de activo (GET /assets/:id). */
export async function buildPositionDTO(
  assetDoc: any,
  state: PositionState,
  opsDocs: any[],
  display: Display,
) {
  const settings = await getSettings();
  const fx = await getFx(settings.fxKind);
  const quotes = await getQuotes([toProviderAsset(assetDoc)]);
  const firstOp = opsDocs[opsDocs.length - 1]; // opsDocs vienen date desc
  const opCurrencyCode =
    firstOp && typeof firstOp.currencyId === 'object' && firstOp.currencyId
      ? firstOp.currencyId.code
      : 'ARS';
  return positionToDTO(
    { asset: assetDoc, state, opCurrencyCode, quote: quotes.get(assetDoc.id) ?? null },
    display,
    fx?.value ?? null,
  );
}
