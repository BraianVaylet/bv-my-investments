/** Activo enriquecido que reciben los adapters (sin depender de Mongoose). */
export interface ProviderAsset {
  id: string;
  ticker: string;
  name: string;
  instrumentTypeName: string;
  quoteCurrencyCode: string;
  providerSymbols: Record<string, string | undefined>;
  cedearRatio?: number | null;
}

export interface ProviderQuote {
  price: number;
  currency: string;
  changePct?: number;
  high52?: number;
  low52?: number;
}

/** Adapter de proveedor (doc 02 §4). Batch siempre que la API lo permita. */
export interface QuoteProvider {
  id: string;
  supports(asset: ProviderAsset): boolean;
  /** Devuelve un Map assetId → quote. Los que no pudo resolver simplemente no aparecen. */
  getQuotes(assets: ProviderAsset[]): Promise<Map<string, ProviderQuote>>;
}

/** Normaliza el nombre del tipo de instrumento para las cadenas de fallback. */
export function normalizeInstrumentType(name: string): string {
  const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');
  return name.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '');
}
