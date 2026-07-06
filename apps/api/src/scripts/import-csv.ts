/**
 * Migración one-shot desde la planilla (F9, pregunta abierta 5).
 *
 * Uso:
 *   pnpm --filter @bv/api import:csv -- <archivo.csv> --user <username> [--dry-run]
 *
 * Formato CSV (con header, separador coma; comillas dobles para valores con coma):
 *   date,type,ticker,assetName,instrumentType,platform,currency,units,unitPrice,notes
 *   2023-05-10,buy,BTC,Bitcoin,Cripto,Binance,USD,0.05,27000,DCA
 *   2024-01-15,sell,BTC,Bitcoin,Cripto,Binance,USD,0.02,42000,
 *
 * - type: buy | sell (acepta compra/venta)
 * - Crea tipos de instrumento, plataformas, monedas y activos que falten.
 * - Valida el set completo con el motor (RB-02) antes de insertar: si una venta
 *   supera la tenencia a su fecha, aborta sin escribir nada.
 */
import '../env';
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDb } from '../db';
import { replay, type ReplayOp } from '../core/position';
import { Asset } from '../models/asset.model';
import { Currency, InstrumentType, Platform } from '../models/masters.model';
import { Operation } from '../models/operation.model';
import { User } from '../models/user.model';

interface Row {
  date: string;
  type: string;
  ticker: string;
  assetName: string;
  instrumentType: string;
  platform: string;
  currency: string;
  units: string;
  unitPrice: string;
  notes: string;
}

