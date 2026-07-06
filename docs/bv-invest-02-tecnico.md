# BV Invest — Documento Técnico

> Derivado del documento funcional (01). Stack fijado por requerimiento:
> React + Node + MongoDB, deploy inicial en Railway, UI de bv-personal-finances.

---

## 1. Stack y decisiones

| Capa            | Elección                                                                  | Por qué                                                                                             |
| --------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Frontend        | React 18 + Vite + TypeScript + Tailwind v4 + React Router                 | Mismo stack del ecosistema BV; reutiliza `BV_Design_Guide.md` y componentes de bv-personal-finances |
| Estado servidor | TanStack Query                                                            | Cache, reintentos y estados de carga/error resueltos; clave para cotizaciones con frescura          |
| Formularios     | React Hook Form + Zod (schemas compartidos con BE)                        | Validación inline con una sola fuente de verdad                                                     |
| Gráficos        | Recharts                                                                  | Liviano, declarativo, suficiente para líneas/donut/barras                                           |
| Backend         | Node 20+ + Fastify + TypeScript                                           | Ya lo usaste en ArcherLog con Mongoose; validación por schema integrada, rápido                     |
| ODM             | Mongoose                                                                  | Consistente con ArcherLog; schemas tipados                                                          |
| Auth            | Sesión JWT en cookie `httpOnly` + `SameSite=Lax` + `Secure` en prod       | Mismo patrón BV; sin tokens en localStorage (XSS)                                                   |
| Hash            | `scrypt` de `node:crypto`                                                 | Estándar OWASP, cero dependencias externas en lo crítico                                            |
| Jobs            | Cron de Railway (o `node-cron` en el mismo servicio) para snapshot diario | Simple; un solo job                                                                                 |
| Deploy          | Railway: 1 servicio Node (API + FE estático compilado) + MongoDB          | Igual patrón que BV Cross/ArcherLog; portable a Coolify/VPS después                                 |

**Trade-off nombrado — Fastify vs. Express:** Express es más ubicuo; Fastify valida con JSON Schema/Zod nativamente, es más rápido y ya está en tu ArcherLog. Recomiendo Fastify por consistencia y validación integrada. Si bv-personal-finances usa Express y querés compartir middleware literal, cambialo a Express: el diseño no depende del framework.

**Estructura (monorepo pnpm, como ArcherLog):**

```
bv-invest/
├── apps/
│   ├── api/          # Fastify
│   │   └── src/
│   │       ├── modules/        # auth, masters, assets, operations, portfolio, quotes, stats, settings
│   │       │   └── <mod>/      # routes.ts, service.ts, model.ts, schemas.ts
│   │       ├── providers/      # adapters de cotizaciones (ver doc 03)
│   │       ├── core/           # motor de cálculo (puro, sin IO)
│   │       └── plugins/        # auth, error handler, cors
│   └── web/          # React
│       └── src/
│           ├── features/       # espeja los módulos del BE
│           ├── components/     # UI compartida (de bv-personal-finances)
│           └── lib/            # api client, formatters (moneda, %)
└── packages/
    └── shared/       # schemas Zod + tipos compartidos FE/BE
```

---

## 2. Modelo de datos (MongoDB)

Convención: `_id` ObjectId, `createdAt`/`updatedAt` automáticos (timestamps de Mongoose).

### users

```ts
{ username: string /* unique, lowercase */, passwordHash: string, displayName: string }
```

### instrumentTypes / platforms / currencies (misma forma)

```ts
{ name: string /* unique */, archived: boolean /* default false */ }
// currencies agrega: code: 'ARS' | 'USD' | string (unique)
```

### assets

```ts
{
  ticker: string,            // unique, uppercase (BTC, GOOGL, AL30)
  name: string,
  instrumentTypeId: ObjectId,   // ref instrumentTypes
  quoteCurrency: ObjectId,      // ref currencies (en qué moneda cotiza)
  providerSymbols: {            // mapeo por proveedor (ver doc 03)
    data912?: string, coingecko?: string, criptoya?: string,
    yahoo?: string, argentinadatos?: string
  },
  cedearRatio?: number,         // solo CEDEARs (ej. AMZN 144:1)
  archived: boolean
}
```

### operations

```ts
{
  type: 'buy' | 'sell',
  assetId: ObjectId,
  platformId: ObjectId,
  units: number,             // > 0, decimal (cripto fracciona)
  currencyId: ObjectId,      // moneda de la operación
  unitPrice: number,         // > 0, en currencyId
  date: Date,                // fecha de la operación (no de carga)
  notes?: string,
  createdBy: ObjectId        // ref users (auditoría)
}
// Índices: { assetId: 1, date: 1 }, { date: -1 }, { platformId: 1 }
```

⚠️ **Decimales:** JS `number` alcanza para uso personal, pero documentá el redondeo: montos a 2 decimales, unidades a 8 (cripto). Centralizar en `core/money.ts` (funciones `round2`, `round8`) — nunca redondear en la UI.

### quotesCache

