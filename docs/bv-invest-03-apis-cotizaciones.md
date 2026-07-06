# BV Invest — APIs de Cotizaciones (investigación)

> Reemplazo de GOOGLEFINANCE. Requisitos: gratis, confiable, cubrir Cripto + CEDEARs +
> Acciones (AR y US) + Bonos + FCI + dólar ARS/USD. Más de una fuente por dato para que
> el usuario elija y para fallback automático.
> Verificado: julio 2026.

---

## 1. Matriz necesidad → proveedores

| Necesidad                   | Primario                                                                                  | Fallback                                                     | Key                  |
| --------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------- |
| CEDEARs (ARS)               | **data912** `/live/arg_cedears`                                                           | Yahoo Finance (`TICKER.BA`)                                  | No / No              |
| Acciones BYMA (ARS)         | **data912** `/live/arg_stocks`                                                            | Yahoo (`.BA`)                                                | No / No              |
| Bonos soberanos/corp/letras | **data912** `/live/arg_bonds`, `/live/arg_corp`, `/live/arg_notes`                        | — (única fuente gratuita decente)                            | No                   |
| Acciones USA / ADRs (USD)   | **data912** `/live/usa_stocks`, `/live/usa_adrs`                                          | Yahoo Finance o Finnhub                                      | No / key gratis      |
| Cripto (USD)                | **CoinGecko**                                                                             | **Binance API pública**                                      | key demo gratis / No |
| Cripto (ARS, por exchange)  | **CriptoYa** (precio real en Lemon, Binance ARS, etc.)                                    | CoinGecko × dólar                                            | No                   |
| Dólar CCL/MEP/oficial       | **DolarApi.com**                                                                          | data912 `/live/mep`, `/live/ccl`; ArgentinaDatos (histórico) | No                   |
| FCI (valor cuotaparte)      | **ArgentinaDatos** `/v1/finanzas/fci/...` (fuente CAFCI)                                  | —                                                            | No                   |
| Histórico OHLC (gráficos)   | data912 `/historical/{tipo}/{ticker}` (AR) · CoinGecko market_chart (cripto) · Yahoo (US) | —                                                            | —                    |

Esto elimina el hack de la planilla `GOOGLEFINANCE("BCBA:AMZN")*ratio/GOOGLEFINANCE("AMZN")`: el CCL viene directo de DolarApi/data912.

---

## 2. Detalle por proveedor

### data912 — https://data912.com

- **Qué da:** paneles completos del mercado argentino (acciones, CEDEARs, bonos, ONs, letras, opciones) + paneles USA (stocks, ADRs) + MEP/CCL + histórico OHLC por ticker + analytics EOD.
- **Costo/key:** gratis, sin key. ~120 req/min. Cache CDN ~2 h.
- **Formato:** JSON. Un GET al panel devuelve **todos** los tickers → una sola llamada cubre todo el portafolio local. Perfecto para nuestro cache.
- **Riesgo:** el autor lo define como datos educativos/hobby, no tiempo real. Aceptable para seguimiento personal; mitigado con fallback y mostrando `fetchedAt`.
- **Extra útil (P. de mejora "usar más datos de las APIs"):** histórico OHLC para gráficos con marcas de compra/venta; volatilidades EOD.

### CoinGecko — https://www.coingecko.com/api

- **Qué da:** precio spot, variación 24h/7d, market cap, volumen, ATH, histórico (`market_chart`), en USD y también **ARS** como vs_currency.
- **Costo/key:** plan Demo gratis con key (≈30 req/min, ~10k/mes). `simple/price` acepta múltiples ids por llamada → 1 request para toda la cartera cripto.
- **Mapeo:** usa ids propios (`bitcoin`, `ethereum`) → campo `providerSymbols.coingecko` en el activo.

### Binance API pública — https://api.binance.com

- **Qué da:** `/api/v3/ticker/price` y `/ticker/24hr` (variación, high/low 24h) sin key, tiempo real, muy alta cuota.
- **Uso:** fallback de CoinGecko para pares `BTCUSDT`, etc. No cubre tokens que no listan en Binance.

### CriptoYa — https://criptoya.com/api

