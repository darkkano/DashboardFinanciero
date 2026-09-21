const { execSync } = require('child_process');
const path = require('path');
const mysql = require('mysql2/promise');
const { loadEnv } = require('./load-env');

const root = path.join(__dirname, '..', '..');
loadEnv(root);

const url = process.env.DATABASE_URL || 'mysql://root:@127.0.0.1:3306/puente';

async function ensureDatabase() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
  });
  await conn.query(
    'CREATE DATABASE IF NOT EXISTS `puente` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  );
  await conn.end();
}

async function main() {
  console.log('Drizzle → MySQL puente');
  await ensureDatabase();
  execSync('npx drizzle-kit push --force', {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
  const { db, schema, pool } = require('./db');
  await db.delete(schema.ticks);
  await db.delete(schema.copilotBriefs);
  console.log('Tablas ticks y copilot_briefs listas. El API siembra al arrancar.');
  await pool.end();
}

main().catch((error) => {
  console.error('\nNo pude crear la BD. Arranca MySQL en XAMPP (MySQL → Start).\n');
  console.error(error.message);
  process.exit(1);
});
