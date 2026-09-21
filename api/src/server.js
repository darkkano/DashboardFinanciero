const http = require('http');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const engine = require('./engine');
const copilot = require('./copilot');

const app = express();
const port = process.env.PORT || 3101;

app.use(cors());
app.use(express.json());

// GET /api/health — liveness + tamaño de la ventana en memoria
app.get('/api/health', (_req, res) => {
  const kpis = engine.kpis();
  res.json({ ok: true, service: 'puente-desk', store: engine.source(), kpis });
});

// GET /api/snapshot — hidrata la mesa antes de que llegue el primer batch WS
app.get('/api/snapshot', (_req, res) => {
  res.json(engine.snapshot());
});

// GET /api/copilot/stream — SSE, el copilot lee la ventana de 2h y escribe en streaming
app.get('/api/copilot/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const brief = copilot.analyze(engine.getWindow());
  req.on('close', () => res.end());
  try {
    await copilot.stream(res, brief);
  } finally {
    res.end();
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

async function boot() {
  await engine.start(wss);
  server.listen(port, () => {
    console.log(
      `PUENTE desk API http://localhost:${port}  ws://localhost:${port}/ws  [${engine.source()}]`,
    );
  });
}

boot().catch((error) => {
  console.error(error);
  process.exit(1);
});
