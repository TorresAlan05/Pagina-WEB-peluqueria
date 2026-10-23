// Punto de entrada para Vercel: exporta la app de Express como función serverless.
// (En tu PC se sigue usando "npm start" → src/server.js, que hace app.listen.)
import { config } from '../src/config.js';
import { crearPool } from '../src/db.js';
import { crearApp } from '../src/app.js';
import {
  crearAuth,
  lectorPeluqueroFirestore,
  lectorRolFirestore,
  verificadorFirebase
} from '../src/auth.js';

// Se crean una vez por instancia de la función y se reutilizan entre peticiones
const pool = crearPool();
const auth = crearAuth({
  verificarToken: verificadorFirebase(config.firebaseProjectId),
  obtenerRol: lectorRolFirestore(config.firebaseProjectId),
  obtenerPeluquero: lectorPeluqueroFirestore(config.firebaseProjectId)
});

export default crearApp({ pool, auth, corsOrigins: config.corsOrigins });