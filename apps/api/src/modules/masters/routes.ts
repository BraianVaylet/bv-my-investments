import type { FastifyInstance } from 'fastify';
import type { Model } from 'mongoose';
import type { ZodTypeAny } from 'zod';
import { currencyCreateSchema, masterCreateSchema } from '@bv/shared';
import { AppError } from '../../core/errors';
import { Asset } from '../../models/asset.model';
import { Currency, InstrumentType, Platform } from '../../models/masters.model';
import { Operation } from '../../models/operation.model';

interface Usage {
  assets: number;
  operations: number;
}

interface MasterConfig {
  prefix: string;
  model: Model<any>;
  createSchema: ZodTypeAny;
  usage: (id: string) => Promise<Usage>;
}

function toDTO(doc: any) {
  return {
    id: doc.id,
    name: doc.name,
    ...(doc.code !== undefined ? { code: doc.code } : {}),
    archived: doc.archived,
  };
}

/** CRUD genérico para los tres maestros: mismas reglas RB-07 (doc 01 M2). */
function registerMaster(app: FastifyInstance, cfg: MasterConfig) {
  const { prefix, model, createSchema, usage } = cfg;

  app.get(`${prefix}`, async (request) => {
    const { includeArchived } = request.query as { includeArchived?: string };
    const filter = includeArchived === 'true' ? {} : { archived: false };
    const docs = await model.find(filter).sort({ name: 1 });
    return docs.map(toDTO);
  });

  app.post(`${prefix}`, async (request, reply) => {
    const body = createSchema.parse(request.body);
    const dup = await model.findOne({ name: body.name });
    if (dup) throw new AppError(409, 'DUPLICATE', 'Ya existe un registro con ese nombre');
    const doc = await model.create(body);
    return reply.status(201).send(toDTO(doc));
  });

  app.put(`${prefix}/:id`, async (request) => {
    const { id } = request.params as { id: string };
    const body = createSchema.parse(request.body);
    const dup = await model.findOne({ name: body.name, _id: { $ne: id } });
    if (dup) throw new AppError(409, 'DUPLICATE', 'Ya existe un registro con ese nombre');
    const doc = await model.findByIdAndUpdate(id, body, { new: true });
    if (!doc) throw new AppError(404, 'NOT_FOUND', 'No encontrado');
    return toDTO(doc);
  });

  for (const [action, archived] of [
    ['archive', true],
    ['unarchive', false],
  ] as const) {
    app.patch(`${prefix}/:id/${action}`, async (request) => {
      const { id } = request.params as { id: string };
      const doc = await model.findByIdAndUpdate(id, { archived }, { new: true });
      if (!doc) throw new AppError(404, 'NOT_FOUND', 'No encontrado');
      return toDTO(doc);
    });
  }

  app.delete(`${prefix}/:id`, async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = await model.findById(id);
    if (!doc) throw new AppError(404, 'NOT_FOUND', 'No encontrado');
    const usedBy = await usage(id);
    if (usedBy.assets > 0 || usedBy.operations > 0) {
      throw new AppError(
        409,
        'IN_USE',
        `No se puede borrar: en uso por ${usedBy.assets} activo(s) y ${usedBy.operations} operación(es). Podés archivarlo.`,
        { usedBy },
      );
    }
    await doc.deleteOne();
    return reply.status(204).send();
  });
}

export async function mastersRoutes(app: FastifyInstance) {
  registerMaster(app, {
    prefix: '/instrument-types',
    model: InstrumentType,
    createSchema: masterCreateSchema,
    usage: async (id) => ({
      assets: await Asset.countDocuments({ instrumentTypeId: id }),
      operations: 0,
    }),
  });

  registerMaster(app, {
    prefix: '/platforms',
    model: Platform,
    createSchema: masterCreateSchema,
    usage: async (id) => ({
      assets: 0,
      operations: await Operation.countDocuments({ platformId: id }),
    }),
  });

  registerMaster(app, {
    prefix: '/currencies',
    model: Currency,
    createSchema: currencyCreateSchema,
    usage: async (id) => ({
      assets: await Asset.countDocuments({ quoteCurrencyId: id }),
      operations: await Operation.countDocuments({ currencyId: id }),
    }),
  });
}

/** Semillas iniciales (RF-2.5). Idempotente: solo si la colección está vacía. */
export async function seedMasters() {
  if ((await InstrumentType.countDocuments()) === 0) {
    await InstrumentType.insertMany(
      ['Cripto', 'Acción', 'CEDEAR', 'FCI', 'Bono'].map((name) => ({ name })),
    );
  }
  if ((await Currency.countDocuments()) === 0) {
    await Currency.insertMany([
      { name: 'Peso argentino', code: 'ARS' },
      { name: 'Dólar estadounidense', code: 'USD' },
    ]);
  }
}
