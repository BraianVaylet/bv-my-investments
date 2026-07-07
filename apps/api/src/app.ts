import path from 'node:path';
import { existsSync } from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { config } from './config';
import { authPlugin } from './plugins/auth';
import { errorsPlugin } from './plugins/errors';
import { authRoutes } from './modules/auth/routes';
import { assetsRoutes } from './modules/assets/routes';
import { corporateEventsRoutes } from './modules/corporate-events/routes';
import { signalRulesRoutes } from './modules/signal-rules/routes';
import { mastersRoutes } from './modules/masters/routes';
import { operationsRoutes } from './modules/operations/routes';
import { portfolioRoutes } from './modules/portfolio/routes';
import { quotesRoutes } from './modules/quotes/routes';
import { settingsRoutes } from './modules/settings/routes';
import { signalsRoutes } from './modules/signals/routes';
import { statsRoutes } from './modules/stats/routes';
import { takeSnapshot } from './modules/snapshots/service';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test', trustProxy: true });

  await app.register(helmet, {
    contentSecurityPolicy: config.isProd ? undefined : false,
  });
  await app.register(cors, {
    origin: config.isProd ? false : true, // en prod FE y API comparten origen; en dev Vite proxy
    credentials: true,
  });
  await app.register(cookie);
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(errorsPlugin);
  await app.register(authPlugin);

  // API → no-store (lección Railway CDN: sesiones por cookie, doc 02 §8)
  app.addHook('onSend', async (request, reply) => {
    if (request.url.startsWith('/api')) {
      reply.header('cache-control', 'no-store, private');
    }
  });

  await app.register(
    async (api) => {
      api.get('/health', { config: { public: true } }, async () => ({ status: 'ok' }));

      await api.register(authRoutes);
      await api.register(mastersRoutes);
      await api.register(assetsRoutes);
      await api.register(operationsRoutes);
      await api.register(portfolioRoutes);
      await api.register(quotesRoutes);
      await api.register(statsRoutes);
      await api.register(signalsRoutes);
      await api.register(signalRulesRoutes);
      await api.register(corporateEventsRoutes);
      await api.register(settingsRoutes);

      // Disparo manual del snapshot (útil para probar y para el cron externo de Railway)
      api.post('/snapshots/run', async () => {
        await takeSnapshot();
        return { ok: true };
      });
    },
    { prefix: '/api' },
  );

  // Estáticos del build del FE (deploy single-service, doc 02 §8)
  const webDist = path.resolve(__dirname, '../../web/dist');
  if (config.isProd && existsSync(webDist)) {
    await app.register(fastifyStatic, {
      root: webDist,
      setHeaders(res, filePath) {
        // assets con hash → immutable; index.html → no-cache
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('cache-control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('cache-control', 'no-cache');
        }
      },
    });
    // SPA fallback para rutas del router
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api')) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } });
      }
      return reply.header('cache-control', 'no-cache').sendFile('index.html');
    });
  }

  return app;
}
