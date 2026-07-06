/** fetch con timeout corto: un proveedor colgado no puede colgar la vista. */
export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const { timeoutMs = 8000, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'application/json', ...rest.headers },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} en ${url}`);
  }
  return (await res.json()) as T;
}

export function toNum(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}
