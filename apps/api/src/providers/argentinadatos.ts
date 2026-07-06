import { fetchJson, toNum } from './http';
import {
  normalizeInstrumentType,
  type ProviderAsset,
  type ProviderQuote,
  type QuoteProvider,
} from './types';

const BASE = 'https://api.argentinadatos.com/v1/finanzas/fci';

const FCI_TYPES = ['mercadoDinero', 'rentaFija', 'rentaVariable', 'rentaMixta'] as const;

interface FciItem {
  fondo?: string;
  vcp?: number | string;
  ccp?: number | string;
  fecha?: string;
}

/**
 * ArgentinaDatos: única fuente razonable para FCI (valor cuotaparte, fuente CAFCI).
 * El símbolo del activo es `tipo:nombre parcial del fondo` (ej. `mercadoDinero:Fima Premium`)
 * o solo el nombre parcial: se buscan todos los tipos.
 */
export const argentinaDatosProvider: QuoteProvider = {
  id: 'argentinadatos',

  supports(asset: ProviderAsset): boolean {
    return (
      Boolean(asset.providerSymbols.argentinadatos) ||
      normalizeInstrumentType(asset.instrumentTypeName) === 'fci'
    );
  },

  async getQuotes(assets: ProviderAsset[]): Promise<Map<string, ProviderQuote>> {
    // Determinar qué tipos de FCI hay que traer
    const wanted = new Map<string, { kinds: string[]; needle: string }>();
    for (const asset of assets) {
      const raw = asset.providerSymbols.argentinadatos ?? asset.name;
      const [maybeKind, ...rest] = raw.split(':');
      if (maybeKind && rest.length > 0 && (FCI_TYPES as readonly string[]).includes(maybeKind)) {
        wanted.set(asset.id, { kinds: [maybeKind], needle: rest.join(':').trim().toLowerCase() });
      } else {
        wanted.set(asset.id, { kinds: [...FCI_TYPES], needle: raw.trim().toLowerCase() });
      }
    }

    const kindsToFetch = [...new Set([...wanted.values()].flatMap((w) => w.kinds))];
    const fundsByKind = new Map<string, FciItem[]>();
    await Promise.all(
      kindsToFetch.map(async (kind) => {
        try {
          const items = await fetchJson<FciItem[]>(`${BASE}/${kind}/ultimo`);
          if (Array.isArray(items)) fundsByKind.set(kind, items);
        } catch {
          // tipo caído
        }
      }),
    );

    const result = new Map<string, ProviderQuote>();
    for (const [assetId, { kinds, needle }] of wanted) {
      for (const kind of kinds) {
        const items = fundsByKind.get(kind) ?? [];
        const match = items.find((i) => i.fondo?.toLowerCase().includes(needle));
        const price = match ? (toNum(match.vcp) ?? toNum(match.ccp)) : undefined;
        if (price && price > 0) {
          result.set(assetId, { price, currency: 'ARS' });
          break;
        }
      }
    }
    return result;
  },
};
