import { model, Schema, Types } from 'mongoose';

/**
 * Rango de 52 semanas calculado desde el histórico de precios (doc 03 §3.4):
 * dato lento, se cachea 24 h. Solo se usa cuando el proveedor de la cotización
 * no lo trae nativo (Yahoo sí lo trae; data912/CoinGecko no).
 */
export interface Stat52wDoc {
  assetId: Types.ObjectId;
  high52: number;
  low52: number;
  currency: string;
  computedAt: Date;
}

const stat52wSchema = new Schema<Stat52wDoc>(
  {
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset', required: true, unique: true },
    high52: { type: Number, required: true },
    low52: { type: Number, required: true },
    currency: { type: String, required: true },
    computedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const Stat52w = model('Stat52w', stat52wSchema);
