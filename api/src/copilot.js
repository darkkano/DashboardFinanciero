function group(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const id = row[key];
    map.set(id, (map.get(id) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function analyze(rows) {
  const pending = rows.filter((row) => row.status === 'en_cola' || row.status === 'compliance');
  const queued = rows.filter((row) => row.status === 'en_cola');
  const compliance = rows.filter((row) => row.status === 'compliance');
  const hot = group(pending, 'corridor')[0] || ['USD-VES', 0];
  const hotCity = rows.find((row) => row.corridor === hot[0])?.city || 'Caracas';
  const share = pending.length ? Math.round((hot[1] / pending.length) * 100) : 0;
  const sla = pending.length
    ? Math.round(pending.reduce((sum, row) => sum + row.slaMin, 0) / pending.length)
    : 0;
  const channel = group(queued, 'channel')[0] || ['ventanilla', 0];
  const label = String(hot[0]).replace('-', '→');

  const bottleneck = pending.length >= 35 && share >= 35 && sla >= 12;
  const headline = bottleneck
    ? 'Hay un embotellamiento en las operaciones de las últimas 2 horas'
    : pending.length
      ? 'La mesa fluye, con fricción contenida en un corredor'
      : 'No hay cola material en la ventana de 2 horas';

  const body = bottleneck
    ? `El corredor ${label} concentra el ${share}% de la cola (${hot[1]} giros hacia ${hotCity}) y el SLA mediano se fue a ${sla} minutos. Compliance retiene ${compliance.length} envíos. ${channel[0]} aporta ${channel[1]} tickets en espera. Si no se abre un segundo operador, la cola sigue creciendo con cada tick.`
    : `Ventana de ${rows.length} tickets. Pendientes ${pending.length}. Corredor más cargado: ${label} (${share}%). SLA medio ${sla} min. Sigo leyendo el tape.`;

  return {
    severity: bottleneck ? 'high' : pending.length > 20 ? 'mid' : 'ok',
    headline,
    body,
    facts: [
      { label: 'Cola 2h', value: String(pending.length) },
      { label: 'Corredor', value: label },
      { label: 'SLA', value: `${sla} min` },
      { label: 'Compliance', value: String(compliance.length) },
    ],
  };
}

function tokenize(brief) {
  return `${brief.headline}. ${brief.body}`.split(/(\s+)/).filter((part) => part.length);
}

function persistBrief(brief) {
  try {
    const { db, schema } = require('./db');
    db.insert(schema.copilotBriefs)
      .values({
        headline: String(brief.headline).slice(0, 255),
        body: brief.body,
        severity: brief.severity,
      })
      .catch(() => {});
  } catch {
    /* API sigue si Drizzle no está */
  }
}

async function stream(res, brief) {
  persistBrief(brief);
  const tokens = tokenize(brief);
  res.write(`data: ${JSON.stringify({ type: 'meta', severity: brief.severity, facts: brief.facts, headline: brief.headline })}\n\n`);
  for (const token of tokens) {
    res.write(`data: ${JSON.stringify({ type: 'token', text: token })}\n\n`);
    await new Promise((resolve) => setTimeout(resolve, 22));
  }
  res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
}

module.exports = { analyze, stream };
