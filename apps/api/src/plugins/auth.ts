import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from '../core/errors';

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
  }
  interface FastifyContextConfig {
    public?: boolean;
  }
}

export function signSession(user: SessionUser): string {
  return jwt.sign({ username: user.username, displayName: user.displayName }, config.jwtSecret, {
    subject: user.id,
    expiresIn: `${config.sessionDays}d`,
  });
}

export function setSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie(config.cookieName, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: config.sessionDays * 24 * 60 * 60,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(config.cookieName, { path: '/' });
}

/**
 * Auth global: toda ruta requiere sesión salvo opt-out explícito con
 * `config: { public: true }` (doc 02 §6).
 */
export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorateRequest('user', null);

  app.addHook('onRequest', async (request: FastifyRequest) => {
    const token = request.cookies[config.cookieName];
    if (token) {
      try {
        const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
        request.user = {
          id: String(payload.sub),
          username: String(payload.username),
          displayName: String(payload.displayName),
        };
      } catch {
        request.user = null;
      }
    }

    if (request.routeOptions.config?.public) return;
    if (!request.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Sesión requerida');
    }
  });

  // Mitigación CSRF adicional a SameSite: verificar Origin en mutaciones (doc 02 §6).
  // Solo en prod: en dev el proxy de Vite reescribe el Host y el check daría falso positivo.
  app.addHook('onRequest', async (request: FastifyRequest) => {
    if (!config.isProd) return;
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
    const origin = request.headers.origin;
    if (!origin) return; // requests sin Origin (curl, tests) pasan; la cookie SameSite ya protege al browser
    try {
      const originHost = new URL(origin).host;
      if (originHost !== request.host) {
        throw new AppError(403, 'BAD_ORIGIN', 'Origen no permitido');
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(403, 'BAD_ORIGIN', 'Origen inválido');
    }
  });
});
