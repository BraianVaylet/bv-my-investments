import type { FastifyInstance } from 'fastify';
import { signalRuleSchema } from '@bv/shared';
import { AppError } from '../../core/errors';
import { Asset } from '../../models/asset.model';
import { SignalRule } from '../../models/signalRule.model';

export function toSignalRuleDTO(doc: any) {
  return {
    id: doc.id,
    name: doc.name,
    description: doc.description ?? undefined,
    nature: doc.nature,
    scope: doc.scope,
    assetId: doc.assetId ? String(doc.assetId._id ?? doc.assetId) : undefined,
    assetTicker:
      doc.assetId && typeof doc.assetId === 'object' && 'ticker' in doc.assetId
        ? doc.assetId.ticker
        : undefined,
    thresholdType: doc.thresholdType,
    direction: doc.direction,
    value: doc.value,
    currency: doc.currency ?? undefined,
    enabled: doc.enabled,
  };
}

export async function signalRulesRoutes(app: FastifyInstance) {
  app.get('/signal-rules', async () => {
    const docs = await SignalRule.find().populate('assetId', 'ticker').sort({ createdAt: -1 });
    return docs.map(toSignalRuleDTO);
  });

  app.post('/signal-rules', async (request, reply) => {
    const body = signalRuleSchema.parse(request.body);
    if (body.scope === 'asset' && !(await Asset.findById(body.assetId))) {
      throw new AppError(404, 'NOT_FOUND', 'Activo no encontrado');
    }
    const doc = await SignalRule.create({
      ...body,
      assetId: body.scope === 'asset' ? body.assetId : undefined,
    });
    await doc.populate('assetId', 'ticker');
    return reply.status(201).send(toSignalRuleDTO(doc));
  });

  app.put('/signal-rules/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = signalRuleSchema.parse(request.body);
    if (body.scope === 'asset' && !(await Asset.findById(body.assetId))) {
      throw new AppError(404, 'NOT_FOUND', 'Activo no encontrado');
    }
    const doc = await SignalRule.findByIdAndUpdate(
      id,
      {
        ...body,
        assetId: body.scope === 'asset' ? body.assetId : undefined,
        ...(body.scope === 'global' ? { $unset: { assetId: 1 } } : {}),
      },
      { new: true },
    ).populate('assetId', 'ticker');
    if (!doc) throw new AppError(404, 'NOT_FOUND', 'Regla no encontrada');
    return toSignalRuleDTO(doc);
  });

  app.patch('/signal-rules/:id/toggle', async (request) => {
    const { id } = request.params as { id: string };
    const doc = await SignalRule.findById(id).populate('assetId', 'ticker');
    if (!doc) throw new AppError(404, 'NOT_FOUND', 'Regla no encontrada');
    doc.enabled = !doc.enabled;
    await doc.save();
    return toSignalRuleDTO(doc);
  });

  app.delete('/signal-rules/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = await SignalRule.findByIdAndDelete(id);
    if (!doc) throw new AppError(404, 'NOT_FOUND', 'Regla no encontrada');
    return reply.status(204).send();
  });
}
