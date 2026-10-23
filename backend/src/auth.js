import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS_URL = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
);

/**
 * Verifica el ID token (un JWT) que Firebase le da al usuario al loguearse.
 * Comprueba la firma con las claves públicas de Google, el emisor y que sea de ESTE proyecto.
 */
export function verificadorFirebase(projectId, jwks = createRemoteJWKSet(JWKS_URL)) {
  return async (token) => {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256']
    });
    if (!payload.sub) throw new Error('Token sin usuario');
    return { uid: payload.sub, email: payload.email ?? null };
  };
}

const urlUsuario = (projectId, uid) =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(uid)}`;

/**
 * Lee el rol del usuario en Firestore (users/{uid}.role): 'admin', 'peluquero' o 'cliente'.
 * Usa el propio token del usuario: las reglas de Firestore dejan que cada uno lea su perfil,
 * así el backend no necesita ninguna clave secreta.
 */
export function lectorRolFirestore(projectId) {
  const cache = new Map(); // uid -> { rol, vence }
  return async (uid, token) => {
    const guardado = cache.get(uid);
    if (guardado && guardado.vence > Date.now()) return guardado.rol;

    try {
      const r = await fetch(urlUsuario(projectId, uid), { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok || r.status === 404) {
        const doc = r.ok ? await r.json() : null;
        const valor = doc?.fields?.role?.stringValue;
        const rol = valor === 'admin' || valor === 'peluquero' ? valor : 'cliente';
        cache.set(uid, { rol, vence: Date.now() + 60_000 }); // se recuerda 1 minuto
        return rol;
      }
    } catch {
      /* sin conexión con Firestore: se usa el rol de menos privilegios */
    }
    return 'cliente';
  };
}

/**
 * Datos de un peluquero (users/{uid}). Devuelve null si no existe o si no tiene rol 'peluquero'.
 * Se lee con el token de quien reserva: las reglas de Firestore dejan ver los perfiles de peluqueros.
 * El nombre sale de Firestore, no del navegador, así no se puede falsificar.
 */
export function lectorPeluqueroFirestore(projectId) {
  return async (uid, token) => {
    try {
      const r = await fetch(urlUsuario(projectId, uid), { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      const campos = (await r.json())?.fields ?? {};
      if (campos.role?.stringValue !== 'peluquero') return null;
      const nombre = `${campos.nombre?.stringValue ?? ''} ${campos.apellido?.stringValue ?? ''}`.trim();
      return { uid, nombre: nombre || campos.email?.stringValue || 'Peluquero' };
    } catch {
      return null;
    }
  };
}

/** Arma los middlewares de autenticación a partir de las funciones anteriores. */
export function crearAuth({ verificarToken, obtenerRol, obtenerPeluquero }) {
  const exigirLogin = async (req, res, next) => {
    const m = (req.headers.authorization ?? '').match(/^Bearer (.+)$/i);
    if (!m) return res.status(401).json({ error: 'Falta iniciar sesión.' });

    try {
      const { uid, email } = await verificarToken(m[1]);
      const rol = await obtenerRol(uid, m[1]);
      req.usuario = { uid, email, rol };
      req.token = m[1];
      next();
    } catch {
      res.status(401).json({ error: 'Sesión inválida o vencida.' });
    }
  };

  const exigirRol = (...roles) => (req, res, next) =>
    roles.includes(req.usuario?.rol)
      ? next()
      : res.status(403).json({ error: 'No tenés permiso para hacer esto.' });

  return { exigirLogin, exigirRol, obtenerPeluquero };
}