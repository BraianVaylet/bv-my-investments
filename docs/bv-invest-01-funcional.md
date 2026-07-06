# BV Invest — Documento Funcional

> Web app de gestión y seguimiento de inversiones personales. Reemplaza la planilla
> de Google Sheets (tablas Resumen, Historico/Compra, Historico/Venta).
> Sigue el patrón del ecosistema BV y toma como referencia el análisis de bv-personal-finances.

---

## 1. Propósito

Registrar cada operación (compra/venta) **una sola vez** y derivar de ahí todo lo demás:
tenencias, precio promedio, resultados realizados y no realizados, estadísticas y señales.
Centraliza inversiones hechas en múltiples plataformas (Binance, Lemon, Balanz, Ledger, Nexo, Gemini, Shareworks, etc.).

**Principios de diseño (heredados del análisis previo):**

- **Las operaciones son la fuente de verdad.** Nada agregado se carga a mano; todo se calcula.
- **USD como unidad de comparación, ARS como moneda operativa.** Conversión automática vía dólar CCL/MEP (configurable), no más hack de ratio de CEDEAR en fórmulas.
- **Mobile-first.** Nada de tablas de 13 columnas: cards, detalle por tap, resúmenes arriba.
- **Todo editable.** Los errores de carga son comunes; editar una operación recalcula todo.

---

## 2. Problemas de la planilla actual

