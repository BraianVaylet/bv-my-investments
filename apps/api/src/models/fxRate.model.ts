import { model, Schema } from 'mongoose';

export interface FxRateDoc {
  kind: 'ccl' | 'mep' | 'oficial';
  value: number;
  provider: string;
  fetchedAt: Date;
}

const fxRateSchema = new Schema<FxRateDoc>(
  {
    kind: { type: String, enum: ['ccl', 'mep', 'oficial'], required: true },
    value: { type: Number, required: true },
    provider: { type: String, required: true },
    fetchedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

fxRateSchema.index({ kind: 1, fetchedAt: -1 });

export const FxRate = model('FxRate', fxRateSchema);
