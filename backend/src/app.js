import express from 'express';
import cors from 'cors';
import { serviciosRouter } from './routes/servicios.js';
import { turnosRouter } from './routes/turnos.js';

export function crearApp({ pool, auth, corsOrigins }) {
  const app = express();

  app.use(cors({ origin: corsOrigins }));
  app.use(express.json({ limit: '50kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/servicios', serviciosRouter(pool, auth));
  app.use('/api/turnos', turnosRouter(pool, auth));

  app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

  // Error inesperado: se registra en el servidor y al cliente se le da un mensaje genérico
  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  });

  return app;
}
