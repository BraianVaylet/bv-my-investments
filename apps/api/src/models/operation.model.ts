import { model, Schema, Types } from 'mongoose';

export interface OperationDoc {
  type: 'buy' | 'sell';
  assetId: Types.ObjectId;
  platformId: Types.ObjectId;
  units: number;
  currencyId: Types.ObjectId;
  unitPrice: number;
  date: Date;
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const operationSchema = new Schema<OperationDoc>(
  {
    type: { type: String, enum: ['buy', 'sell'], required: true },
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset', required: true },
    platformId: { type: Schema.Types.ObjectId, ref: 'Platform', required: true },
    units: { type: Number, required: true, min: 0 },
    currencyId: { type: Schema.Types.ObjectId, ref: 'Currency', required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

operationSchema.index({ assetId: 1, date: 1 });
operationSchema.index({ date: -1 });
operationSchema.index({ platformId: 1 });

export const Operation = model('Operation', operationSchema);
