import { model, Schema, Types } from 'mongoose';

export interface SnapshotDoc {
  date: Date; // normalizada a 00:00 UTC, única por día
  fx: { kind: string; value: number };
  totals: {
    valueARS: number;
    valueUSD: number;
    invested: number;
    realized: number;
    unrealized: number;
  };
  positions: {
    assetId: Types.ObjectId;
    units: number;
    price: number;
    valueARS: number;
    valueUSD: number;
  }[];
}

const snapshotSchema = new Schema<SnapshotDoc>(
  {
    date: { type: Date, required: true, unique: true },
    fx: { kind: String, value: Number },
    totals: {
      valueARS: Number,
      valueUSD: Number,
      invested: Number,
      realized: Number,
      unrealized: Number,
    },
    positions: [
      {
        assetId: { type: Schema.Types.ObjectId, ref: 'Asset' },
        units: Number,
        price: Number,
        valueARS: Number,
        valueUSD: Number,
      },
    ],
  },
  { timestamps: true },
);

export const Snapshot = model('Snapshot', snapshotSchema);
