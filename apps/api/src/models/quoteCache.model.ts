import { model, Schema, Types } from 'mongoose';

export interface QuoteCacheDoc {
  assetId: Types.ObjectId;
  provider: string;
  price: number;
  currency: string;
  changePct?: number;
  high52?: number;
  low52?: number;
  fetchedAt: Date;
}

const quoteCacheSchema = new Schema<QuoteCacheDoc>(
  {
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset', required: true },
    provider: { type: String, required: true },
    price: { type: Number, required: true },
    currency: { type: String, required: true },
    changePct: Number,
    high52: Number,
    low52: Number,
    fetchedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

quoteCacheSchema.index({ assetId: 1, provider: 1 }, { unique: true });

export const QuoteCache = model('QuoteCache', quoteCacheSchema);
