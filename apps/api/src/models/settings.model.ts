import { model, Schema } from 'mongoose';

export interface SettingsDoc {
  preferredProviders: Map<string, string>;
  fxKind: 'ccl' | 'mep' | 'oficial';
  buySignalEnabled: boolean;
  sellSignalEnabled: boolean;
  sellSignalPct: number;
  near52wEnabled: boolean;
  near52wPct: number;
  dailyMoveEnabled: boolean;
  dailyMovePct: number;
  defaultDisplayCurrency: 'ARS' | 'USD';
}

const settingsSchema = new Schema<SettingsDoc>(
  {
    preferredProviders: { type: Map, of: String, default: {} },
    fxKind: { type: String, enum: ['ccl', 'mep', 'oficial'], default: 'ccl' },
    buySignalEnabled: { type: Boolean, default: true },
    sellSignalEnabled: { type: Boolean, default: true },
    sellSignalPct: { type: Number, default: 80 },
    near52wEnabled: { type: Boolean, default: true },
    near52wPct: { type: Number, default: 5 },
    dailyMoveEnabled: { type: Boolean, default: true },
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
