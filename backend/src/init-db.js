// Crea la base (si no existe) y carga las tablas de schema.sql
import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { config } from './config.js';

if (!/^[A-Za-z0-9_]+$/.test(config.db.name)) {
  console.error('DB_NAME solo puede tener letras, números y guion bajo.');
  process.exit(1);
}

const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');

const conn = await mysql.createConnection({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  multipleStatements: true
});

await conn.query(
  `CREATE DATABASE IF NOT EXISTS \`${config.db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
);
await conn.query(`USE \`${config.db.name}\``);
await conn.query(schema);
await conn.end();

console.log(`Listo: base "${config.db.name}" con sus tablas y servicios iniciales.`);
