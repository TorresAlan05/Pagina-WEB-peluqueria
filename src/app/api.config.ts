// Dirección del backend (API).
//  - Corriendo en tu compu (ng serve) → usa el backend local.
//  - En el sitio publicado en Firebase → usa el backend desplegado en Vercel.
//
// IMPORTANTE: después de desplegar en Vercel, reemplazá la dirección de abajo por la real
// (la que te muestra Vercel, terminada en "/api").
const API_LOCAL = 'http://localhost:3000/api';
const API_PRODUCCION = 'https://REEMPLAZAR-POR-TU-PROYECTO.vercel.app/api';

const esLocal = ['localhost', '127.0.0.1'].includes(globalThis.location?.hostname ?? '');

export const API_URL = esLocal ? API_LOCAL : API_PRODUCCION;
