import { model, Schema, Types } from 'mongoose';

export interface SignalRuleDoc {
  name: string;
  description?: string;
  nature: 'buy' | 'sell';
  scope: 'global' | 'asset';
  assetId?: Types.ObjectId;
  thresholdType: 'percent' | 'price';
  direction: 'above' | 'below';
  value: number;
  currency?: 'ARS' | 'USD';
  enabled: boolean;
}

const signalRuleSchema = new Schema<SignalRuleDoc>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    nature: { type: String, enum: ['buy', 'sell'], required: true },
    scope: { type: String, enum: ['global', 'asset'], required: true },
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset' },
    thresholdType: { type: String, enum: ['percent', 'price'], required: true },
    direction: { type: String, enum: ['above', 'below'], required: true },
    value: { type: Number, required: true },
    currency: { type: String, enum: ['ARS', 'USD'] },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const SignalRule = model('SignalRule', signalRuleSchema);
