import { round2, round8, UNIT_EPS } from '../../core/money';
import { Snapshot } from '../../models/snapshot.model';
import { convert, loadPortfolio, summaryFromRaw } from '../portfolio/service';

/**
 * Snapshot diario del portafolio (RF-7.1, RB-10): guarda valuación en ARS y USD
 * con el FX usado ese día. Upsert por día: correr dos veces no duplica.
 */
export async function takeSnapshot(): Promise<void> {
  const data = await loadPortfolio();
  const fxValue = data.fx?.value ?? null;
  const summaryARS = summaryFromRaw(data, 'ARS');
  const summaryUSD = summaryFromRaw(data, 'USD');

  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);

  const positions = data.raw
    .filter((r) => r.state.units > UNIT_EPS && r.quote)
    .map((r) => {
      const value = r.state.units * r.quote!.price;
      return {
        assetId: r.asset._id,
        units: round8(r.state.units),
        price: r.quote!.price,
        valueARS: round2(convert(value, r.quote!.currency, 'ARS', fxValue) ?? 0),
        valueUSD: round2(convert(value, r.quote!.currency, 'USD', fxValue) ?? 0),
      };
    });

  await Snapshot.updateOne(
    { date: day },
    {
      $set: {
        fx: { kind: data.fxKind, value: fxValue ?? 0 },
        totals: {
          valueARS: summaryARS.value,
          valueUSD: summaryUSD.value,
          invested: summaryARS.invested,
          realized: summaryARS.realized,
          unrealized: summaryARS.unrealized,
        },
        positions,
      },
    },
    { upsert: true },
  );
}

/** Milisegundos hasta las próximas 21:00 ART (ART = UTC-3 fijo, sin DST). */
export function msUntilNextRun(now = new Date()): number {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0); // 21:00 ART = 00:00 UTC del día siguiente
  const ms = next.getTime() - now.getTime();
  return ms > 0 ? ms : ms + 24 * 60 * 60 * 1000;
}

/** Cron diario 21:00 ART, post cierre BYMA (doc 02 §8). Sin dependencias externas. */
export function scheduleSnapshotJob(log: (msg: string) => void) {
  const scheduleNext = () => {
    const timer = setTimeout(async () => {
      try {
        await takeSnapshot();
        log('Snapshot diario guardado');
      } catch (err) {
        log(`Snapshot falló: ${(err as Error).message}`);
      } finally {
        scheduleNext();
      }
    }, msUntilNextRun());
    timer.unref(); // no impedir el cierre del proceso
  };
  scheduleNext();
}
