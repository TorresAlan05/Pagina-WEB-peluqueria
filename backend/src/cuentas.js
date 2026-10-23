import { config } from './config.js';

/**
 * Operaciones sobre cuentas de Firebase que el navegador NO puede hacer
 * (borrar el login de OTRA persona). Usa la cuenta de servicio FIREBASE_SERVICE_ACCOUNT
 * y recién se inicializa cuando hace falta, así la API arranca igual si falta la clave.
 */
export function crearCuentasFirebase() {
  let admin = null;

  async function iniciar() {
    if (admin) return admin;
    try {
      if (!config.firebaseServiceAccount) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT');
      const [{ initializeApp, cert, getApps }, { getAuth }, { getFirestore }] = await Promise.all([
        import('firebase-admin/app'),
        import('firebase-admin/auth'),
        import('firebase-admin/firestore')
      ]);
      const app =
        getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(config.firebaseServiceAccount)) });
      admin = { auth: getAuth(app), db: getFirestore(app) };
      return admin;
    } catch (e) {
      console.error('Firebase Admin no está configurado:', e.message);
      throw Object.assign(new Error('Firebase Admin no configurado'), { sinConfigurar: true });
    }
  }

  return {
    /** Perfil guardado en Firestore (users/{uid}), o null si no tiene. */
    async perfil(uid) {
      const { db } = await iniciar();
      const snap = await db.doc(`users/${uid}`).get();
      return snap.exists ? snap.data() : null;
    },

    /** Borra el login (Authentication) y el perfil (Firestore). Si alguno ya no existe, sigue. */
    async borrar(uid) {
      const { auth, db } = await iniciar();
      try {
        await auth.deleteUser(uid);
      } catch (e) {
        if (e?.code !== 'auth/user-not-found') throw e;
      }
      await db.doc(`users/${uid}`).delete();
    }
  };
}