- **Qué da:** precio de cada cripto **por exchange argentino** (Lemon, Binance, Ripio…) en ARS y USD, compra/venta/spread. También dólar.
- **Costo/key:** pública y gratis.
- **Valor diferencial:** como operás en Lemon/Binance, permite valuar la cripto al precio real del exchange donde está, no al promedio global. Buen candidato a "segunda fuente elegible" en Ajustes.

### DolarApi.com — https://dolarapi.com

- **Qué da:** oficial, blue, MEP (bolsa), CCL, mayorista, cripto. JSON simple, sin key.
- **Uso:** fuente primaria del FX para RB-10. ArgentinaDatos (mismo ecosistema) da el **histórico** de cotizaciones para reconstruir snapshots o gráficos.

### ArgentinaDatos — https://argentinadatos.com

- **Qué da:** FCI por tipo (renta fija/variable/mixta, mercado de dinero) con valor de cuotaparte por fecha (fuente CAFCI), dólares históricos, índices (inflación, UVA).
- **Costo/key:** gratis, sin key.
- **Uso:** único proveedor razonable para FCI. Extra: índice de inflación para, a futuro, mostrar rendimiento real.

### Yahoo Finance (no oficial, vía `yahoo-finance2` npm)

- **Qué da:** casi todo (US, `.BA` para BYMA, cripto), incluye **52w high/low nativo**, histórico.
- **Riesgo:** API no oficial, puede romperse; por eso va como fallback, nunca primario.

### Finnhub — https://finnhub.io

- **Qué da:** quotes US en tiempo real, 60 req/min con key gratis. Solo mercado US en free.
- **Uso:** fallback alternativo a Yahoo para acciones US si preferís algo con contrato de API estable.

### Descartadas

- **IOL API:** buena data AR en tiempo real pero requiere cuenta comitente y auth; queda documentada como opción futura si data912 muriera.
- **BYMA APIs / Rava:** orientadas a empresas/convenios, no free-tier self-service.
- **Alpha Vantage:** 25 req/día, insuficiente.

---

## 3. Estrategia de implementación

1. **Un adapter por proveedor** (interfaz `QuoteProvider`, doc 02 §4). Normalizan a `{ price, currency, changePct?, high52?, low52?, fetchedAt, provider }`.
2. **Batch primero:** data912 (panel completo) y CoinGecko (`ids` múltiples) se piden una vez y se reparte a los activos. Nunca loop de 1 request por activo.
3. **Cadena por tipo de instrumento** (configurable en Ajustes, RF-6.3):
   - CEDEAR/Acción AR/Bono/Letra: `data912 → yahoo`
   - Acción US: `data912 → yahoo → finnhub`
   - Cripto: `coingecko → binance → criptoya` (o el orden que elija el usuario)
   - FCI: `argentinadatos`
   - FX: `dolarapi → data912`
4. **52 semanas:** Yahoo lo trae nativo; para data912/CoinGecko se calcula en BE desde el histórico y se cachea por 24 h (es un dato lento).
5. **Cache:** panel/quotes 5 min en horario de mercado (BYMA 11–17 ART), 60 min fuera; FX 15 min; FCI 24 h. Si todo falla → último cache con `stale: true`.
6. **Símbolos:** cada activo guarda su símbolo por proveedor (`providerSymbols`). El alta de activo pide solo los del proveedor primario; el resto es opcional.

---

## 4. Datos extra a aprovechar (mejora pedida)

| Dato                | Fuente                      | Uso en la app                                              |
| ------------------- | --------------------------- | ---------------------------------------------------------- |
| Variación diaria %  | todas                       | Badge en cada posición; señal de movimiento fuerte         |
| High/low 52w        | Yahoo / calculado           | Barra de rango en detalle + señal "cerca del mínimo anual" |
| Histórico OHLC      | data912 / CoinGecko / Yahoo | Gráfico de precio con marcas de mis compras/ventas         |
| Volumen             | data912 / CoinGecko         | Detalle del activo (contexto de liquidez)                  |
| Spread por exchange | CriptoYa                    | Ver dónde conviene comprar/vender cripto                   |
| MEP vs CCL vs blue  | DolarApi                    | Vista rápida de dólares en el dashboard                    |
| Inflación / UVA     | ArgentinaDatos              | Futuro: rendimiento real                                   |
