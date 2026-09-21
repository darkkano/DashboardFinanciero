# PUENTE — Dashboard financiero en tiempo real + Copilot operativo

## Resumen (qué hace este proyecto)

Es un **panel de mesa de cambio / remesas**. Entra un operador y ve giros cayendo en vivo (USD→VES, USD→COP, etc.), con estados en cola, compliance o liberados.

La tabla **parpadea** con cada transacción nueva (~15–25 por segundo) y el navegador no se congela.

Al lado, un **Copilot operativo** lee esa misma mesa en tiempo real y, por streaming de texto (SSE), te dice cosas como:

> Hay un embotellamiento en las operaciones de las últimas 2 horas. El corredor USD→VES concentra el 90% de la cola y el SLA se fue a 18 minutos.

No busca productos ni vende ropa: **vigila la operación** y avisa dónde se atasca el flujo de dinero.

**Stack:** Angular 21 (Signals + `OnPush` + RxJS) · WebSockets · Server-Sent Events · Node/Express · **Drizzle** · MySQL (XAMPP).

El tape **en vivo sigue en RAM** (un tick cada 110 ms no espera a disco). Drizzle hidrata al arrancar, persiste cada lote en `ticks` (fire-and-forget) y guarda cada brief del copilot en `copilot_briefs`.

---

## Arquitectura hexagonal

El hexágono es el **dominio** (reglas de la mesa). Nada de Express, Angular o MySQL entra ahí. El mundo exterior se conecta por **puertos**; cada tecnología es un **adaptador**.

```
                    UI Angular (adaptador de entrada)
                    feed.service · copilot.service · OnPush
                                      │
                         puertos HTTP / WS / SSE
                                      │
                 ┌────────────────────▼────────────────────┐
                 │              DOMINIO PUENTE             │
                 │  engine.js  ticks, KPIs, rates, SLA     │
                 │  copilot.js embotellamiento 2 h         │
                 └───────────┬──────────────────┬──────────┘
                             │                  │
              adaptador WS/HTTP            adaptador persistencia
              server.js Express            db.js + schema.js Drizzle
                                           (fallback: memoria)
```

| Capa | Qué es | Archivos |
|---|---|---|
| **Dominio** | Qué es un tick, cómo se calcula cola/SLA, cuándo hay embotellamiento. Cero `req`/`res`. | `engine.js` (`makeTx`, `kpis`, `getWindow`), `copilot.js` (`analyze`) |
| **Puertos de entrada** | Contratos que el mundo usa para hablar con el dominio. | HTTP `/api/*`, WS `/ws`, SSE `/api/copilot/stream` |
| **Adaptadores de entrada** | Express y Angular implementan esos puertos. | `server.js`, `feed.service.ts`, `copilot.service.ts`, `tick-row.ts` |
| **Puertos de salida** | “Guarda ticks / briefs” sin saber si es MySQL. | llamadas `persist()` / `persistBrief()` |
| **Adaptadores de salida** | Drizzle/MySQL; si falla, RAM. | `db.js`, `schema.js`, buffer `rows[]` |

El dominio **no** importa `drizzle-orm`. `engine.js` solo llama `db.insert` detrás de un `try`; si el adaptador cae, la mesa sigue. Angular **no** calcula el embotellamiento: consume el puerto SSE.

---

## Arranque

### 1. Base de datos (Drizzle)

1. Panel XAMPP → **MySQL → Start**.
2. Copia `.env.example` a `.env` si usas otra clave.

```bash
cd c:\xampp\htdocs\nivelDos\DashboardFinanciero
npm run db:setup
```

Crea la base `puente` y hace `drizzle-kit push` de las tablas `ticks` y `copilot_briefs`. El API siembra ~240 ticks al arrancar.

`DATABASE_URL=mysql://root:@127.0.0.1:3306/puente`

### 2. Mesa

```bash
npm start
```

Eso levanta:

| Proceso | Puerto | URL |
|---|---|---|
| API Node (HTTP + WS + SSE) | `3101` | http://localhost:3101/api/health |
| Mesa Angular | `4210` | http://localhost:4210 |

Scripts sueltos:

```bash
npm run api              # node api/src/server.js
npm run desk             # espera :3101 y hace ng serve --port 4210
npm run db:setup         # drizzle-kit push
npm run db:push          # solo tablas
```

El proxy `proxy.conf.json` manda `/api` y `/ws` del browser (`:4210`) al API (`:3101`).

