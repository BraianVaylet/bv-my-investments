import type { FastifyInstance } from 'fastify';
import { settingsSchema } from '@bv/shared';
import { getSettings } from '../../models/settings.model';

function toDTO(doc: any) {
  return {
    preferredProviders: Object.fromEntries(doc.preferredProviders ?? new Map()),
    fxKind: doc.fxKind,
    sellSignalPct: doc.sellSignalPct,
    near52wPct: doc.near52wPct,
    dailyMovePct: doc.dailyMovePct,
    defaultDisplayCurrency: doc.defaultDisplayCurrency,
  };
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/settings', async () => toDTO(await getSettings()));

  app.put('/settings', async (request) => {
    const body = settingsSchema.parse(request.body);
    const current = await getSettings();
    current.set({
      ...body,
      preferredProviders: new Map(Object.entries(body.preferredProviders)),
    });
    await current.save();
    return toDTO(current);
  });
}
