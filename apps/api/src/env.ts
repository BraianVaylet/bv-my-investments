import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Carga .env (raíz del monorepo o cwd) sin dependencia externa.
 * Solo formato simple KEY=VALUE; no pisa variables ya definidas.
 */
export function loadEnv(): void {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(__dirname, '../../../.env'),
  ];
  const file = candidates.find((p) => existsSync(p));
  if (!file) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();