/** Parser CSV mínimo con soporte de comillas dobles. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

function normalizeType(raw: string): 'buy' | 'sell' {
  const t = raw.trim().toLowerCase();
  if (t === 'buy' || t === 'compra') return 'buy';
  if (t === 'sell' || t === 'venta') return 'sell';
  throw new Error(`Tipo inválido: "${raw}" (esperado buy/sell o compra/venta)`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const userIdx = args.indexOf('--user');
  const username = userIdx >= 0 ? args[userIdx + 1] : undefined;
  const file = args.find((a) => !a.startsWith('--') && a !== username);

  if (!file || !username) {
    console.error(
      'Uso: pnpm --filter @bv/api import:csv -- <archivo.csv> --user <username> [--dry-run]',
    );
    process.exit(1);
  }

  await connectDb();
  const user = await User.findOne({ username: username.toLowerCase() });
  if (!user) {
    console.error(`Usuario "${username}" no existe. Registralo primero en la app.`);
    process.exit(1);
  }

  const raw = parseCsv(readFileSync(file, 'utf8'));
  const header = raw[0]!.map((h) => h.trim());
  const expected = [
    'date',
    'type',
    'ticker',
    'assetName',
    'instrumentType',
    'platform',
    'currency',
    'units',
    'unitPrice',
    'notes',
  ];
  if (header.join(',') !== expected.join(',')) {
    console.error(
      `Header inválido.\n  Esperado: ${expected.join(',')}\n  Recibido: ${header.join(',')}`,
    );
    process.exit(1);
  }

  const rows: Row[] = raw.slice(1).map((r) => ({
    date: r[0]?.trim() ?? '',
    type: r[1]?.trim() ?? '',
    ticker: (r[2]?.trim() ?? '').toUpperCase(),
    assetName: r[3]?.trim() ?? '',
    instrumentType: r[4]?.trim() ?? '',
    platform: r[5]?.trim() ?? '',
    currency: (r[6]?.trim() ?? '').toUpperCase(),
    units: r[7]?.trim() ?? '',
    unitPrice: r[8]?.trim() ?? '',
    notes: r[9]?.trim() ?? '',
  }));

  // 1) Maestros y activos que falten
  const ensure = async (
    model: mongoose.Model<any>,
    filter: Record<string, unknown>,
    create: Record<string, unknown>,
    label: string,
  ): Promise<string> => {
    const found = await model.findOne(filter);
    if (found) return found.id;
    if (dryRun) return `dry-${label}`;
    const doc = await model.create(create);
    console.log(`  + creado ${label}`);
    return doc.id;
  };

  const typeIds = new Map<string, string>();
  const platformIds = new Map<string, string>();
  const currencyIds = new Map<string, string>();
  const assetIds = new Map<string, string>();

  for (const row of rows) {
    if (!typeIds.has(row.instrumentType)) {
      typeIds.set(
        row.instrumentType,
        await ensure(
          InstrumentType,
          { name: row.instrumentType },
          { name: row.instrumentType },
          `tipo "${row.instrumentType}"`,
        ),
      );
    }
    if (!platformIds.has(row.platform)) {
      platformIds.set(
        row.platform,
        await ensure(
          Platform,
          { name: row.platform },
          { name: row.platform },
          `plataforma "${row.platform}"`,
        ),
      );
    }
    if (!currencyIds.has(row.currency)) {
      currencyIds.set(
        row.currency,
        await ensure(
          Currency,
          { code: row.currency },
          { code: row.currency, name: row.currency },
          `moneda "${row.currency}"`,
        ),
      );
    }
    if (!assetIds.has(row.ticker)) {
      assetIds.set(
        row.ticker,
        await ensure(
          Asset,
          { ticker: row.ticker },
          {
            ticker: row.ticker,
            name: row.assetName || row.ticker,
            instrumentTypeId: typeIds.get(row.instrumentType),
            quoteCurrencyId: currencyIds.get(row.currency),
            providerSymbols: {},
          },
          `activo ${row.ticker}`,
        ),
      );
    }
  }

  // 2) Validación RB-02 del set completo (existentes + importadas) por activo
  const byAsset = new Map<string, ReplayOp[]>();
  const parsed = rows.map((row, i) => {
    const units = Number(row.units.replace(',', '.'));
    const unitPrice = Number(row.unitPrice.replace(',', '.'));
    const date = new Date(`${row.date}T12:00:00Z`);
    if (!Number.isFinite(units) || units <= 0)
      throw new Error(`Fila ${i + 2}: unidades inválidas "${row.units}"`);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0)
      throw new Error(`Fila ${i + 2}: precio inválido "${row.unitPrice}"`);
    if (Number.isNaN(date.getTime()))
      throw new Error(`Fila ${i + 2}: fecha inválida "${row.date}" (esperado YYYY-MM-DD)`);
    return { row, units, unitPrice, date, type: normalizeType(row.type), line: i + 2 };
  });

  for (const p of parsed) {
    const list = byAsset.get(p.row.ticker) ?? [];
    list.push({
      id: `csv-línea-${p.line}`,
      type: p.type,
      units: p.units,
      unitPrice: p.unitPrice,
      date: p.date,
      createdAt: new Date(p.line),
    });
    byAsset.set(p.row.ticker, list);
  }
  for (const [ticker, ops] of byAsset) {
    const assetId = assetIds.get(ticker)!;
    if (!dryRun) {
      const existing = await Operation.find({ assetId }).select(
        'type units unitPrice date createdAt',
      );
      for (const e of existing) {
        ops.push({
          id: e.id,
          type: e.type,
          units: e.units,
          unitPrice: e.unitPrice,
          date: e.date,
          createdAt: e.createdAt,
        });
      }
    }
    try {
      replay(ops);
    } catch (err) {
      console.error(
        `✗ ${ticker}: ${(err as Error).message} [${(err as { opId?: string }).opId ?? ''}]`,
      );
      console.error('Nada se importó. Corregí el CSV y volvé a correr.');
      process.exit(1);
    }
  }

  console.log(`Validación OK: ${parsed.length} operaciones en ${byAsset.size} activo(s).`);
  if (dryRun) {
    console.log('(dry-run: no se escribió nada)');
    await mongoose.disconnect();
    return;
  }

  // 3) Insertar
  await Operation.insertMany(
    parsed.map((p) => ({
      type: p.type,
      assetId: assetIds.get(p.row.ticker),
      platformId: platformIds.get(p.row.platform),
      units: p.units,
      currencyId: currencyIds.get(p.row.currency),
      unitPrice: p.unitPrice,
      date: p.date,
      notes: p.row.notes || undefined,
      createdBy: user.id,
    })),
  );
  console.log(`✓ Importadas ${parsed.length} operaciones como "${user.displayName}".`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
