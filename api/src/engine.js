const CORRIDORS = [
  { id: 'USD-VES', from: 'USD', to: 'VES', rate: 96.8, city: 'Caracas' },
  { id: 'USD-COP', from: 'USD', to: 'COP', rate: 4125, city: 'Bogotá' },
  { id: 'EUR-USD', from: 'EUR', to: 'USD', rate: 1.084, city: 'Miami' },
  { id: 'USD-PEN', from: 'USD', to: 'PEN', rate: 3.74, city: 'Lima' },
  { id: 'BRL-USD', from: 'BRL', to: 'USD', rate: 0.188, city: 'São Paulo' },
];

const ORIGINS = ['Madrid', 'Miami', 'Bogotá', 'Santiago', 'CDMX', 'Lisboa', 'Panamá'];
const OPERATORS = ['Rivas', 'Mora', 'Chen', 'Duarte', 'Silva', 'Paredes'];
const CHANNELS = ['app', 'ventanilla', 'api', 'agente'];

const WINDOW_MS = 2 * 60 * 60 * 1000;
const BUFFER = 420;

let seq = 10000;
const rows = [];
const clients = new Set();
const rates = CORRIDORS.map((item) => ({
  id: item.id,
  from: item.from,
  to: item.to,
  value: item.rate,
  dir: 1,
}));

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function weightedCorridor() {
  const roll = Math.random();
  if (roll < 0.48) {
    return CORRIDORS[0];
  }
  if (roll < 0.68) {
    return CORRIDORS[1];
  }
  return CORRIDORS[Math.floor(Math.random() * CORRIDORS.length)];
}

function statusFor(corridor, live) {
  if (corridor.id === 'USD-VES') {
    const roll = Math.random();
    if (roll < 0.42) {
      return 'en_cola';
    }
    if (roll < 0.62) {
      return 'compliance';
    }
    if (roll < 0.68) {
      return 'rechazada';
    }
    return 'liberada';
  }
  if (!live && Math.random() < 0.18) {
    return 'en_cola';
  }
  if (Math.random() < 0.08) {
    return 'compliance';
  }
  if (Math.random() < 0.04) {
    return 'rechazada';
  }
  return 'liberada';
}

function makeTx(at, live = false) {
  const corridor = weightedCorridor();
  const quote = rates.find((item) => item.id === corridor.id) || corridor;
  const amountSrc = Number((40 + Math.random() * 2400).toFixed(2));
  const amountDst = Number((amountSrc * quote.value).toFixed(2));
  const status = statusFor(corridor, live);
  seq += 1;
  return {
    id: `RM-${seq}`,
    ts: at,
    type: Math.random() < 0.72 ? 'remesa' : 'cambio',
    corridor: corridor.id,
    from: corridor.from,
    to: corridor.to,
    city: corridor.city,
    origin: pick(ORIGINS),
    amountSrc,
    amountDst,
    rate: quote.value,
    status,
    slaMin: status === 'liberada' ? 2 + Math.floor(Math.random() * 6) : 11 + Math.floor(Math.random() * 16),
    operator: pick(OPERATORS),
    channel: pick(CHANNELS),
  };
}

function pushRow(row) {
  rows.push(row);
  if (rows.length > BUFFER) {
    rows.shift();
  }
}

function walkRates() {
  for (const item of rates) {
    const delta = item.value * (Math.random() * 0.0016 - 0.0007);
    item.value = Number((item.value + delta).toFixed(item.value > 20 ? 2 : 4));
    item.dir = delta >= 0 ? 1 : -1;
  }
}

function kpis() {
  const now = Date.now();
  const windowRows = rows.filter((row) => now - row.ts <= WINDOW_MS);
  const pending = windowRows.filter((row) => row.status === 'en_cola' || row.status === 'compliance');
  const byCorridor = new Map();
  for (const row of pending) {
    byCorridor.set(row.corridor, (byCorridor.get(row.corridor) || 0) + 1);
  }
  let hot = { id: '—', count: 0 };
  for (const [id, count] of byCorridor) {
    if (count > hot.count) {
      hot = { id, count };
    }
  }
  const sla = pending.length
    ? pending.reduce((sum, row) => sum + row.slaMin, 0) / pending.length
    : 0;
  return {
    windowMs: WINDOW_MS,
    total: windowRows.length,
    pending: pending.length,
    released: windowRows.filter((row) => row.status === 'liberada').length,
    sla: Number(sla.toFixed(1)),
    hotCorridor: hot.id,
    hotShare: pending.length ? Number((hot.count / pending.length).toFixed(2)) : 0,
    volumeUsd: Number(
      windowRows
        .reduce((sum, row) => sum + (row.from === 'USD' ? row.amountSrc : row.amountDst), 0)
        .toFixed(0),
    ),
  };
}

