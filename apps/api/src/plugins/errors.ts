import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { AppError, DomainError } from '../core/errors';

/** Formato de error uniforme: { error: { code, message, details? } } (doc 02 §5). */
export const errorsPlugin = fp(async (app: FastifyInstance) => {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) {
      return reply
        .status(err.statusCode)
        .send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION',
          message: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          details: err.issues,
        },
      });
    }
    if (err instanceof DomainError) {
      return reply.status(422).send({ error: { code: err.code, message: err.message } });
    }
    // errores propios de fastify (rate limit, body inválido, etc.)
    const fErr = err as { statusCode?: number; code?: string; message?: string };
    if (fErr.statusCode && fErr.statusCode < 500) {
      return reply.status(fErr.statusCode).send({
        error: { code: fErr.code ?? 'BAD_REQUEST', message: fErr.message ?? 'Solicitud inválida' },
      });
    }
    app.log.error(err as Error);
    return reply
      .status(500)
      .send({ error: { code: 'INTERNAL', message: 'Error interno del servidor' } });
  });
});
