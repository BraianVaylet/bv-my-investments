import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { corporateEventSchema } from '@bv/shared';
import { AppError } from '../../core/errors';
import { validateOps, type CorporateEventInput, type ReplayOp } from '../../core/position';
import { Asset } from '../../models/asset.model';
import { CorporateEvent } from '../../models/corporateEvent.model';
import { Operation } from '../../models/operation.model';

export function toCorporateEventDTO(doc: any) {
  return {
    id: doc.id,
    assetId: String(doc.assetId),
    type: doc.type,
    date: doc.date.toISOString(),
    factor: doc.factor,
    notes: doc.notes ?? undefined,
  };
}

/** Eventos del activo como input del motor. */
export async function loadCorporateEvents(assetId: string): Promise<CorporateEventInput[]> {
  const docs = await CorporateEvent.find({ assetId }).select('date factor');
  return docs.map((d) => ({ id: d.id, date: d.date, factor: d.factor }));
}

/** Todos los eventos agrupados por activo (para el portafolio). */
export async function loadAllCorporateEvents(): Promise<Map<string, CorporateEventInput[]>> {
  const docs = await CorporateEvent.find().select('assetId date factor');
  const byAsset = new Map<string, CorporateEventInput[]>();
  for (const d of docs) {
    const key = String(d.assetId);
    const list = byAsset.get(key) ?? [];
    list.push({ id: d.id, date: d.date, factor: d.factor });
    byAsset.set(key, list);
  }
  return byAsset;
}

async function loadReplayOps(assetId: string): Promise<ReplayOp[]> {
  const docs = await Operation.find({ assetId }).select('type units unitPrice date createdAt');
  return docs.map((d) => ({
    id: d.id,
    type: d.type,
    units: d.units,
    unitPrice: d.unitPrice,
    date: d.date,
    createdAt: d.createdAt,
  }));
}

export async function corporateEventsRoutes(app: FastifyInstance) {
  app.get('/corporate-events', async (request) => {
    const q = z.object({ assetId: z.string().optional() }).parse(request.query);
    const filter = q.assetId ? { assetId: q.assetId } : {};
    const docs = await CorporateEvent.find(filter).sort({ date: -1 });
    return docs.map(toCorporateEventDTO);
  });

  app.post('/corporate-events', async (request, reply) => {
    const body = corporateEventSchema.parse(request.body);
    const asset = await Asset.findById(body.assetId);
    if (!asset) throw new AppError(404, 'NOT_FOUND', 'Activo no encontrado');

    // Un factor < 1 reduce unidades: validar que no deje ventas sin respaldo (RB-02)
    const ops = await loadReplayOps(body.assetId);
    const events = await loadCorporateEvents(body.assetId);
    events.push({ id: 'new', date: body.date, factor: body.factor });
    const err = validateOps(ops, events);
    if (err) {
      throw new AppError(
        422,
        'INSUFFICIENT_UNITS',
        `El evento dejaría ventas sin respaldo: ${err.message}`,
      );
    }

    const doc = await CorporateEvent.create({ ...body, createdBy: request.user!.id });
    return reply.status(201).send(toCorporateEventDTO(doc));
  });

  app.delete('/corporate-events/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = await CorporateEvent.findById(id);
    if (!doc) throw new AppError(404, 'NOT_FOUND', 'Evento no encontrado');

    // Quitar un evento con factor > 1 reduce unidades: validar consistencia
    const ops = await loadReplayOps(String(doc.assetId));
    const events = (await loadCorporateEvents(String(doc.assetId))).filter((e) => e.id !== id);
    const err = validateOps(ops, events);
    if (err) {
      throw new AppError(
        409,
        'BREAKS_HISTORY',
        `No se puede borrar: dejaría ventas sin respaldo. ${err.message}`,
      );
    }

    await doc.deleteOne();
    return reply.status(204).send();
  });
}
