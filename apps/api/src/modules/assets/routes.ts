import type { FastifyInstance } from 'fastify';
import { assetCreateSchema, assetUpdateSchema } from '@bv/shared';
import { AppError } from '../../core/errors';
import { replay } from '../../core/position';
import { Asset } from '../../models/asset.model';
import { Operation } from '../../models/operation.model';
import { toOperationDTO } from '../operations/dto';
import { buildPositionDTO } from '../portfolio/service';
import { getPriceHistory } from '../quotes/history';
import { toProviderAsset } from '../quotes/service';

export function toAssetDTO(doc: any) {
  const it = doc.instrumentTypeId;
  const cur = doc.quoteCurrencyId;
  return {
    id: doc.id,
    ticker: doc.ticker,
    name: doc.name,
    instrumentTypeId: typeof it === 'object' && it ? String(it._id) : String(it),
    instrumentTypeName: typeof it === 'object' && it ? it.name : undefined,
    quoteCurrencyId: typeof cur === 'object' && cur ? String(cur._id) : String(cur),
    quoteCurrencyCode: typeof cur === 'object' && cur ? cur.code : undefined,
    providerSymbols: doc.providerSymbols ?? {},
    cedearRatio: doc.cedearRatio ?? null,
    archived: doc.archived,
  };
}

const populated = ['instrumentTypeId', 'quoteCurrencyId'];

export async function assetsRoutes(app: FastifyInstance) {
  app.get('/assets', async (request) => {
    const { includeArchived, search } = request.query as {
      includeArchived?: string;
      search?: string;
    };
    const filter: Record<string, unknown> = {};
    if (includeArchived !== 'true') filter.archived = false;
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ ticker: rx }, { name: rx }];
    }
    const docs = await Asset.find(filter).populate(populated).sort({ ticker: 1 });
    return docs.map(toAssetDTO);
  });

  app.get('/assets/:id', async (request) => {
    const { id } = request.params as { id: string };
    const doc = await Asset.findById(id).populate(populated);
    if (!doc) throw new AppError(404, 'NOT_FOUND', 'Activo no encontrado');

    const ops = await Operation.find({ assetId: id })
      .populate(['platformId', 'currencyId', 'createdBy'])
      .sort({ date: -1, createdAt: -1 });

    const replayInput = ops.map((o) => ({
      id: o.id,
      type: o.type,
      units: o.units,
      unitPrice: o.unitPrice,
      date: o.date,
      createdAt: o.createdAt,
    }));
    let position = null;
    try {
      const state = replay(replayInput);
      if (state.totalBought > 0) {
        position = await buildPositionDTO(doc, state, ops, 'ARS');
      }
    } catch {
      // set inconsistente (no debería pasar: se valida en cada alta/edición)
    }

    return {
      ...toAssetDTO(doc),
      position,
      operations: ops.slice(0, 20).map((o) => toOperationDTO(o, doc.ticker)),
    };
  });

  // RF-7.3: histórico de precios para el gráfico (con marcas de operaciones en el FE)
  app.get('/assets/:id/price-history', async (request) => {
    const { id } = request.params as { id: string };
    const doc = await Asset.findById(id).populate(populated);
    if (!doc) throw new AppError(404, 'NOT_FOUND', 'Activo no encontrado');
    const history = await getPriceHistory(toProviderAsset(doc));
    return history ?? { points: [], provider: null, currency: null };
  });

  app.post('/assets', async (request, reply) => {
    const body = assetCreateSchema.parse(request.body);
    const dup = await Asset.findOne({ ticker: body.ticker });
    if (dup) throw new AppError(409, 'DUPLICATE', `Ya existe un activo con ticker ${body.ticker}`);
    const doc = await Asset.create(body);
    await doc.populate(populated);
    return reply.status(201).send(toAssetDTO(doc));
  });

  app.put('/assets/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = assetUpdateSchema.parse(request.body);
    if (body.ticker) {
      const dup = await Asset.findOne({ ticker: body.ticker, _id: { $ne: id } });
      if (dup)
        throw new AppError(409, 'DUPLICATE', `Ya existe un activo con ticker ${body.ticker}`);
    }
    const doc = await Asset.findByIdAndUpdate(id, body, { new: true }).populate(populated);
    if (!doc) throw new AppError(404, 'NOT_FOUND', 'Activo no encontrado');
    return toAssetDTO(doc);
  });

  for (const [action, archived] of [
    ['archive', true],
    ['unarchive', false],
  ] as const) {
    app.patch(`/assets/:id/${action}`, async (request) => {
      const { id } = request.params as { id: string };
      const doc = await Asset.findByIdAndUpdate(id, { archived }, { new: true }).populate(
        populated,
      );
      if (!doc) throw new AppError(404, 'NOT_FOUND', 'Activo no encontrado');
      return toAssetDTO(doc);
    });
  }

  app.delete('/assets/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = await Asset.findById(id);
    if (!doc) throw new AppError(404, 'NOT_FOUND', 'Activo no encontrado');
    const operations = await Operation.countDocuments({ assetId: id });
    if (operations > 0) {
      throw new AppError(
        409,
        'IN_USE',
        `No se puede borrar: tiene ${operations} operación(es). Podés archivarlo.`,
        { usedBy: { assets: 0, operations } },
      );
    }
    await doc.deleteOne();
    return reply.status(204).send();
  });
}
