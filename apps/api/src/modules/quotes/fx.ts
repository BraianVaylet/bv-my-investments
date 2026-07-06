import { FxRate } from '../../models/fxRate.model';
import { data912Fx } from '../../providers/data912';
import { dolarApiFx } from '../../providers/dolarapi';

export interface ResolvedFx {
  kind: 'ccl' | 'mep' | 'oficial';
  value: number;
  provider: string;
  fetchedAt: Date;
  stale: boolean;
}

const FX_TTL_MS = 15 * 60 * 1000; // doc 03 §5

/** Dólar del tipo pedido: DolarApi primario, data912 fallback, cache 15 min. */
export async function getFx(kind: 'ccl' | 'mep' | 'oficial'): Promise<ResolvedFx | null> {
  const cached = await FxRate.findOne({ kind }).sort({ fetchedAt: -1 });
  if (cached && Date.now() - cached.fetchedAt.getTime() < FX_TTL_MS) {
    return {
      kind,
      value: cached.value,
      provider: cached.provider,
      fetchedAt: cached.fetchedAt,
      stale: false,
    };
  }

  let value = await dolarApiFx(kind);
  let provider = 'dolarapi';
  if (value === null && kind !== 'oficial') {
    value = await data912Fx(kind);
    provider = 'data912';
  }

  if (value !== null) {
    const doc = await FxRate.create({ kind, value, provider, fetchedAt: new Date() });
    return { kind, value: doc.value, provider, fetchedAt: doc.fetchedAt, stale: false };
  }

  if (cached) {
    return {
      kind,
      value: cached.value,
      provider: cached.provider,
      fetchedAt: cached.fetchedAt,
      stale: true,
    };
  }
  return null;
}
