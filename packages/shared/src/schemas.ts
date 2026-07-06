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

// ---------------------------------------------------------------- settings

export const FX_KINDS = ['ccl', 'mep', 'oficial'] as const;
export const DISPLAY_CURRENCIES = ['ARS', 'USD'] as const;

export const settingsSchema = z.object({
  preferredProviders: z.record(z.string()).default({}),
  fxKind: z.enum(FX_KINDS).default('ccl'),
  sellSignalPct: z.number().min(0).max(10000).default(80),
  near52wPct: z.number().min(0).max(100).default(5),
  dailyMovePct: z.number().min(0).max(100).default(5),
  defaultDisplayCurrency: z.enum(DISPLAY_CURRENCIES).default('ARS'),
});

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
