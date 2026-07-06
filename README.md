# BV Invest

Web app de gestión y seguimiento de inversiones personales. Reemplaza la planilla de Google Sheets:
las **operaciones son la fuente de verdad** y todo lo demás (tenencias, PPC, resultados, estadísticas,
señales) se deriva por cálculo. Ver documentación completa en [`docs/`](docs/).

## Stack

- **Monorepo pnpm**: `apps/api` (Fastify + Mongoose + TypeScript), `apps/web` (React 18 + Vite + Tailwind v4 + TanStack Query), `packages/shared` (schemas Zod + tipos compartidos FE/BE).
- **Motor de cálculo** (`apps/api/src/core/`): replay puro de operaciones con costo promedio ponderado (WAC). Sin IO, testeado con Vitest.
- **Cotizaciones**: adapters con fallback — data912, CoinGecko, Binance, CriptoYa, Yahoo, ArgentinaDatos (FCI) — y dólar CCL/MEP/oficial vía DolarApi. Cache en Mongo con TTL por horario de mercado.

## Setup local

Requisitos: Node 20+, pnpm 9+, MongoDB local (o Atlas).

```bash
pnpm install
cp .env.example .env        # completar MONGO_URL, JWT_SECRET, INVITE_TOKEN
pnpm build                  # compila shared + api + web

pnpm dev:api                # API en http://localhost:3000
pnpm dev:web                # FE en http://localhost:5173 (proxy /api -> 3000)
```

Primer uso: registrarse desde `/register` con el `INVITE_TOKEN` configurado (RF-1.1; solo 2 cuentas previstas).
Los maestros se siembran solos (instrumentos y monedas); cargar plataformas y activos desde **Más → Maestros / Activos**.

## Scripts

| Comando                         | Qué hace                                         |
| ------------------------------- | ------------------------------------------------ |
| `pnpm build`                    | Build completo en orden de dependencias          |
| `pnpm test`                     | Tests: motor de cálculo, adapters (fixtures) e integración de API (usa Mongo local, DB descartable; `MONGO_TEST_URL` para otro host) |
| `pnpm typecheck`                | TypeScript estricto en todos los paquetes        |
| `pnpm lint` / `pnpm format`     | ESLint (flat config) / Prettier                  |
| `pnpm dev:api` / `pnpm dev:web` | Dev servers                                      |

## Migración desde la planilla (CSV)

Importa el histórico como operaciones, creando maestros y activos que falten. Valida RB-02 sobre el
set completo **antes** de escribir: si una venta supera la tenencia a su fecha, aborta sin tocar nada.

```bash
pnpm --filter @bv/api import:csv -- operaciones.csv --user braian --dry-run   # solo validar
pnpm --filter @bv/api import:csv -- operaciones.csv --user braian             # importar
```

Formato (header obligatorio):

```csv
date,type,ticker,assetName,instrumentType,platform,currency,units,unitPrice,notes
2023-05-10,compra,BTC,Bitcoin,Cripto,Binance,USD,0.05,27000,DCA
2024-01-15,venta,BTC,Bitcoin,Cripto,Binance,USD,0.02,42000,
```

`type` acepta `buy/sell` o `compra/venta`; decimales con punto o coma.

## PWA

Manifest + service worker básico (solo activo en build de producción): instalable en el teléfono,
assets cacheados, shell offline. La API nunca se cachea. Para publicar una versión nueva del shell,
subir el número en `CACHE` de [apps/web/public/sw.js](apps/web/public/sw.js).

## Variables de entorno

| Variable            | Descripción                                                           |
| ------------------- | --------------------------------------------------------------------- |
| `MONGO_URL`         | Conexión MongoDB                                                      |
| `JWT_SECRET`        | Firma de la cookie de sesión (httpOnly, SameSite=Lax)                 |
| `INVITE_TOKEN`      | Token requerido para registrarse                                      |
| `PORT`              | Puerto de la API (default 3000)                                       |
| `COINGECKO_API_KEY` | Opcional, key demo de CoinGecko                                       |
| `NODE_ENV`          | `production` activa: cookie Secure, check de Origin, estáticos del FE |

## Deploy (Railway)

1. Servicio Node: build `pnpm install && pnpm build`, start `node apps/api/dist/index.js`, con `NODE_ENV=production`.
   La API sirve el build del FE (`apps/web/dist`) con cache correcto (assets `immutable`, API `no-store`).
2. MongoDB: plugin de Railway o Atlas M0 (recomendado: sobrevive migraciones de hosting).
3. Snapshot diario: cron interno a las 21:00 ART (requiere sleep apagado) o cron externo de Railway
   llamando `POST /api/snapshots/run`.
4. Healthcheck: `GET /api/health`.
5. **Backup de Mongo**: dump programado (cron externo o job de Railway):
   ```bash
   mongodump --uri "$MONGO_URL" --archive=backup-$(date +%F).gz --gzip
   ```
   Con Atlas M0 alcanza con exportes periódicos; a partir de M2 hay backups automáticos del lado de Atlas.

## Estructura

```
apps/api/src/
├── core/         # motor de cálculo puro (position.ts, money.ts) + tests
├── models/       # Mongoose (users, masters, assets, operations, quotes, fx, snapshots, settings)
├── modules/      # auth, masters, assets, operations, portfolio, quotes, stats, signals, settings, snapshots
├── plugins/      # auth global (opt-out con { public: true }), error handler uniforme
└── providers/    # adapters de cotizaciones (interfaz QuoteProvider)
apps/web/src/
├── components/   # ui kit + layout (bottom tabs, mobile-first)
├── features/     # auth, dashboard, portfolio, operations, stats, admin, more
└── lib/          # api client, formatters, contextos de sesión y moneda
packages/shared/  # schemas Zod + DTOs compartidos
```

## Reglas de negocio clave (doc 01 §8)

- **RB-02**: no se puede vender más que la tenencia _a la fecha de la venta_ → 422 `INSUFFICIENT_UNITS`.
- **RB-04/05**: compras recalculan el PPC ponderado; las ventas no lo modifican.
- **RB-06**: el realizado de cada venta se deriva por replay, nunca se persiste — editar una compra vieja recalcula todo.
- **RB-07**: maestros/activos en uso no se borran (409 `IN_USE` con conteo), se archivan.
- **RB-10**: conversiones ARS⇄USD con el dólar configurado; cada snapshot guarda el FX usado.

> Disclaimer: la app informa, no da asesoramiento financiero.
