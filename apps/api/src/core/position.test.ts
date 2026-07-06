import { describe, expect, it } from 'vitest';
import { DomainError } from './errors';
import { round2, round8 } from './money';
import { replay, validateOps, type ReplayOp } from './position';

let seq = 0;
function op(
  type: 'buy' | 'sell',
  units: number,
  unitPrice: number,
  date: string,
  createdAtOffsetMs = 0,
): ReplayOp {
  seq += 1;
  return {
    id: `op-${seq}`,
    type,
    units,
    unitPrice,
    date: new Date(date),
    createdAt: new Date(new Date(date).getTime() + createdAtOffsetMs),
  };
}

describe('replay — WAC', () => {
  it('compras sucesivas recalculan PPC ponderado (RB-04)', () => {
    const s = replay([op('buy', 10, 100, '2024-01-01'), op('buy', 10, 200, '2024-02-01')]);
    expect(s.units).toBe(20);
    expect(s.avgCost).toBe(150);
    expect(s.invested).toBe(3000);
    expect(s.realized).toBe(0);
  });

  it('venta parcial no modifica PPC y computa realizado (RB-05)', () => {
    const s = replay([
      op('buy', 10, 100, '2024-01-01'),
      op('buy', 10, 200, '2024-02-01'),
      op('sell', 5, 300, '2024-03-01'),
    ]);
    expect(s.units).toBe(15);
    expect(s.avgCost).toBe(150); // sin cambio
    expect(s.realized).toBe((300 - 150) * 5);
    expect(s.invested).toBe(15 * 150);
    expect(s.sellEvents).toHaveLength(1);
    expect(s.sellEvents[0]!.avgCostAtSale).toBe(150);
    expect(s.sellEvents[0]!.realizedPct).toBeCloseTo(1); // +100%
  });

  it('bug P5 de la planilla corregido: vender con ganancia da resultado positivo', () => {
    const s = replay([op('buy', 10, 100, '2024-01-01'), op('sell', 10, 150, '2024-02-01')]);
    expect(s.realized).toBe(500); // la planilla daba -500 (costo − ingreso)
  });

  it('venta total y recompra: PPC arranca de cero (caso borde doc 02)', () => {
    const s = replay([
      op('buy', 10, 100, '2024-01-01'),
      op('sell', 10, 200, '2024-02-01'),
      op('buy', 5, 500, '2024-03-01'),
    ]);
    expect(s.units).toBe(5);
    expect(s.avgCost).toBe(500); // no contaminado por el ciclo anterior
    expect(s.realized).toBe(1000);
  });

  it('venta total con residuo de floating point queda en cero exacto', () => {
    const s = replay([
      op('buy', 0.1, 100, '2024-01-01'),
      op('buy', 0.2, 100, '2024-01-02'),
      op('sell', 0.3, 100, '2024-01-03'), // 0.1 + 0.2 !== 0.3 en floating point
    ]);
    expect(s.units).toBe(0);
    expect(s.avgCost).toBe(0);
  });

  it('RB-02: vender más que la tenencia a la fecha falla aunque haya compras posteriores', () => {
    const ops = [
      op('buy', 10, 100, '2024-01-01'),
      op('sell', 15, 100, '2024-02-01'), // a esta fecha hay 10
      op('buy', 10, 100, '2024-03-01'), // el total llega a 20, pero después
    ];
    expect(() => replay(ops)).toThrow(DomainError);
    const err = validateOps(ops);
    expect(err?.code).toBe('INSUFFICIENT_UNITS');
    expect(err?.opId).toBe(ops[1]!.id);
  });

  it('edición retroactiva: reducir una compra pasada invalida ventas posteriores', () => {
    const buy = op('buy', 10, 100, '2024-01-01');
    const sell = op('sell', 8, 200, '2024-02-01');
    expect(validateOps([buy, sell])).toBeNull();
    const edited = { ...buy, units: 5 }; // el usuario edita la compra
    const err = validateOps([edited, sell]);
    expect(err?.code).toBe('INSUFFICIENT_UNITS');
  });

  it('mismo día: desempata por createdAt (orden de carga)', () => {
    const buy = op('buy', 10, 100, '2024-01-01', 0);
    const sell = op('sell', 10, 150, '2024-01-01', 1000); // cargada después
    expect(validateOps([sell, buy])).toBeNull(); // orden de entrada no importa
    const s = replay([sell, buy]);
    expect(s.units).toBe(0);
    expect(s.realized).toBe(500);
  });

  it('unidades fraccionarias (cripto) con 8 decimales', () => {
    const s = replay([
      op('buy', 0.12345678, 50000, '2024-01-01'),
      op('buy', 0.2, 60000, '2024-02-01'),
    ]);
    expect(round8(s.units)).toBe(0.32345678);
    const expectedAvg = (0.12345678 * 50000 + 0.2 * 60000) / 0.32345678;
    expect(s.avgCost).toBeCloseTo(expectedAvg, 6);
  });

  it('unidades por plataforma se netean para distribución', () => {
    const a: ReplayOp = { ...op('buy', 10, 100, '2024-01-01'), platformId: 'p1' };
    const b: ReplayOp = { ...op('buy', 5, 100, '2024-02-01'), platformId: 'p2' };
    const c: ReplayOp = { ...op('sell', 4, 100, '2024-03-01'), platformId: 'p1' };
    const s = replay([a, b, c]);
    expect(s.unitsByPlatform).toEqual({ p1: 6, p2: 5 });
  });
});

describe('money — redondeo centralizado', () => {
  it('round2 para montos', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(1234.5678)).toBe(1234.57);
    expect(round2(-1.005)).toBe(-1); // Math.round hacia arriba en negativos: -1.0
  });

  it('round8 para unidades cripto', () => {
    expect(round8(0.123456789)).toBe(0.12345679);
    expect(round8(0.1 + 0.2)).toBe(0.3);
  });
});
