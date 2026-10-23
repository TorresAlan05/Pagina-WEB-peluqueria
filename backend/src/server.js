import { config } from './config.js';
import { crearPool } from './db.js';
import { crearApp } from './app.js';
import {
  crearAuth,
  lectorPeluqueroFirestore,
  lectorRolFirestore,
  verificadorFirebase
} from './auth.js';

const pool = crearPool();
const auth = crearAuth({
  verificarToken: verificadorFirebase(config.firebaseProjectId),
  obtenerRol: lectorRolFirestore(config.firebaseProjectId),
  obtenerPeluquero: lectorPeluqueroFirestore(config.firebaseProjectId)
});

const app = crearApp({ pool, auth, corsOrigins: config.corsOrigins });

app.listen(config.port, () => {
  console.log(`API de la peluquería en http://localhost:${config.port}`);
});