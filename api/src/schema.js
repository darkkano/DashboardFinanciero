const { mysqlTable, varchar, int, float, text, datetime, timestamp, index } = require('drizzle-orm/mysql-core');

const ticks = mysqlTable(
  'ticks',
  {
    id: varchar('id', { length: 32 }).primaryKey(),
    ts: datetime('ts').notNull(),
    type: varchar('type', { length: 16 }).notNull(),
    corridor: varchar('corridor', { length: 16 }).notNull(),
    ccyFrom: varchar('ccy_from', { length: 8 }).notNull(),
    ccyTo: varchar('ccy_to', { length: 8 }).notNull(),
    city: varchar('city', { length: 40 }).notNull(),
    origin: varchar('origin', { length: 40 }).notNull(),
    amountSrc: float('amount_src').notNull(),
    amountDst: float('amount_dst').notNull(),
    rate: float('rate').notNull(),
    status: varchar('status', { length: 16 }).notNull(),
    slaMin: int('sla_min').notNull(),
    operator: varchar('operator', { length: 40 }).notNull(),
    channel: varchar('channel', { length: 16 }).notNull(),
  },
  (t) => ({
    tsIdx: index('idx_ticks_ts').on(t.ts),
    statusIdx: index('idx_ticks_status').on(t.status),
    corridorIdx: index('idx_ticks_corridor').on(t.corridor),
  }),
);

const copilotBriefs = mysqlTable('copilot_briefs', {
  id: int('id').autoincrement().primaryKey(),
  headline: varchar('headline', { length: 255 }).notNull(),
  body: text('body').notNull(),
  severity: varchar('severity', { length: 8 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

module.exports = { ticks, copilotBriefs };
