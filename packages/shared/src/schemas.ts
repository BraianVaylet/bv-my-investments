import { z } from 'zod';

// ---------------------------------------------------------------- auth

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Solo letras, números y . _ -')
    .transform((s) => s.toLowerCase()),
  password: z.string().min(8, 'Mínimo 8 caracteres').max(128),
  displayName: z.string().trim().min(1).max(64),
  inviteToken: z.string().min(1, 'Token requerido'),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Requerido'),
  password: z.string().min(1, 'Requerido'),
});

// ---------------------------------------------------------------- masters

export const masterCreateSchema = z.object({
  name: z.string().trim().min(1, 'Requerido').max(64),
  emoji: z.string().trim().max(8).optional(),
});

/** Tipos de instrumento: declaran si sus activos requieren ratio (ej. CEDEARs). */
export const instrumentTypeCreateSchema = masterCreateSchema.extend({
  hasRatio: z.boolean().default(false),
});

export const currencyCreateSchema = masterCreateSchema.extend({
  code: z
    .string()
    .trim()
    .min(2)
    .max(8)
    .transform((s) => s.toUpperCase()),
});

// ---------------------------------------------------------------- assets

export const providerSymbolsSchema = z.object({
  data912: z.string().trim().optional(),
  coingecko: z.string().trim().optional(),
  binance: z.string().trim().optional(),
  criptoya: z.string().trim().optional(),
  yahoo: z.string().trim().optional(),
  argentinadatos: z.string().trim().optional(),
});

export const assetCreateSchema = z.object({
  ticker: z
    .string()
    .trim()
    .min(1, 'Requerido')
    .max(20)
    .transform((s) => s.toUpperCase()),
  name: z.string().trim().min(1, 'Requerido').max(80),
  instrumentTypeId: z.string().min(1, 'Requerido'),
  quoteCurrencyId: z.string().min(1, 'Requerido'),
  providerSymbols: providerSymbolsSchema.default({}),
  cedearRatio: z.number().positive().optional().nullable(),
});

export const assetUpdateSchema = assetCreateSchema.partial();

// ---------------------------------------------------------------- operations

export const operationCreateSchema = z.object({
  type: z.enum(['buy', 'sell']),
  assetId: z.string().min(1, 'Requerido'),
  platformId: z.string().min(1, 'Requerido'),
  units: z.number().positive('Debe ser mayor a 0'),
  currencyId: z.string().min(1, 'Requerido'),
  unitPrice: z.number().positive('Debe ser mayor a 0'),
  date: z.coerce.date(),
  notes: z.string().trim().max(500).optional(),
});

export const operationUpdateSchema = operationCreateSchema.partial();

export const operationFiltersSchema = z.object({
  type: z.enum(['buy', 'sell']).optional(),
  assetId: z.string().optional(),
  platformId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const FX_KINDS = ['ccl', 'mep', 'oficial'] as const;
export const DISPLAY_CURRENCIES = ['ARS', 'USD'] as const;

// ---------------------------------------------------------------- eventos corporativos (RB-09)

export const corporateEventSchema = z.object({
  assetId: z.string().min(1, 'Requerido'),
  type: z.enum(['split', 'ratio-change']),
  date: z.coerce.date(),
  /**
   * Multiplicador de unidades a partir de la fecha (el PPC se divide por él).
   * Split 3:1 → 3. Split inverso 1:10 → 0.1. Cambio de ratio CEDEAR
   * r_viejo → r_nuevo → factor = r_nuevo / r_viejo.
   */
  factor: z.number().positive('Debe ser mayor a 0'),
  notes: z.string().trim().max(300).optional(),
});

// ---------------------------------------------------------------- reglas de señal

export const signalRuleSchema = z
  .object({
    name: z.string().trim().min(1, 'Requerido').max(60),
    description: z.string().trim().max(300).optional(),
    /** naturaleza: qué sugiere la señal al dispararse */
    nature: z.enum(['buy', 'sell']),
    /** general (todas las posiciones abiertas) o por activo */
    scope: z.enum(['global', 'asset']),
    assetId: z.string().optional(),
    /** percent: rendimiento no realizado vs PPC (%) · price: precio actual en una moneda */
    thresholdType: z.enum(['percent', 'price']),
    /** dispara cuando el valor supera (above) o cae debajo (below) del umbral */
    direction: z.enum(['above', 'below']),
    value: z.number(),
    currency: z.enum(DISPLAY_CURRENCIES).optional(),
    enabled: z.boolean().default(true),
  })
  .superRefine((d, ctx) => {
    if (d.scope === 'asset' && !d.assetId) {
      ctx.addIssue({ code: 'custom', path: ['assetId'], message: 'Elegí el activo' });
    }
    if (d.thresholdType === 'price' && !d.currency) {
      ctx.addIssue({ code: 'custom', path: ['currency'], message: 'Elegí la moneda del umbral' });
    }
  });

// ---------------------------------------------------------------- settings

export const settingsSchema = z.object({
  preferredProviders: z.record(z.string()).default({}),
  fxKind: z.enum(FX_KINDS).default('ccl'),
  sellSignalPct: z.number().min(0).max(10000).default(80),
  near52wPct: z.number().min(0).max(100).default(5),
  dailyMovePct: z.number().min(0).max(100).default(5),
  defaultDisplayCurrency: z.enum(DISPLAY_CURRENCIES).default('ARS'),
});

export type CorporateEventInput = z.infer<typeof corporateEventSchema>;
export type SignalRuleInput = z.infer<typeof signalRuleSchema>;
export type InstrumentTypeCreateInput = z.infer<typeof instrumentTypeCreateSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type MasterCreateInput = z.infer<typeof masterCreateSchema>;
export type CurrencyCreateInput = z.infer<typeof currencyCreateSchema>;
export type AssetCreateInput = z.infer<typeof assetCreateSchema>;
export type OperationCreateInput = z.infer<typeof operationCreateSchema>;
export type OperationFilters = z.infer<typeof operationFiltersSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type FxKind = (typeof FX_KINDS)[number];
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];
