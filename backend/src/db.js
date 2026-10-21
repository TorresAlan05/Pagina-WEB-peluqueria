import mysql from 'mysql2/promise';
import { config } from './config.js';

export function crearPool() {
  return mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
    dateStrings: true // DATE y TIME llegan como texto ("2026-10-21", "10:00:00"), sin líos de zona horaria
  });
}