| #   | Problema                                                                                                                               | Solución en la app                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| P1  | Dos tablas de histórico (compra/venta) con columnas duplicadas                                                                         | Un solo libro de **Operaciones** con tipo `compra`/`venta`                                          |
| P2  | Maestros hardcodeados (activos, instrumentos, plataformas, monedas)                                                                    | CRUD administrable con archivado y protección de borrado                                            |
| P3  | Dependencia de GOOGLEFINANCE (sin cripto nativa, sin FCI, conversión ARS/USD con ratio manual)                                         | Servicio de cotizaciones multi-proveedor con fallback (ver doc 03)                                  |
| P4  | Fórmulas posicionales frágiles (#REF!, #N/A, #DIV/0! detectados)                                                                       | Cálculo en backend, testeado                                                                        |
| P5  | **Bug: en Historico/Venta, `Ganancia = Retorno − Venta`** (costo − ingreso) → da negativo cuando ganás. Rendimiento igual de invertido | Correcto: `Resultado = (PrecioVenta − PPC) × Unidades`; `Rendimiento = (PrecioVenta − PPC) / PPC`   |
| P6  | PPC inconsistente tras ventas parciales (Inversión del resumen ≠ unidades × PPC)                                                       | Método de **costo promedio ponderado (WAC)**: vender no cambia el PPC, solo reduce unidades (RB-05) |
| P7  | Mezcla resultado realizado y no realizado en "Capital"/"Rendimiento"                                                                   | Se separan explícitamente en todas las vistas                                                       |
| P8  | Splits / cambios de ratio de CEDEARs como filas manuales que ensucian el PPC                                                           | Evento corporativo estructurado (fase avanzada, RB-09)                                              |
| P9  | Umbral de señal de venta (80%) hardcodeado                                                                                             | Configurable en Ajustes                                                                             |
| P10 | Solo refleja valuación actual; sin historia del portafolio                                                                             | Snapshots diarios para gráfico de evolución                                                         |

---

## 3. Alcance

**Incluido (v1):**

- Registro y edición de compras y ventas multi-plataforma y multi-moneda.
- Maestros administrables: tipos de instrumento, plataformas, monedas, activos.
- Portafolio: posiciones, PPC, valor actual, resultado realizado/no realizado, rendimiento.
- Cotizaciones automáticas con proveedor seleccionable y fallback.
- Conversión ARS ⇄ USD con dólar (CCL/MEP) automático.
- Dashboard con totales, distribución y evolución.
- Estadísticas mensuales de compras y ventas.
- Señales de compra/venta (reglas configurables) + datos extra de mercado (52w, variación diaria).
- Registro solo con token de invitación (2 usuarios: Braian y Mica), igual que bv-personal-finances.

**Excluido / fases futuras:**

- Integración directa con brokers/exchanges (importar operaciones automáticamente).
- Dividendos y cupones de bonos como flujo (se pueden anotar como nota en v1).
- Eventos corporativos (splits/ratio) — diseñado en el modelo, se implementa en F+.
- Impuestos, benchmark contra índices, multi-portafolio.

---

## 4. Usuarios

- Dos cuentas: **Braian** y **Mica**. Registro bloqueado por token de invitación (variable de entorno), mismo mecanismo que bv-personal-finances.
- Ambos ven y operan sobre **el mismo portafolio compartido** (no hay portafolios por usuario en v1). Cada operación guarda quién la cargó (auditoría ligera).

---

## 5. Glosario y renombres (planilla → app)

| Planilla                                 | App                                       | Definición                                         |
| ---------------------------------------- | ----------------------------------------- | -------------------------------------------------- |
| Tabla Resumen                            | **Portafolio**                            | Posiciones actuales por activo, todo derivado      |
| Historico/Compra + Historico/Venta       | **Operaciones**                           | Libro único de compras y ventas                    |
| Activo                                   | **Activo**                                | Ticker + nombre (BTC, GOOGL, AL30…)                |
| Instrumento                              | **Tipo de instrumento**                   | Cripto, Acción, CEDEAR, FCI, Bono… (administrable) |
| Valor/Hoy                                | **Precio actual**                         | Última cotización del proveedor activo             |
| Prom. Compra                             | **PPC** (precio promedio de compra)       | Costo promedio ponderado                           |
| Comprado / Vendido / Actual              | **Unid. compradas / vendidas / Tenencia** | Cantidades                                         |
| Inversion                                | **Costo**                                 | Tenencia × PPC (capital aún invertido)             |
| Retorno Venta                            | **Realizado**                             | Resultado ya materializado por ventas              |
| Capital                                  | **Valor actual**                          | Tenencia × precio actual                           |
| Rendimiento                              | **Rendimiento %**                         | Separado en realizado y no realizado               |
| Ganancia / en Moneda / en Pesos / en USD | **Resultado** (con toggle ARS/USD)        | Una sola cifra, la moneda la elige la vista        |
| high52 / low52                           | **Rango 52 semanas**                      | Máx/mín anual, visual tipo barra                   |

Nota: el instrumento **pertenece al activo** (BTC siempre es Cripto), no a la operación. En la planilla se repetía por fila; en la app se selecciona el activo y el instrumento viene solo. Menos carga, menos error.

---

## 6. Modelo conceptual

- **Usuario**: credenciales + nombre.
- **TipoInstrumento**: nombre, archivado.
- **Plataforma**: nombre, archivado.
- **Moneda**: código (ARS, USD), nombre, archivado.
- **Activo**: ticker, nombre, tipo de instrumento, moneda de cotización, símbolos por proveedor de datos, ratio CEDEAR (opcional), archivado.
- **Operación**: tipo (compra/venta), activo, plataforma, unidades, moneda, precio unitario, fecha, nota, usuario que cargó.
- **Cotización (cache)**: activo, proveedor, precio, variación, 52w, timestamp.
- **Dólar (FX)**: tipo (CCL/MEP/oficial), valor, timestamp.
- **Snapshot**: fecha, valor total ARS/USD, detalle por activo (para el gráfico de evolución).
- **Ajustes**: proveedor preferido por tipo de instrumento, tipo de dólar, umbrales de señales.
- **EventoCorporativo** (diseñado, fase futura): activo, tipo (split/cambio de ratio), fecha, factor.

Todo lo demás (tenencia, PPC, costo, valor actual, resultados, rendimientos, totales, estadísticas mensuales) **se deriva** de Operaciones + Cotizaciones + FX.

---

## 7. Requisitos funcionales por módulo

### M1 — Autenticación

- RF-1.1 Registro con nombre de usuario, contraseña y **token de invitación** válido. Sin token válido → rechazado.
- RF-1.2 Login con sesión persistente (cookie httpOnly). Logout.
- RF-1.3 Sin recuperación por email en v1 (no se guardan emails); reset manual por admin/DB como en el resto del ecosistema BV.

### M2 — Maestros (tipos de instrumento, plataformas, monedas)

- RF-2.1 CRUD completo de cada maestro.
- RF-2.2 **No se puede borrar** un maestro en uso por algún activo u operación; la app lo informa y ofrece archivar.
- RF-2.3 Archivar: deja de aparecer en selectores de carga, pero se sigue mostrando en datos históricos. Reversible.
- RF-2.4 Renombrar propaga a todas las vistas (es una referencia, no texto copiado).
- RF-2.5 Semillas iniciales: instrumentos (Cripto, Acción, CEDEAR, FCI, Bono), monedas (ARS, USD), plataformas vacías o migradas.

### M3 — Activos

- RF-3.1 CRUD de activos con: ticker, nombre, tipo de instrumento, moneda de cotización, símbolo por proveedor (ej.: data912 `AMZN`, CoinGecko `bitcoin`), ratio CEDEAR si aplica.
- RF-3.2 Mismas reglas de borrado/archivado que M2.
- RF-3.3 Vista de detalle del activo: precio, rango 52w, posición, resultado, historial de operaciones propias, gráfico de precio histórico (si el proveedor lo da).

### M4 — Operaciones

- RF-4.1 Alta de compra: activo, plataforma, unidades, moneda, precio unitario, fecha (default hoy), nota opcional. El precio actual se sugiere como valor inicial.
- RF-4.2 Alta de venta: mismos campos. La app muestra tenencia disponible y PPC vigente antes de confirmar.
- RF-4.3 Edición y borrado de cualquier operación; el sistema recalcula todo lo derivado (RB-06).
- RF-4.4 Listado con filtros: tipo, activo, plataforma, rango de fechas. Orden por fecha desc.
- RF-4.5 Cada card de operación muestra: ticker, tipo, unidades × precio, total, fecha, plataforma, resultado si es venta.

### M5 — Portafolio

- RF-5.1 Lista de posiciones abiertas (tenencia > 0): ticker, tenencia, precio actual, PPC, valor actual, resultado no realizado ($ y %), variación diaria.
- RF-5.2 Toggle global ARS / USD (conversión con el dólar configurado).
- RF-5.3 Posiciones cerradas accesibles aparte con su resultado realizado.
- RF-5.4 Totales: invertido, valor actual, realizado, no realizado, rendimiento total.

### M6 — Cotizaciones

- RF-6.1 Actualización automática al abrir vistas que las necesiten, con cache (frescura visible: "hace 5 min").
- RF-6.2 Botón de refresco manual.
- RF-6.3 Selector de proveedor por tipo de instrumento en Ajustes; **fallback automático** si el proveedor primario falla (se indica de qué fuente vino el dato).
- RF-6.4 Si ninguna fuente responde: se muestra el último valor cacheado con advertencia, nunca pantalla rota.

### M7 — Dashboard y estadísticas

- RF-7.1 Dashboard: valor total del portafolio (ARS/USD), resultado del día, realizado + no realizado, gráfico de evolución (snapshots), distribución por tipo de instrumento / plataforma / moneda (donut), top señales activas.
- RF-7.2 Estadísticas mensuales: invertido, vendido, resultado por mes (reemplaza las tablas secundarias de la planilla).
- RF-7.3 Gráficos por activo: precio histórico + marcas de mis compras/ventas (si hay histórico del proveedor).

### M8 — Señales

- RF-8.1 Señal **comprar**: precio actual < PPC del activo (misma lógica que la planilla).
- RF-8.2 Señal **vender**: rendimiento no realizado > umbral configurable (default 80%).
- RF-8.3 Extras aprovechando las APIs: cercanía a mínimo/máximo de 52 semanas, variación diaria fuerte (umbral configurable). Se muestran como badges, sin notificaciones push en v1.
- RF-8.4 Las señales son informativas; la app no recomienda financieramente (disclaimer en UI).

### M9 — Ajustes

- RF-9.1 Proveedor de cotizaciones preferido por tipo de instrumento.
- RF-9.2 Tipo de dólar para conversiones (CCL / MEP / oficial), default CCL.
- RF-9.3 Umbrales de señales.
- RF-9.4 Moneda default de visualización.

---

## 8. Reglas de negocio

- **RB-01** Una operación pertenece a un activo; el tipo de instrumento se hereda del activo.
- **RB-02** No se puede vender más unidades que la tenencia **a la fecha de la venta** (validación considera fechas, no solo el total actual).
- **RB-03** Tenencia = Σ unidades compradas − Σ unidades vendidas, ordenado por fecha.
- **RB-04** PPC (costo promedio ponderado): cada compra recalcula `PPC = (tenencia×PPC + unidades×precio) / (tenencia + unidades)`.
- **RB-05** Una venta **no modifica el PPC**; reduce tenencia. Resultado realizado de la venta = `(precioVenta − PPC vigente) × unidades`.
- **RB-06** El PPC vigente al momento de cada venta **se deriva por replay** de las operaciones ordenadas por fecha, no se persiste. Así, editar una compra pasada deja todo consistente automáticamente.
- **RB-07** Maestro o activo en uso: no borrable (error claro con conteo de usos), sí archivable.
- **RB-08** Resultado realizado y no realizado nunca se suman sin etiquetar; "Resultado total" siempre muestra el desglose.
- **RB-09** (futuro) Un evento corporativo ajusta unidades y PPC con un factor en una fecha, sin tocar operaciones históricas.
- **RB-10** Conversiones ARS⇄USD usan el dólar del tipo configurado al valor **actual** para valuaciones, y quedan a valor del día para snapshots (cada snapshot guarda el FX usado).

---

## 9. Pantallas (mobile-first)

1. **Login / Registro** (con campo token).
2. **Dashboard** — totales, evolución, distribución, señales.
3. **Portafolio** — cards de posiciones; tap → detalle de activo.
4. **Detalle de activo** — precio, 52w, posición, operaciones del activo, gráfico.
5. **Operaciones** — listado filtrable + FAB "+" (compra/venta).
6. **Formulario de operación** — selects de maestros, defaults inteligentes, validación inline.
7. **Estadísticas** — mensual y por dimensión.
8. **Administración** — maestros, activos, ajustes.

Navegación: bottom tab bar (Dashboard, Portafolio, Operaciones, Estadísticas, Más). UI reutiliza el design system de bv-personal-finances (dark-first, grilla 8px, Inter, Tailwind v4 según `BV_Design_Guide.md`).

Estados obligatorios en toda vista: carga (skeleton), vacío (con CTA), error (con reintento).

---

## 10. Referencias de apps similares

| App                                     | Qué tomamos                                                                                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Delta (eToro)**                       | Dark mode mobile-first; vista por posición con valor, % y P&L realizado/no realizado separados; multi-asset (cripto + acciones) en un solo dashboard |
| **getquin**                             | Distribución por clase/región/plataforma; métricas de rendimiento claras; carga manual simple de transacciones                                       |
| **Portfolio Performance** (open source) | Modelo de operaciones como fuente de verdad; rigor en el cálculo de costo promedio y retornos                                                        |
| **Sharesight / TrackinV**               | Desglose de rendimiento por período (mensual/anual); comparación futura contra benchmark                                                             |

Lo que **no** copiamos: comunidad/social, open banking, planes pagos, IA de asesoría. Fuera de propósito.

---

## 11. Preguntas abiertas

1. **Método de costo:** confirmo WAC (promedio ponderado, RB-04/05) como quedó en el análisis previo. ¿OK, o preferís FIFO?
2. **Dólar default:** ¿CCL? (la planilla lo usaba implícito vía ratio CEDEAR).
3. **RSUs Globant:** ¿se cargan como compras de la acción a precio de vesting (recomendado) o quedan fuera de v1?
4. **Snapshots** diarios para el gráfico de evolución: ¿desde v1 (recomendado, es barato) o fase 2?
5. **Migración:** ¿importamos el histórico de la planilla (script one-shot CSV) o arrancamos de cero?
