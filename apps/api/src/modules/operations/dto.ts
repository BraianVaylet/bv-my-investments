import { round2, round8 } from '../../core/money';
import type { SellEvent } from '../../core/position';

export function toOperationDTO(doc: any, assetTicker?: string, sellEvent?: SellEvent) {
  const platform = doc.platformId;
  const currency = doc.currencyId;
  const createdBy = doc.createdBy;
  return {
    id: doc.id,
    type: doc.type,
    assetId:
      typeof doc.assetId === 'object' && doc.assetId
        ? String(doc.assetId._id)
        : String(doc.assetId),
    assetTicker:
      assetTicker ??
      (typeof doc.assetId === 'object' && doc.assetId ? doc.assetId.ticker : undefined),
    platformId: typeof platform === 'object' && platform ? String(platform._id) : String(platform),
    platformName: typeof platform === 'object' && platform ? platform.name : undefined,
    platformEmoji:
      typeof platform === 'object' && platform ? (platform.emoji ?? undefined) : undefined,
    units: round8(doc.units),
    currencyId: typeof currency === 'object' && currency ? String(currency._id) : String(currency),
    currencyCode: typeof currency === 'object' && currency ? currency.code : undefined,
    unitPrice: doc.unitPrice,
    total: round2(doc.units * doc.unitPrice),
    date: doc.date.toISOString(),
    notes: doc.notes ?? undefined,
    createdByName: typeof createdBy === 'object' && createdBy ? createdBy.displayName : undefined,
    ...(sellEvent
      ? {
          realized: round2(sellEvent.realized),
          realizedPct:
            sellEvent.realizedPct === null ? undefined : round2(sellEvent.realizedPct * 100),
        }
      : {}),
  };
}
