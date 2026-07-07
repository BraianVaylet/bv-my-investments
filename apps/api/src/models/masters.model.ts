import { model, Schema } from 'mongoose';

export interface MasterDoc {
  name: string;
  emoji?: string;
  archived: boolean;
}

export interface InstrumentTypeDoc extends MasterDoc {
  /** los activos de este tipo requieren ratio de conversión (ej. CEDEAR) */
  hasRatio: boolean;
}

export interface CurrencyDoc extends MasterDoc {
  code: string;
}

const masterFields = {
  name: { type: String, required: true, unique: true, trim: true },
  emoji: { type: String, trim: true },
  archived: { type: Boolean, default: false },
};

export const InstrumentType = model(
  'InstrumentType',
  new Schema<InstrumentTypeDoc>(
    { ...masterFields, hasRatio: { type: Boolean, default: false } },
    { timestamps: true },
  ),
);

export const Platform = model(
  'Platform',
  new Schema<MasterDoc>(masterFields, { timestamps: true }),
);

export const Currency = model(
  'Currency',
  new Schema<CurrencyDoc>(
    {
      ...masterFields,
      code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    },
    { timestamps: true },
  ),
);
