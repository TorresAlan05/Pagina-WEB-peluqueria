import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';
import { config } from './config.js';

/** Opciones SSL para mysql2, o undefined si DB_SSL no está activado. */
export function opcionesSsl() {
  if (!config.db.ssl) return undefined;

  let ca = config.db.sslCa;
  if (!ca && config.db.sslCaFile) {
    try {
      ca = readFileSync(config.db.sslCaFile, 'utf8');
    } catch {
      throw new Error(
        `No se encontró el certificado CA en "${config.db.sslCaFile}". ` +
        'En Vercel no hay archivos locales: borrá DB_SSL_CA_FILE y pegá el contenido del ca.pem en DB_SSL_CA.'
      );
    }
  }
  if (ca) return { ca, rejectUnauthorized: true };

  console.warn('DB_SSL activo sin certificado CA (DB_SSL_CA / DB_SSL_CA_FILE): la conexión va cifrada pero no se verifica el servidor.');
  return { rejectUnauthorized: false };
}

/** Datos de conexión comunes (sin elegir base), usados por el pool y por init-db. */
export function datosConexion() {
  return {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    ssl: opcionesSsl()
  };
}

export function crearPool() {
  return mysql.createPool({
    ...datosConexion(),
    database: config.db.name,
    waitForConnections: true,
    connectionLimit: config.db.poolSize,
    charset: 'utf8mb4',
    dateStrings: true // DATE y TIME llegan como texto ("2026-10-21", "10:00:00"), sin líos de zona horaria
  });
}
