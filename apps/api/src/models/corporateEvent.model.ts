import { model, Schema, Types } from 'mongoose';

export interface CorporateEventDoc {
  assetId: Types.ObjectId;
  type: 'split' | 'ratio-change';
  date: Date;
  /** multiplicador de unidades desde la fecha; el PPC se divide por él (RB-09) */
  factor: number;
  notes?: string;
  createdBy: Types.ObjectId;
}

const corporateEventSchema = new Schema<CorporateEventDoc>(
  {
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset', required: true },
    type: { type: String, enum: ['split', 'ratio-change'], required: true },
    date: { type: Date, required: true },
    factor: { type: Number, required: true, min: 0 },
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

corporateEventSchema.index({ assetId: 1, date: 1 });

export const CorporateEvent = model('CorporateEvent', corporateEventSchema);
