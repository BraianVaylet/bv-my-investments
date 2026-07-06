import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../core/errors';
import { Asset } from '../../models/asset.model';
import { getSettings } from '../../models/settings.model';
import { getFx } from './fx';
import { getQuotes, toProviderAsset } from './service';

export async function quotesRoutes(app: FastifyInstance) {
  // RF-6.2: refresco manual (fuerza bypass del cache)
  app.post('/quotes/refresh', async (request) => {
    const q = z.object({ assetId: z.string().optional() }).parse(request.query);
    const filter: Record<string, unknown> = q.assetId ? { _id: q.assetId } : { archived: false };
    const assets = await Asset.find(filter).populate(['instrumentTypeId', 'quoteCurrencyId']);
    if (q.assetId && assets.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Activo no encontrado');
    }
    const quotes = await getQuotes(assets.map(toProviderAsset), { force: true });
    return {
      refreshed: quotes.size,
      requested: assets.length,
      quotes: Object.fromEntries(
        [...quotes.entries()].map(([assetId, quote]) => [
          assetId,
          { ...quote, fetchedAt: quote.fetchedAt.toISOString() },
        ]),
      ),
    };
  });

  // Dólar vigente del tipo configurado (RB-10)
  app.get('/fx', async () => {
    const settings = await getSettings();
    const fx = await getFx(settings.fxKind);
    if (!fx) {
      throw new AppError(503, 'FX_UNAVAILABLE', 'No hay cotización del dólar disponible');
    }
    return { ...fx, fetchedAt: fx.fetchedAt.toISOString() };
  });
}
