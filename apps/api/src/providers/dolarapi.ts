import { fetchJson, toNum } from './http';

const BASE = 'https://dolarapi.com/v1/dolares';

const PATH_BY_KIND: Record<'ccl' | 'mep' | 'oficial', string> = {
  ccl: 'contadoconliqui',
  mep: 'bolsa',
  oficial: 'oficial',
};

/** DolarApi: fuente primaria del FX (RB-10). Devuelve venta. */
export async function dolarApiFx(kind: 'ccl' | 'mep' | 'oficial'): Promise<number | null> {
  try {
    const data = await fetchJson<{ compra?: number; venta?: number }>(
      `${BASE}/${PATH_BY_KIND[kind]}`,
    );
    const venta = toNum(data.venta) ?? toNum(data.compra);
    return venta && venta > 0 ? venta : null;
  } catch {
    return null;
  }
}
