import { model, Schema } from 'mongoose';

export interface SettingsDoc {
  preferredProviders: Map<string, string>;
  fxKind: 'ccl' | 'mep' | 'oficial';
  sellSignalPct: number;
  near52wPct: number;
  dailyMovePct: number;
  defaultDisplayCurrency: 'ARS' | 'USD';
}

const settingsSchema = new Schema<SettingsDoc>(
  {
    preferredProviders: { type: Map, of: String, default: {} },
    fxKind: { type: String, enum: ['ccl', 'mep', 'oficial'], default: 'ccl' },
    sellSignalPct: { type: Number, default: 80 },
    near52wPct: { type: Number, default: 5 },
    dailyMovePct: { type: Number, default: 5 },
    defaultDisplayCurrency: { type: String, enum: ['ARS', 'USD'], default: 'ARS' },
  },
  { timestamps: true },
);

export const Settings = model('Settings', settingsSchema);

/** Documento único: crea con defaults si no existe. */
export async function getSettings() {
  const existing = await Settings.findOne();
  if (existing) return existing;
  return Settings.create({});
}
