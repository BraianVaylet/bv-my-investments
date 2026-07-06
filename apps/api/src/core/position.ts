import { DomainError } from './errors';
import { UNIT_EPS } from './money';

/**
 * Motor de cálculo puro (sin IO). Replay de operaciones con costo promedio
 * ponderado (WAC). Reglas RB-02..RB-06 del documento funcional:
 *  - RB-03 tenencia = Σ compras − Σ ventas, ordenado por fecha
 *  - RB-04 cada compra recalcula el PPC ponderado
 *  - RB-05 una venta no modifica el PPC; solo reduce unidades
 *  - RB-06 el PPC vigente a cada venta se deriva siempre por replay
 *  - RB-02 no se puede vender más que la tenencia a la fecha
 */

export interface OpInput {
  id: string;
  type: 'buy' | 'sell';
  units: number;
  unitPrice: number;
  date: Date;
  createdAt?: Date;
}

export interface SellEvent {
  opId: string;
  date: Date;
  units: number;
  unitPrice: number;
  /** PPC vigente al momento de la venta */
  avgCostAtSale: number;
  /** (precioVenta − PPC) × unidades */
  realized: number;
  /** (precioVenta − PPC) / PPC */
  realizedPct: number | null;
}

export interface PositionState {
  units: number;
  /** PPC vigente. 0 si no hay tenencia. */
  avgCost: number;
  /** capital aún invertido = units × avgCost */
  invested: number;
  /** resultado realizado acumulado */
  realized: number;
  totalBought: number;
  totalSold: number;
  sellEvents: SellEvent[];
  /** unidades netas por plataforma (para distribución) */
  unitsByPlatform: Record<string, number>;
}

export interface ReplayOp extends OpInput {
  platformId?: string;
}

/** Orden canónico: fecha ASC, desempate por createdAt ASC (doc 02 §3). */
export function sortOps<T extends OpInput>(ops: T[]): T[] {
  return [...ops].sort((a, b) => {
    const d = a.date.getTime() - b.date.getTime();
    if (d !== 0) return d;
    return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
  });
}

export function replay(opsUnsorted: ReplayOp[]): PositionState {
  const ops = sortOps(opsUnsorted);
  const state: PositionState = {
    units: 0,
    avgCost: 0,
    invested: 0,
    realized: 0,
    totalBought: 0,
    totalSold: 0,
    sellEvents: [],
    unitsByPlatform: {},
  };

  for (const op of ops) {
    if (op.type === 'buy') {
      const newUnits = state.units + op.units;
      state.avgCost = (state.units * state.avgCost + op.units * op.unitPrice) / newUnits;
      state.units = newUnits;
      state.totalBought += op.units;
      if (op.platformId) {
        state.unitsByPlatform[op.platformId] =
          (state.unitsByPlatform[op.platformId] ?? 0) + op.units;
      }
    } else {
      if (op.units > state.units + UNIT_EPS) {
        throw new DomainError(
          'INSUFFICIENT_UNITS',
          `La venta del ${op.date.toISOString().slice(0, 10)} supera la tenencia disponible a esa fecha (${state.units})`,
          op.id,
        );
      }
      const realized = (op.unitPrice - state.avgCost) * op.units;
      state.sellEvents.push({
        opId: op.id,
        date: op.date,
        units: op.units,
        unitPrice: op.unitPrice,
        avgCostAtSale: state.avgCost,
        realized,
        realizedPct: state.avgCost > 0 ? (op.unitPrice - state.avgCost) / state.avgCost : null,
      });
      state.realized += realized;
      state.units -= op.units;
      state.totalSold += op.units;
      if (op.platformId) {
        state.unitsByPlatform[op.platformId] =
          (state.unitsByPlatform[op.platformId] ?? 0) - op.units;
      }
      // Venta total: limpiar residuo de floating point; el PPC arranca de cero en recompra.
      if (state.units <= UNIT_EPS) {
        state.units = 0;
        state.avgCost = 0;
      }
    }
  }

  state.invested = state.units * state.avgCost;
  return state;
}

/**
 * Valida un set de operaciones (RB-02 sobre el set resultante tras alta/edición/borrado).
 * Devuelve el error de dominio en vez de tirarlo, para que el caller decida el status HTTP.
 */
export function validateOps(ops: ReplayOp[]): DomainError | null {
  try {
    replay(ops);
    return null;
  } catch (err) {
    if (err instanceof DomainError) return err;
    throw err;
  }
}
