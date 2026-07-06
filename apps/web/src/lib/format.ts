/** Formatters de presentación. El redondeo de negocio vive en el BE (core/money.ts). */

export function fmtMoney(n: number | null | undefined, currency = 'ARS'): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: Math.abs(n) < 1 && n !== 0 ? 4 : 2,
  }).format(n);
}

export function fmtNumber(n: number | null | undefined, maxDecimals = 2): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: maxDecimals }).format(n);
}

/** Unidades: hasta 8 decimales (cripto), sin ceros de cola. */
export function fmtUnits(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 8 }).format(n);
}

export function fmtPct(n: number | null | undefined, signed = true): string {
  if (n === null || n === undefined) return '—';
  const sign = signed && n > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n)}%`;
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Fecha para <input type="date"> */
export function toInputDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}
