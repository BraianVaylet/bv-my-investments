import type { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import { operationCreateSchema, operationFiltersSchema, operationUpdateSchema } from '@bv/shared';
import { AppError } from '../../core/errors';
import { replay, validateOps, type ReplayOp } from '../../core/position';
import { Asset } from '../../models/asset.model';
import { Operation } from '../../models/operation.model';
import { toOperationDTO } from './dto';

/** Trae las operaciones de un activo como input del motor de cálculo. */
async function loadReplayOps(assetId: string): Promise<ReplayOp[]> {
  const docs = await Operation.find({ assetId }).select(
    'type units unitPrice date createdAt platformId',
  );
  return docs.map((d) => ({
    id: d.id,
    type: d.type,
    units: d.units,
    unitPrice: d.unitPrice,
    date: d.date,
    createdAt: d.createdAt,
  }));
}

/**
 * RB-02 sobre el set resultante: simula el alta/edición/borrado y valida por replay.
 * `statusCode`: 422 para alta/edición, 409 para borrado (doc 02 §5).
 */
function assertValidSet(ops: ReplayOp[], statusCode: 422 | 409) {
  const err = validateOps(ops);
  if (err) {
    throw new AppError(
      statusCode,
      statusCode === 409 ? 'BREAKS_HISTORY' : 'INSUFFICIENT_UNITS',
      statusCode === 409
        ? `No se puede: dejaría ventas posteriores sin respaldo. ${err.message}`
        : err.message,
    );
  }
}

/**
 * v1: todas las operaciones de un activo deben compartir moneda mientras haya
 * historia (el replay corre en la moneda de operación, doc 02 §3).
 */
async function assertCurrencyConsistent(assetId: string, currencyId: string, excludeOpId?: string) {
  const filter: Record<string, unknown> = { assetId };
  if (excludeOpId) filter._id = { $ne: excludeOpId };
  const other = await Operation.findOne(filter).select('currencyId');
  if (other && String(other.currencyId) !== currencyId) {
    throw new AppError(
      422,
      'CURRENCY_MISMATCH',
      'El activo ya tiene operaciones en otra moneda. Todas las operaciones de un activo deben usar la misma moneda.',
    );
  }
}

export async function operationsRoutes(app: FastifyInstance) {
  app.get('/operations', async (request) => {
    const q = operationFiltersSchema.parse(request.query);
    const filter: Record<string, unknown> = {};
    if (q.type) filter.type = q.type;
    if (q.assetId) filter.assetId = q.assetId;
    if (q.platformId) filter.platformId = q.platformId;
    if (q.from || q.to) {
      filter.date = {
        ...(q.from ? { $gte: q.from } : {}),
        ...(q.to ? { $lte: q.to } : {}),
      };
    }

    const [docs, total] = await Promise.all([
      Operation.find(filter)
        .populate(['assetId', 'platformId', 'currencyId', 'createdBy'])
        .sort({ date: -1, createdAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit),
      Operation.countDocuments(filter),
    ]);

    // Resultado realizado por venta: derivado por replay del activo (RB-06).
    const sellAssetIds = [
      ...new Set(
        docs.filter((d) => d.type === 'sell').map((d) => String(d.assetId._id ?? d.assetId)),
      ),
    ];
    const eventsByOp = new Map<string, import('../../core/position').SellEvent>();
    for (const assetId of sellAssetIds) {
      try {
        const state = replay(await loadReplayOps(assetId));
        for (const ev of state.sellEvents) eventsByOp.set(ev.opId, ev);
      } catch {
        // set inconsistente: se omite el realizado, no se rompe el listado
      }
    }

    return {
      items: docs.map((d) => toOperationDTO(d, undefined, eventsByOp.get(d.id))),
      page: q.page,
      limit: q.limit,
      total,
    };
  });

  app.post('/operations', async (request, reply) => {
    const body = operationCreateSchema.parse(request.body);
    const asset = await Asset.findById(body.assetId);
    if (!asset) throw new AppError(404, 'NOT_FOUND', 'Activo no encontrado');
    await assertCurrencyConsistent(body.assetId, body.currencyId);

    const existing = await loadReplayOps(body.assetId);
    existing.push({
      id: 'new',
      type: body.type,
      units: body.units,
      unitPrice: body.unitPrice,
      date: body.date,
      createdAt: new Date(),
    });
    assertValidSet(existing, 422);

    const doc = await Operation.create({ ...body, createdBy: request.user!.id });
    await doc.populate(['assetId', 'platformId', 'currencyId', 'createdBy']);
    return reply.status(201).send(toOperationDTO(doc));
  });

  app.put('/operations/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = operationUpdateSchema.parse(request.body);
    const doc = await Operation.findById(id);
    if (!doc) throw new AppError(404, 'NOT_FOUND', 'Operación no encontrada');

    const targetAssetId = body.assetId ?? String(doc.assetId);
    const targetCurrencyId = body.currencyId ?? String(doc.currencyId);
    if (body.assetId && !(await Asset.findById(body.assetId))) {
      throw new AppError(404, 'NOT_FOUND', 'Activo no encontrado');
    }
    await assertCurrencyConsistent(targetAssetId, targetCurrencyId, id);

    const edited: ReplayOp = {
      id,
      type: body.type ?? doc.type,
      units: body.units ?? doc.units,
      unitPrice: body.unitPrice ?? doc.unitPrice,
      date: body.date ?? doc.date,
      createdAt: doc.createdAt,
    };

    if (targetAssetId !== String(doc.assetId)) {
      // cambió de activo: validar el viejo sin la op y el nuevo con la op
      const oldSet = (await loadReplayOps(String(doc.assetId))).filter((o) => o.id !== id);
      assertValidSet(oldSet, 422);
      const newSet = await loadReplayOps(targetAssetId);
      newSet.push(edited);
      assertValidSet(newSet, 422);
    } else {
      const set = (await loadReplayOps(targetAssetId)).filter((o) => o.id !== id);
      set.push(edited);
      assertValidSet(set, 422);
    }

    Object.assign(doc, body);
    if (body.assetId) doc.assetId = new Types.ObjectId(body.assetId);
    if (body.platformId) doc.platformId = new Types.ObjectId(body.platformId);
    if (body.currencyId) doc.currencyId = new Types.ObjectId(body.currencyId);
    await doc.save();
    await doc.populate(['assetId', 'platformId', 'currencyId', 'createdBy']);
    return toOperationDTO(doc);
  });

  app.delete('/operations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = await Operation.findById(id);
    if (!doc) throw new AppError(404, 'NOT_FOUND', 'Operación no encontrada');

    const remaining = (await loadReplayOps(String(doc.assetId))).filter((o) => o.id !== id);
    assertValidSet(remaining, 409);

    await doc.deleteOne();
    return reply.status(204).send();
  });
}
