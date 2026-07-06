import { model, Schema, Types } from 'mongoose';

export interface AssetDoc {
  ticker: string;
  name: string;
  instrumentTypeId: Types.ObjectId;
  quoteCurrencyId: Types.ObjectId;
  providerSymbols: {
    data912?: string;
    coingecko?: string;
    binance?: string;
    criptoya?: string;
    yahoo?: string;
    argentinadatos?: string;
  };
  cedearRatio?: number | null;
  archived: boolean;
}

const assetSchema = new Schema<AssetDoc>(
  {
    ticker: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    instrumentTypeId: { type: Schema.Types.ObjectId, ref: 'InstrumentType', required: true },
    quoteCurrencyId: { type: Schema.Types.ObjectId, ref: 'Currency', required: true },
    providerSymbols: {
      data912: String,
      coingecko: String,
      binance: String,
      criptoya: String,
      yahoo: String,
      argentinadatos: String,
    },
    cedearRatio: { type: Number, default: null },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Asset = model('Asset', assetSchema);