Si MySQL no está, el tape corre igual en memoria y `/api/health` dice `"store": "memory"`. Con Drizzle: `"store": "drizzle"`.

---

## Drizzle (tablas)

Fuente de verdad: `api/src/schema.js`.

| Tabla Drizzle | Tabla MySQL | Qué guarda |
|---|---|---|
| `ticks` | `ticks` | Cada giro: corredor, montos, rate, status, SLA, operador, canal |
| `copilotBriefs` | `copilot_briefs` | Headline + body + severity de cada análisis SSE |

mysql2 solo en `setup-db.js` para `CREATE DATABASE`. El runtime usa Drizzle.

Al arrancar, si hay ticks **frescos** (últimas 2 h) se hidratan; si no, se borra y se siembra de nuevo. Los lotes en vivo se escriben con `createMany` sin bloquear el broadcast WS.

---

## Qué hace cada ruta

Angular **no tiene rutas de página**. `src/app/app.routes.ts` está vacío: es una sola vista (la mesa).

### HTTP (Express, `:3101`)

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/health` | ¿Vivo? `store` (`drizzle`/`memory`) + KPIs de la ventana de 2 h |
| `GET` | `/api/snapshot` | Hidrata tabla + rates + KPIs (por si el WS aún no conectó) |
| `GET` | `/api/copilot/stream` | **SSE.** Lee las ops de las últimas 2 h, persiste el brief y escribe palabra a palabra |

Ejemplo SSE:

```bash
curl -N http://localhost:3101/api/copilot/stream
```

Cada evento es `data: {"type":"token"|"meta"|"end", ...}`.

### WebSocket

| Ruta | Qué hace |
|---|---|
| `ws://localhost:3101/ws` (desde el browser: `ws://localhost:4210/ws` vía proxy) | Al conectar manda `{ type: "hello", rows, kpis, rates }`. Luego, cada ~110 ms, `{ type: "batch", rows, tps, kpis, rates }` con 1–4 tickets nuevos |

---

## Flujo (de punta a punta)

1. `engine.start()` hidrata Drizzle (o siembra **240** tickets con timestamps repartidos en 2 horas, sesgados a **USD→VES** y estados `en_cola` / `compliance`).
2. Cada 110 ms genera un lote, lo mete en un ring buffer de **420** filas, lo persiste con Drizzle y lo **broadcast** a todos los sockets.
3. `FeedService` abre un `WebSocket`, lo envuelve en un `Observable` RxJS y hace `retry` a 1.2 s si se cae.
4. Solo se pintan **48 filas** en el DOM (`track tick.id`). Las nuevas llevan clase `fresh` 850 ms (parpadeo verde).
5. Cada fila es `TickRow` con **`ChangeDetectionStrategy.OnPush`**: si el objeto de la fila no cambió, Angular no la vuelve a chequear.
6. `CopilotService` abre `EventSource('/api/copilot/stream')`. `copilot.analyze()` mira cola, corredor dominante y SLA. Si cola ≥ 35, share ≥ 35 % y SLA ≥ 12 min, dispara el headline de embotellamiento. El brief se guarda en `copilot_briefs`.
7. El texto se concatena token a token en un `signal`. Cada ~28 s se vuelve a leer la mesa.

Pausar tape: deja de aplicar `batch` en el cliente; el WS sigue vivo y los KPIs/rates se actualizan.

---

## Archivos (qué hace cada uno)

```
DashboardFinanciero/
  drizzle.config.mjs         drizzle-kit
  api/src/schema.js          ticks + copilot_briefs
  .env.example               DATABASE_URL
  api/src/server.js          Express + upgrade WS en /ws + rutas HTTP
  api/src/engine.js          Semilla 2 h, ticks, rates, KPIs, broadcast, persist Drizzle
  api/src/copilot.js         Heurística de embotellamiento + stream SSE + persist brief
  api/src/db.js              drizzle + pool mysql2
  api/src/load-env.js        lee .env
  api/src/setup-db.js        npm run db:setup
  proxy.conf.json            /api y /ws → :3101
  src/main.ts                bootstrap Angular
  src/app/app.config.ts      router (vacío) + error listeners
  src/app/app.routes.ts      []  → una sola pantalla
  src/app/models.ts          Tick, Kpis, FxRate, mensajes WS
  src/app/feed.service.ts    WebSocket + Signals + retry RxJS
  src/app/copilot.service.ts EventSource / SSE
  src/app/tick-row.ts        Fila OnPush (selector tr[desk-tick])
  src/app/copilot-panel.ts   Panel lateral OnPush
  src/app/app.ts             Shell: conecta feed + copilot
  src/app/app.html           Header, KPIs, tabla, copilot
  src/app/app.scss           Layout mesa
  src/styles.scss            Tokens (fondo mesa, up/down/warn)
  src/index.html             Título PUENTE · Mesa en vivo
```