```ts
{
  assetId: ObjectId, provider: string,
  price: number, currency: 'ARS' | 'USD',
  changePct?: number, high52?: number, low52?: number,
  fetchedAt: Date
}
// Índice único { assetId: 1, provider: 1 } + TTL opcional en fetchedAt
```

### fxRates

```ts
{ kind: 'ccl' | 'mep' | 'oficial', value: number, provider: string, fetchedAt: Date }
```

### snapshots (job diario)

```ts
{
  date: Date,                       // único por día
  fx: { kind: string, value: number },   // FX usado ese día (RB-10)
  totals: { valueARS: number, valueUSD: number, invested: number, realized: number, unrealized: number },
  positions: [{ assetId, units, price, valueARS, valueUSD }]
}
```

### settings (documento único)

```ts
{
  preferredProviders: { [instrumentTypeId: string]: string },
  fxKind: 'ccl' | 'mep' | 'oficial',    // default 'ccl'
  sellSignalPct: number,                 // default 80
  near52wPct: number,                    // default 5 (% de cercanía a máx/mín)
  defaultDisplayCurrency: 'ARS' | 'USD'
}
```

**Trade-off nombrado — portafolio compartido:** las operaciones no tienen "dueño de portafolio"; ambos usuarios ven todo (requisito). Si mañana quieren portafolios separados, se agrega `portfolioId` a operations/assets — el diseño no lo bloquea, pero no lo construimos ahora (YAGNI).

---

## 3. Motor de cálculo (core, puro)

Módulo sin IO: recibe operaciones ordenadas y devuelve la posición. Testeable al 100%.

```ts
// core/position.ts — replay con costo promedio ponderado (WAC)
interface PositionState {
  units: number;
  avgCost: number; // PPC vigente
  invested: number; // capital aún invertido (units × avgCost)
  realized: number; // resultado realizado acumulado
  totalBought: number;
  totalSold: number; // en unidades
}

function replay(ops: Operation[]): PositionState {
  // ops ordenadas por date ASC (desempate: createdAt)
  // buy:  avgCost = (units*avgCost + op.units*op.unitPrice) / (units + op.units)
  //       units += op.units
  // sell: realized += (op.unitPrice - avgCost) * op.units
  //       units -= op.units            // avgCost NO cambia (RB-05)
  //       si op.units > units → error de dominio (RB-02, validado también en alta)
}
```

- El resultado de una venta y el PPC al momento de venderla **se derivan siempre**, nunca se persisten (RB-06). Editar una compra vieja deja todo consistente sin cascadas.
- Costo O(n) por activo; con volúmenes personales (cientos de ops) es despreciable. Si algún día duele, se cachea el estado con invalidación por activo — **no antes de medir**.
- Multi-moneda: el replay se hace **por activo en su moneda de operación**; la conversión a ARS/USD es una capa de presentación con el FX vigente (o el del snapshot para históricos).
- Caso borde a testear: venta en fecha intermedia + edición retroactiva de compra anterior; venta total y recompra (PPC arranca de cero); operaciones el mismo día.

---

## 4. Servicio de cotizaciones

Patrón **Adapter** + cadena de fallback (detalle de proveedores en doc 03).

```ts
interface QuoteProvider {
  id: string;
  supports(asset: Asset): boolean;
  getQuotes(assets: Asset[]): Promise<Quote[]>; // batch siempre que la API lo permita
}
```

- `QuoteService.get(assets)`: 1) busca en `quotesCache` si `fetchedAt < TTL` (5 min en horario de mercado, 60 min fuera); 2) si venció, llama al proveedor preferido del tipo de instrumento; 3) si falla → siguiente de la cadena; 4) si todos fallan → devuelve el cache viejo con flag `stale: true`.
- La respuesta siempre incluye `provider` y `fetchedAt` para mostrar frescura y fuente en la UI (RF-6.3/6.4).
- Rate limiting propio: los proveedores de panel (data912) devuelven **todo el mercado en una llamada** → una request cubre todos los CEDEARs/acciones/bonos. Cachear el panel completo, no por activo.
- Nunca llamar proveedores desde el FE: solo el BE los toca (oculta detalles, centraliza cache y evita CORS).

---

## 5. Contratos API (REST, prefijo `/api`)

Formato de error uniforme: `{ error: { code: string, message: string } }`. Validación de entrada con Zod (schemas en `packages/shared`).

### Auth

| Método | Ruta             | Body / Query                                       | Respuesta                   |
| ------ | ---------------- | -------------------------------------------------- | --------------------------- |
| POST   | `/auth/register` | `{ username, password, displayName, inviteToken }` | 201 / 403 `INVALID_INVITE`  |
| POST   | `/auth/login`    | `{ username, password }`                           | 200 + cookie / 401 genérico |
| POST   | `/auth/logout`   | —                                                  | 204                         |
| GET    | `/auth/me`       | —                                                  | usuario actual              |

Rate limit en register/login. Mensajes de login genéricos (no revelar si existe el usuario).

### Maestros (`/instrument-types`, `/platforms`, `/currencies`) — mismo contrato

