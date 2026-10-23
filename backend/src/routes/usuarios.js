import { Router } from 'express';
import { config } from '../config.js';

const UID = /^[A-Za-z0-9_-]{1,128}$/;

export function usuariosRouter(pool, { exigirLogin }, cuentas) {
  const r = Router();
  r.use(exigirLogin);

  // Solo el administrador único (rol admin Y su mail) puede eliminar cuentas
  const soloAdminUnico = (req, res, next) =>
    req.usuario.rol === 'admin' && req.usuario.email?.toLowerCase() === config.adminEmail
      ? next()
      : res.status(403).json({ error: 'Solo el administrador puede eliminar cuentas.' });

  r.delete('/:uid', soloAdminUnico, async (req, res) => {
    const uid = req.params.uid;
    if (!UID.test(uid)) return res.status(400).json({ error: 'Usuario inválido.' });
    if (uid === req.usuario.uid) return res.status(400).json({ error: 'No podés eliminar tu propia cuenta.' });

    try {
      const perfil = await cuentas.perfil(uid);
      if (perfil?.role === 'admin') {
        return res.status(403).json({ error: 'El administrador no se puede eliminar.' });
      }

      // Un peluquero con turnos asignados no se borra: primero hay que resolver esos turnos
      const [[{ asignados }]] = await pool.query(
        'SELECT COUNT(*) AS asignados FROM turnos WHERE peluquero_uid = ? AND usuario_uid <> ?',
        [uid, uid]
      );
      if (asignados > 0) {
        return res.status(409).json({
          error: `Tiene ${asignados} turno(s) asignado(s). Eliminalos primero desde Turnos.`
        });
      }

      await cuentas.borrar(uid);
      await pool.query('DELETE FROM turnos WHERE usuario_uid = ?', [uid]);
      res.status(204).end();
    } catch (e) {
      if (e?.sinConfigurar) {
        return res.status(503).json({ error: 'El servidor no está configurado para eliminar cuentas.' });
      }
      throw e;
    }
  });

  return r;
}