### Ticket (campos)

`id`, `ts`, `type` (`remesa` \| `cambio`), `corridor` (`USD-VES`, `USD-COP`, `EUR-USD`, `USD-PEN`, `BRL-USD`), montos, `status` (`liberada` \| `en_cola` \| `compliance` \| `rechazada`), `slaMin`, `operator`, `channel` (`app` \| `ventanilla` \| `api` \| `agente`), destino (`Caracas`, `Bogotá`, …).

En MySQL, `from`/`to` se guardan como `ccy_from` / `ccy_to` (Drizzle `ccyFrom` / `ccyTo`).

---

## Por qué no se congela el browser

- Lotes, no un CD por ticket.
- Buffer de 48 filas visibles; el histórico de 2 h no se pinta.
- `OnPush` en `App`, `TickRow` y `CopilotPanel`.
- `contain: layout paint` en cada fila.
- `trackBy` = `tick.id` para reutilizar DOM.
- Signals: solo se notifica lo que cambió (lista, KPIs, tps, ids fresh).
- Drizzle no espera el INSERT antes de mandar el WS.

---

## Demo que tiene que verse

1. Punto verde **WS vivo** y TPS ~15–25.
2. Filas nuevas con flash verde.
3. KPI **Corredor caliente USD→VES** y cola alta.
4. Copilot en **ALERTA** con el texto de embotellamiento de las últimas 2 horas, escrito como máquina de escribir (SSE).
5. Botón **Releer las últimas 2 horas** dispara otro stream.
6. `/api/health` con `"store": "drizzle"` si MySQL está arriba.

---

## Cómo se construyó (paso a paso)

Orden real de armado. Backend **Node/Express** (no Laravel). ORM **Drizzle** (no Prisma).

1. Workspace Angular 21, una app, SCSS, sin SSR ni tests:

```bash
cd c:\xampp\htdocs\nivelDos
ng new puente --directory DashboardFinanciero --routing --style=scss --ssr=false --skip-git --skip-tests --defaults
```

2. Dependencias de mesa + API:

```bash
cd DashboardFinanciero
npm install express cors mysql2 drizzle-orm ws concurrently wait-on
npm install -D drizzle-kit
```

3. **Dominio** primero: `api/src/engine.js` (corredores, semilla 2 h, ring buffer 420, KPIs, broadcast) y `api/src/copilot.js` (heurística cola ≥ 35, share ≥ 35 %, SLA ≥ 12 min + tokens SSE).

4. **Adaptador HTTP/WS**: `api/src/server.js` en `:3101`, sube `WebSocketServer` en `/ws`, expone `/api/health`, `/api/snapshot`, `/api/copilot/stream`.

5. **Adaptador de persistencia (hexágono → afuera)**: `schema.js` (tablas `ticks`, `copilot_briefs`), `db.js` (pool mysql2 + Drizzle), `load-env.js`, `drizzle.config.mjs`, `setup-db.js` (`CREATE DATABASE puente` + `drizzle-kit push --force`). El engine hidrata o siembra; cada lote se inserta fire-and-forget.

6. **Adaptador UI**: Signals + `OnPush`. `models.ts` → `feed.service.ts` (WS + RxJS `retry`) → `tick-row.ts` → `copilot.service.ts` (EventSource) → `copilot-panel.ts` → `app.ts`. `proxy.conf.json` manda `/api` y `/ws` de `:4210` a `:3101`. Puerto desk en `angular.json`: `4210`.

7. Script `start`: `concurrently` API + `wait-on tcp:3101` + `ng serve --port 4210`.

8. `.env` / `.env.example`: `DATABASE_URL=mysql://root:@127.0.0.1:3306/puente`.

No hay `ng generate component` masivo: cada pieza de UI es un standalone en un `.ts`. El copilot **no** llama a un LLM; el “texto de IA” sale de `analyze()` en el dominio.
