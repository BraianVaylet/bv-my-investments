# BV Invest — Roadmap por fases (tareas FE / BE)

> Cada fase termina deployada y usable (vertical slices, como BV Bow Sight / ArcherLog).
> Definition of Done por tarea: código + validación + tests de lo crítico + `npm audit` limpio.
> Marcá `[x]` a medida que avanza. Orden pensado para desbloquear dependencias.

---

## F0 — Setup (BE+FE)

- [ ] Monorepo pnpm: `apps/api`, `apps/web`, `packages/shared`
- [ ] TypeScript estricto, ESLint + Prettier compartidos
- [ ] API Fastify "hello" + `/api/health` + conexión Mongo (Atlas o plugin Railway)
- [ ] Web Vite + React + Tailwind v4 con tokens de `BV_Design_Guide.md` (copiar base de bv-personal-finances)
- [ ] Variables de entorno (`MONGO_URL`, `JWT_SECRET`, `INVITE_TOKEN`) + `.env.example`
- [ ] Deploy skeleton en Railway (API sirviendo el build del FE) + headers de cache (`no-store` en API)
- [ ] README con setup local

## F1 — Autenticación

**BE**

- [ ] Modelo `users` + hash con `scrypt`
- [ ] `POST /auth/register` con validación de `INVITE_TOKEN` (403 si inválido)
- [ ] `POST /auth/login` (mensaje genérico) + cookie JWT httpOnly + `POST /auth/logout` + `GET /auth/me`
- [ ] Plugin de auth global (rutas protegidas por default) + rate limit en auth
- [ ] Tests: registro con/sin token, login ok/fail, acceso sin sesión → 401
      **FE**
- [ ] Pantallas Login y Registro (campo token), validación inline
- [ ] Guard de rutas + contexto de sesión (`/auth/me` al iniciar)
- [ ] Manejo de expiración de sesión (redirect a login con aviso)

## F2 — Maestros (tipos de instrumento, plataformas, monedas)

**BE**

- [ ] Modelos + CRUD genérico reutilizable para los 3 maestros
- [ ] Regla 409 `IN_USE` con conteo de referencias + archivar/desarchivar
- [ ] Seeds: instrumentos (Cripto, Acción, CEDEAR, FCI, Bono), monedas (ARS, USD)
- [ ] Tests: borrar en uso → 409; archivado excluye de listados default
      **FE**
- [ ] Sección Administración con lista + alta/edición/archivado por maestro
- [ ] Modal de confirmación de borrado; si 409, mostrar usos y ofrecer archivar
- [ ] Estados vacío/carga/error

## F3 — Activos

**BE**

- [ ] Modelo `assets` (ticker único, providerSymbols, cedearRatio) + CRUD con mismas reglas que F2
- [ ] Tests: unicidad de ticker, 409 con operaciones existentes
      **FE**
- [ ] ABM de activos (form con selects de maestros, campos de símbolos por proveedor)
- [ ] Listado con búsqueda y filtro por tipo/archivado

## F4 — Operaciones + motor de cálculo ← corazón del sistema

**BE**

- [ ] `core/position.ts`: replay WAC puro (RB-03/04/05/06) + `core/money.ts` (redondeos)
- [ ] **Suite de tests del core**: compras sucesivas, venta parcial, venta total + recompra, edición retroactiva, venta > tenencia a la fecha (RB-02), redondeos
- [ ] Modelo `operations` + índices
- [ ] `POST/PUT/DELETE /operations` con validación RB-02 sobre el set resultante (422 / 409)
- [ ] `GET /operations` con filtros y paginado
      **FE**
- [ ] Listado de operaciones (cards) + filtros (tipo, activo, plataforma, fechas)
- [ ] FAB "+" → formulario compra/venta: selects, fecha default hoy, unidades/precio; en venta mostrar tenencia y PPC vigentes
- [ ] Edición y borrado con confirmación; errores 422/409 traducidos a mensajes útiles

## F5 — Cotizaciones y FX

**BE**

- [ ] Interfaz `QuoteProvider` + `QuoteService` (cache Mongo, TTL por horario, fallback, flag `stale`)
- [ ] Adapters: data912 (paneles + históricos), CoinGecko, Binance, CriptoYa, DolarApi, ArgentinaDatos (FCI)
- [ ] `POST /quotes/refresh`, `GET /fx`
- [ ] Cálculo/caché de 52w cuando el proveedor no lo da
- [ ] Tests de adapters con fixtures reales + test de fallback en cadena
      **FE**
- [ ] Indicador de frescura y fuente ("data912 · hace 4 min") + banner si `stale`
- [ ] Botón de refresco manual
- [ ] Ajustes: selector de proveedor por tipo de instrumento y tipo de dólar

## F6 — Portafolio

**BE**

- [ ] `GET /portfolio`, `/portfolio/summary`, `/portfolio/closed` (agregación: replay por activo + quotes + FX)
- [ ] Conversión ARS/USD por query param
- [ ] Tests de integración con datos semilla
      **FE**
- [ ] Vista Portafolio: cards de posición (tenencia, precio, PPC, no realizado $ y %, variación diaria)
- [ ] Toggle global ARS/USD (persistido en Ajustes)
- [ ] Detalle de activo: precio, rango 52w, posición, operaciones del activo
- [ ] Posiciones cerradas con realizado

## F7 — Dashboard, estadísticas y snapshots

**BE**

- [ ] Job diario de snapshot (cron Railway 21:00 ART) + `GET /portfolio/history`
- [ ] `GET /stats/monthly` y `GET /stats/allocation`
- [ ] Backfill opcional de snapshots con FX histórico de ArgentinaDatos
      **FE**
- [ ] Dashboard: total, realizado/no realizado, gráfico de evolución, donut de distribución
- [ ] Vista Estadísticas: barras mensuales (invertido / vendido / resultado)
- [ ] Gráfico de precio histórico con marcas de compras/ventas en detalle de activo

## F8 — Señales

**BE**

- [ ] `GET /signals`: comprar (precio < PPC), vender (no realizado > umbral), cerca de 52w, movimiento diario fuerte — umbrales desde `settings`
      **FE**
- [ ] Badges de señal en portafolio y dashboard + disclaimer
- [ ] Umbrales editables en Ajustes

## F9 — Cierre

- [ ] Migración one-shot desde la planilla (script CSV → operations) — si se decide (pregunta abierta 5)
- [ ] PWA (manifest + service worker básico) para instalar en el teléfono
- [ ] Pasada de accesibilidad (foco, labels, contraste) y estados vacío/error en todas las vistas
- [ ] Revisión de seguridad (checklist doc 02 §6) + `npm audit`
- [ ] Docs de deploy y variables + backup de Mongo (dump programado)

---

## Dependencias entre fases

```
F0 → F1 → F2 → F3 → F4 → F6 → F7 → F8 → F9
                      ↘ F5 ↗
```

F5 puede desarrollarse en paralelo a F4 (no se tocan): buen candidato si querés avanzar con dos sesiones de Claude Code.