| Método | Ruta                              | Nota                                                                             |
| ------ | --------------------------------- | -------------------------------------------------------------------------------- |
| GET    | `/`                               | `?includeArchived=true` opcional                                                 |
| POST   | `/`                               | nombre único                                                                     |
| PUT    | `/:id`                            | renombrar propaga (es ref)                                                       |
| PATCH  | `/:id/archive` y `/:id/unarchive` |                                                                                  |
| DELETE | `/:id`                            | 409 `IN_USE` con `{ usedBy: { assets: n, operations: n } }` si está referenciado |

### Assets — ídem maestros + campos propios; GET `/assets/:id` incluye posición y últimas operaciones.

### Operations

| Método | Ruta              | Nota                                                                   |
| ------ | ----------------- | ---------------------------------------------------------------------- |
| GET    | `/operations`     | filtros: `type, assetId, platformId, from, to`; paginado `?page&limit` |
| POST   | `/operations`     | valida RB-02 (tenencia a la fecha) → 422 `INSUFFICIENT_UNITS`          |
| PUT    | `/operations/:id` | revalida RB-02 sobre el set resultante                                 |
| DELETE | `/operations/:id` | 409 si borrar una compra deja ventas posteriores sin respaldo          |

### Portfolio / Stats / Quotes / FX / Settings

| Método  | Ruta                 | Devuelve                                                               |
| ------- | -------------------- | ---------------------------------------------------------------------- |
| GET     | `/portfolio`         | posiciones abiertas con precio, PPC, resultados (`?currency=ARS\|USD`) |
| GET     | `/portfolio/summary` | totales (invertido, valor, realizado, no realizado, %)                 |
| GET     | `/portfolio/closed`  | posiciones cerradas con realizado                                      |
| GET     | `/portfolio/history` | snapshots (`?from&to`)                                                 |
| GET     | `/stats/monthly`     | invertido/vendido/resultado por mes                                    |
| GET     | `/stats/allocation`  | distribución por instrumento/plataforma/moneda                         |
| POST    | `/quotes/refresh`    | fuerza actualización (`?assetId` opcional)                             |
| GET     | `/fx`                | dólar vigente del tipo configurado                                     |
| GET/PUT | `/settings`          | ajustes                                                                |
| GET     | `/signals`           | señales activas calculadas                                             |

---

## 6. Seguridad

- Todas las rutas salvo auth requieren sesión (plugin global; opt-out explícito, no opt-in).
- Cookie `httpOnly + SameSite=Lax + Secure`; CSRF cubierto por SameSite + verificación de `Origin` en mutaciones.
- Zod en cada endpoint (nunca confiar en el FE); Mongoose ya parametriza, pero además `sanitize` de operadores (`$`) en inputs de filtros.
- Secretos por variables de entorno Railway: `MONGO_URL`, `JWT_SECRET`, `INVITE_TOKEN`. Nada commiteado.
- Rate limiting global suave + estricto en auth. Helmet (headers). CORS cerrado al dominio propio.
- No loguear passwords ni tokens; logs de negocio sin PII.
- `npm audit` limpio como criterio de cierre de cada fase (igual que BV Cross).
- Disclaimer visible: la app informa, no da asesoramiento financiero.

---

## 7. Testing

- **core/** (motor de cálculo): unit tests exhaustivos — es el corazón. Casos: compras sucesivas, venta parcial, venta total + recompra, edición retroactiva, RB-02 por fechas, redondeos.
- **providers/**: tests con respuestas mockeadas (fixtures JSON reales de cada API) + test del fallback.
- **API**: tests de integración por módulo con Mongo en memoria (`mongodb-memory-server`): auth, regla 409 IN_USE, validaciones 422.
- **FE**: tests de los formularios (validación inline) y del formatter de moneda. No perseguir cobertura de UI por deporte.
- Deterministas: reloj mockeado para TTL de cache y "Tiempo/Días".

---

## 8. Deploy (Railway)

- Servicio 1: Node (API + estáticos del build de `web/`). Serverless/sleep **apagado** si se usa cron interno; si el cron es de Railway, puede dormir.
- Servicio 2: MongoDB plugin de Railway (o Atlas M0 gratis — trade-off: Atlas sobrevive si migrás de Railway a Coolify; recomiendo Atlas).
- `Cache-Control`: assets con hash → `immutable`; `index.html` → `no-cache`; **API → `no-store, private`** (lección de tu análisis previo de Railway CDN: las sesiones por cookie no quedan excluidas automáticamente).
- Cron diario 21:00 ART (post cierre BYMA): snapshot + refresh de FX.
- Healthcheck `/api/health`.

---

## 9. Riesgos técnicos

| Riesgo                                                  | Mitigación                                                                               |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| APIs gratuitas caen o cambian (data912 es "hobby data") | Adapter + fallback + cache persistente; agregar un proveedor es implementar una interfaz |
| Datos con demora (data912 ~cache 2h)                    | Mostrar `fetchedAt` siempre; para uso de seguimiento personal alcanza                    |
| Ediciones retroactivas rompen consistencia              | Todo derivado por replay (RB-06); nada persistido que pueda desincronizarse              |
| Floating point en dinero                                | Redondeo centralizado en `core/money.ts`, tests de redondeo                              |
