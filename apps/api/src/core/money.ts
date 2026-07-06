/**
 * Redondeo centralizado (doc 02 §2): montos a 2 decimales, unidades a 8.
 * Nunca redondear en la UI; siempre acá.
 */
export function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * f) / f;
}

export const round2 = (n: number): number => round(n, 2);
export const round8 = (n: number): number => round(n, 8);

/** Tolerancia para comparaciones de unidades (evita falsos INSUFFICIENT_UNITS por floating point). */
export const UNIT_EPS = 1e-8;
