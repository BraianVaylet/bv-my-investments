import type { DisplayCurrency, FxKind } from './schemas';

// DTOs que devuelve la API. El FE tipa contra esto.

export interface UserDTO {
  id: string;
  username: string;
  displayName: string;
}

export interface MasterDTO {
  id: string;
  name: string;
  code?: string; // solo currencies
  emoji?: string;
  hasRatio?: boolean; // solo instrument types
  archived: boolean;
}

export interface AssetDTO {
  id: string;
  ticker: string;
  name: string;
  instrumentTypeId: string;
  instrumentTypeName?: string;
  instrumentTypeEmoji?: string;
  quoteCurrencyId: string;
  quoteCurrencyCode?: string;
  providerSymbols: Record<string, string | undefined>;
  cedearRatio?: number | null;
  archived: boolean;
}

export interface OperationDTO {
  id: string;
  type: 'buy' | 'sell';
  assetId: string;
  assetTicker?: string;
  platformId: string;
  platformName?: string;
  platformEmoji?: string;
  units: number;
  currencyId: string;
  currencyCode?: string;
  unitPrice: number;
  total: number;
  date: string;
  notes?: string;
  createdByName?: string;
  /** solo ventas: resultado realizado derivado por replay */
  realized?: number;
  realizedPct?: number;
}

export interface PaginatedDTO<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface QuoteDTO {
  price: number;
  currency: string;
  changePct?: number;
  high52?: number;
  low52?: number;
  provider: string;
  fetchedAt: string;
  stale: boolean;
}

export interface PositionDTO {
  assetId: string;
  ticker: string;
  name: string;
  instrumentTypeName: string;
  instrumentTypeEmoji?: string;
  units: number;
  /** PPC en moneda de operación */
  avgCost: number;
  opCurrency: string;
  /** montos convertidos a la moneda de visualización pedida */
  invested: number;
  value: number | null;
  unrealized: number | null;
  unrealizedPct: number | null;
  realized: number;
  quote: QuoteDTO | null;
}

export interface ClosedPositionDTO {
  assetId: string;
  ticker: string;
  name: string;
  instrumentTypeName: string;
  totalBought: number;
  totalSold: number;
  realized: number;
  opCurrency: string;
}

export interface PortfolioSummaryDTO {
  currency: DisplayCurrency;
  invested: number;
  value: number;
  realized: number;
  unrealized: number;
  unrealizedPct: number | null;
  totalResultPct: number | null;
  fx: FxDTO | null;
  quotesMissing: number;
}

export interface FxDTO {
  kind: FxKind;
  value: number;
  provider: string;
  fetchedAt: string;
  stale: boolean;
}

export interface SnapshotDTO {
  date: string;
  valueARS: number;
  valueUSD: number;
  invested: number;
  realized: number;
  unrealized: number;
  fx: { kind: string; value: number };
}

export interface MonthlyStatDTO {
  month: string; // YYYY-MM
  invested: number;
  sold: number;
  result: number;
}

export interface AllocationSliceDTO {
  label: string;
  value: number;
  pct: number;
}

export interface AllocationDTO {
  currency: DisplayCurrency;
  byInstrumentType: AllocationSliceDTO[];
  byPlatform: AllocationSliceDTO[];
  byCurrency: AllocationSliceDTO[];
}

export type SignalKind =
  'buy' | 'sell' | 'near-52w-low' | 'near-52w-high' | 'daily-move' | 'custom';

export interface SignalDTO {
  kind: SignalKind;
  /** naturaleza de la señal (para las custom; en las built-in coincide con kind si aplica) */
  nature?: 'buy' | 'sell';
  ruleName?: string;
  description?: string;
  assetId: string;
  ticker: string;
  message: string;
  value?: number;
}

export interface CorporateEventDTO {
  id: string;
  assetId: string;
  type: 'split' | 'ratio-change';
  date: string;
  factor: number;
  notes?: string;
}

export interface SignalRuleDTO {
  id: string;
  name: string;
  description?: string;
  nature: 'buy' | 'sell';
  scope: 'global' | 'asset';
  assetId?: string;
  assetTicker?: string;
  thresholdType: 'percent' | 'price';
  direction: 'above' | 'below';
  value: number;
  currency?: DisplayCurrency;
  enabled: boolean;
}

export interface AssetDetailDTO extends AssetDTO {
  position: PositionDTO | null;
  operations: OperationDTO[];
  corporateEvents: CorporateEventDTO[];
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
