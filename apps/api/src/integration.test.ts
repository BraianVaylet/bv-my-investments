/**
 * Tests de integración por módulo (doc 02 §7).
 * Usa el Mongo local con una DB descartable por corrida (se dropea al final).
 * Config: MONGO_TEST_URL (default mongodb://127.0.0.1:27017).
 */
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';
import { config } from './config';
import { seedMasters } from './modules/masters/routes';

const MONGO_BASE = process.env.MONGO_TEST_URL ?? 'mongodb://127.0.0.1:27017';
const DB_NAME = `bv-invest-test-${Date.now()}`;

let app: FastifyInstance;
let cookie = '';

// Los proveedores de cotizaciones no deben tocar la red en tests:
// todo fetch falla → QuoteService cae al cache (vacío) → posición sin quote.
vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network disabled in tests'));

beforeAll(async () => {
  config.inviteToken = 'invite-test';
  await mongoose.connect(`${MONGO_BASE}/${DB_NAME}`);
  await seedMasters();
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

const auth = () => ({ cookie });

describe('auth (F1)', () => {
  it('registro sin token válido → 403 INVALID_INVITE', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'braian',
        password: 'password123',
        displayName: 'Braian',
        inviteToken: 'malo',
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('INVALID_INVITE');
  });

  it('registro con token válido → 201 + cookie de sesión', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'braian',
        password: 'password123',
        displayName: 'Braian',
        inviteToken: 'invite-test',
      },
    });
    expect(res.statusCode).toBe(201);
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    cookie = String(setCookie).split(';')[0]!;
    expect(cookie).toContain('bv_session=');
  });

  it('login con contraseña incorrecta → 401 mensaje genérico', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'braian', password: 'incorrecta1' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).not.toMatch(/existe|usuario no/i);
  });

  it('acceso sin sesión → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/portfolio' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /auth/me con cookie devuelve el usuario', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(res.json().username).toBe('braian');
  });
});

describe('maestros y activos (F2/F3)', () => {
  let platformId = '';
  let cryptoTypeId = '';
  let usdId = '';
  let assetId = '';

  it('seeds presentes (instrumentos y monedas)', async () => {
    const types = await app.inject({
      method: 'GET',
      url: '/api/instrument-types',
      headers: auth(),
    });
    expect(types.json().map((t: { name: string }) => t.name)).toContain('Cripto');
    cryptoTypeId = types.json().find((t: { name: string }) => t.name === 'Cripto').id;
    const currencies = await app.inject({ method: 'GET', url: '/api/currencies', headers: auth() });
    usdId = currencies.json().find((c: { code: string }) => c.code === 'USD').id;
  });

  it('alta de plataforma y activo', async () => {
    const p = await app.inject({
      method: 'POST',
      url: '/api/platforms',
      headers: auth(),
      payload: { name: 'Binance' },
    });
    expect(p.statusCode).toBe(201);
    platformId = p.json().id;

    const a = await app.inject({
      method: 'POST',
      url: '/api/assets',
      headers: auth(),
      payload: {
        ticker: 'btc',
        name: 'Bitcoin',
        instrumentTypeId: cryptoTypeId,
        quoteCurrencyId: usdId,
      },
    });
    expect(a.statusCode).toBe(201);
    expect(a.json().ticker).toBe('BTC'); // normalizado a mayúsculas
    assetId = a.json().id;
  });

  it('ticker duplicado → 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/assets',
      headers: auth(),
      payload: {
        ticker: 'BTC',
        name: 'Otro',
        instrumentTypeId: cryptoTypeId,
        quoteCurrencyId: usdId,
      },
    });
    expect(res.statusCode).toBe(409);
  });

  it('operación de compra → 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/operations',
      headers: auth(),
      payload: {
        type: 'buy',
        assetId,
        platformId,
        units: 1,
        currencyId: usdId,
        unitPrice: 50000,
        date: '2025-01-10',
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it('RB-07: borrar maestro en uso → 409 IN_USE con conteo; archivar sí funciona', async () => {
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/platforms/${platformId}`,
      headers: auth(),
    });
    expect(del.statusCode).toBe(409);
    expect(del.json().error.code).toBe('IN_USE');
    expect(del.json().error.details.usedBy.operations).toBe(1);

    const arch = await app.inject({
      method: 'PATCH',
      url: `/api/platforms/${platformId}/archive`,
      headers: auth(),
    });
    expect(arch.statusCode).toBe(200);
    expect(arch.json().archived).toBe(true);

    // archivado no aparece en el listado default, sí con includeArchived
    const list = await app.inject({ method: 'GET', url: '/api/platforms', headers: auth() });
    expect(list.json()).toHaveLength(0);
    const all = await app.inject({
      method: 'GET',
      url: '/api/platforms?includeArchived=true',
      headers: auth(),
    });
    expect(all.json()).toHaveLength(1);
  });

  it('RB-02: vender más que la tenencia a la fecha → 422 INSUFFICIENT_UNITS', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/operations',
      headers: auth(),
      payload: {
        type: 'sell',
        assetId,
        platformId,
        units: 2,
        currencyId: usdId,
        unitPrice: 60000,
        date: '2025-02-01',
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('INSUFFICIENT_UNITS');
  });

  it('borrar una compra que respalda ventas → 409', async () => {
    const sell = await app.inject({
      method: 'POST',
      url: '/api/operations',
      headers: auth(),
      payload: {
        type: 'sell',
        assetId,
        platformId,
        units: 0.5,
        currencyId: usdId,
        unitPrice: 60000,
        date: '2025-02-01',
      },
    });
    expect(sell.statusCode).toBe(201);

    const ops = await app.inject({
      method: 'GET',
      url: `/api/operations?assetId=${assetId}&type=buy`,
      headers: auth(),
    });
    const buyId = ops.json().items[0].id;
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/operations/${buyId}`,
      headers: auth(),
    });
    expect(del.statusCode).toBe(409);
    expect(del.json().error.code).toBe('BREAKS_HISTORY');
  });

  it('el realizado de la venta viene derivado en el listado', async () => {
    const ops = await app.inject({
      method: 'GET',
      url: `/api/operations?type=sell`,
      headers: auth(),
    });
    const sell = ops.json().items[0];
    expect(sell.realized).toBe(5000); // (60000 - 50000) × 0.5
    expect(sell.realizedPct).toBe(20);
  });
});

describe('portfolio y settings (F6/F9)', () => {
  it('summary calcula sin cotizaciones (red deshabilitada): quote null, invertido OK', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/portfolio/summary?currency=USD',
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    const s = res.json();
    expect(s.invested).toBe(25000); // 0.5 BTC × PPC 50000
    expect(s.realized).toBe(5000);
    expect(s.quotesMissing).toBe(1); // sin red no hay quote
  });

  it('PUT /settings persiste umbrales', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: auth(),
      payload: {
        fxKind: 'mep',
        sellSignalPct: 50,
        near52wPct: 5,
        dailyMovePct: 5,
        defaultDisplayCurrency: 'USD',
        preferredProviders: {},
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().fxKind).toBe('mep');
    const get = await app.inject({ method: 'GET', url: '/api/settings', headers: auth() });
    expect(get.json().sellSignalPct).toBe(50);
  });
});
