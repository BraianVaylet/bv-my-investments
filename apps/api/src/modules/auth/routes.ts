import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { FastifyInstance } from 'fastify';
import { loginSchema, registerSchema } from '@bv/shared';
import { config } from '../../config';
import { AppError } from '../../core/errors';
import { User } from '../../models/user.model';
import { clearSessionCookie, setSessionCookie, signSession } from '../../plugins/auth';

const scrypt = promisify(scryptCb) as (pwd: string, salt: Buffer, len: number) => Promise<Buffer>;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const hash = await scrypt(password, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(hashHex, 'hex');
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

const authRateLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } };

export async function authRoutes(app: FastifyInstance) {
  app.post(
    '/auth/register',
    { config: { public: true, ...authRateLimit } },
    async (request, reply) => {
      const body = registerSchema.parse(request.body);
      if (body.inviteToken !== config.inviteToken) {
        throw new AppError(403, 'INVALID_INVITE', 'Token de invitación inválido');
      }
      const existing = await User.findOne({ username: body.username });
      if (existing) {
        throw new AppError(409, 'USERNAME_TAKEN', 'Ese nombre de usuario ya existe');
      }
      const user = await User.create({
        username: body.username,
        displayName: body.displayName,
        passwordHash: await hashPassword(body.password),
      });
      const session = { id: user.id, username: user.username, displayName: user.displayName };
      setSessionCookie(reply, signSession(session));
      return reply.status(201).send(session);
    },
  );

  app.post(
    '/auth/login',
    { config: { public: true, ...authRateLimit } },
    async (request, reply) => {
      const body = loginSchema.parse(request.body);
      const user = await User.findOne({ username: body.username.toLowerCase() });
      // Mensaje genérico: no revelar si el usuario existe (doc 02 §5).
      const invalid = new AppError(401, 'INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos');
      if (!user) throw invalid;
      const ok = await verifyPassword(body.password, user.passwordHash);
      if (!ok) throw invalid;
      const session = { id: user.id, username: user.username, displayName: user.displayName };
      setSessionCookie(reply, signSession(session));
      return session;
    },
  );

  app.post('/auth/logout', async (_request, reply) => {
    clearSessionCookie(reply);
    return reply.status(204).send();
  });

  app.get('/auth/me', async (request) => request.user);
}