function snapshot() {
  return {
    rows: rows.slice(-80),
    kpis: kpis(),
    rates: rates.map((item) => ({ ...item })),
  };
}

function seed() {
  const now = Date.now();
  for (let i = 0; i < 240; i++) {
    const at = now - WINDOW_MS + Math.floor((WINDOW_MS / 240) * i);
    pushRow(makeTx(at, false));
  }
}

function getWindow() {
  const now = Date.now();
  return rows.filter((row) => now - row.ts <= WINDOW_MS);
}

function toRecord(row) {
  return {
    id: row.id,
    ts: new Date(row.ts),
    type: row.type,
    corridor: row.corridor,
    ccyFrom: row.from,
    ccyTo: row.to,
    city: row.city,
    origin: row.origin,
    amountSrc: row.amountSrc,
    amountDst: row.amountDst,
    rate: row.rate,
    status: row.status,
    slaMin: row.slaMin,
    operator: row.operator,
    channel: row.channel,
  };
}

function fromRecord(row) {
  return {
    id: row.id,
    ts: new Date(row.ts).getTime(),
    type: row.type,
    corridor: row.corridor,
    from: row.ccyFrom,
    to: row.ccyTo,
    city: row.city,
    origin: row.origin,
    amountSrc: row.amountSrc,
    amountDst: row.amountDst,
    rate: row.rate,
    status: row.status,
    slaMin: row.slaMin,
    operator: row.operator,
    channel: row.channel,
  };
}

let dbOk = false;
let db;
let schema;

function persist(batch) {
  if (!dbOk || !db || !batch.length) {
    return;
  }
  db.insert(schema.ticks)
    .values(batch.map(toRecord))
    .catch(() => {
      dbOk = false;
    });
}

function broadcast(payload) {
  const raw = JSON.stringify(payload);
  for (const socket of clients) {
    if (socket.readyState === 1) {
      socket.send(raw);
    }
  }
}

async function hydrate() {
  try {
    ({ db, schema } = require('./db'));
    const { desc } = require('drizzle-orm');
    const existing = await db.select().from(schema.ticks).orderBy(desc(schema.ticks.ts)).limit(BUFFER);
    existing.reverse();
    const newest = existing.at(-1);
    const fresh = newest && Date.now() - new Date(newest.ts).getTime() <= WINDOW_MS;
    if (fresh) {
      for (const row of existing) {
        pushRow(fromRecord(row));
        const n = Number(String(row.id).replace('RM-', ''));
        if (Number.isFinite(n) && n > seq) {
          seq = n;
        }
      }
      dbOk = true;
      console.log(`Drizzle: ${existing.length} ticks hidratados.`);
      return;
    }
    await db.delete(schema.ticks);
    seed();
    await db.insert(schema.ticks).values(rows.map(toRecord));
    dbOk = true;
    console.log(`Drizzle: semilla de ${rows.length} ticks.`);
  } catch (error) {
    rows.length = 0;
    seed();
    dbOk = false;
    console.warn(
      `Drizzle no disponible (${String(error.message || error).split('\n')[0]}). Tape solo en memoria.`,
    );
  }
}

async function start(wss) {
  await hydrate();
  wss.on('connection', (socket) => {
    clients.add(socket);
    socket.send(JSON.stringify({ type: 'hello', ...snapshot(), tps: 0 }));
    socket.on('close', () => clients.delete(socket));
  });

  let tps = 12;
  setInterval(() => {
    walkRates();
    const burst = 1 + Math.floor(Math.random() * 4);
    const batch = [];
    const now = Date.now();
    for (let i = 0; i < burst; i++) {
      const row = makeTx(now, true);
      pushRow(row);
      batch.push(row);
    }
    persist(batch);
    tps = Number((tps * 0.82 + (burst / 0.11) * 0.18).toFixed(1));
    broadcast({
      type: 'batch',
      rows: batch,
      tps,
      kpis: kpis(),
      rates: rates.map((item) => ({ ...item })),
    });
  }, 110);
}

module.exports = { start, snapshot, getWindow, kpis, source: () => (dbOk ? 'drizzle' : 'memory') };
