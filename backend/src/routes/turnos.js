import { Router } from 'express';
import { esFechaValida, idValido, textoValido, validarDiaHora } from '../validaciones.js';

const SELECT = `
  SELECT t.id, t.mail, t.nombre, t.apellido, t.servicio_id, s.nombre AS servicio, s.precio,
         t.dia, t.hora, t.estado, t.observaciones, t.creado_en
  FROM turnos t JOIN servicios s ON s.id = t.servicio_id`;

const mapTurno = (r) => ({
  id: r.id,
  mail: r.mail,
  nombre: r.nombre,
  apellido: r.apellido,
  servicio_id: r.servicio_id,
  servicio: r.servicio,
  precio: Number(r.precio),
  dia: r.dia,                       // "2026-10-21"
  hora: String(r.hora).slice(0, 5), // "10:00"
  estado: r.estado,
  observaciones: r.observaciones ?? '',
  creado_en: r.creado_en
});

export function turnosRouter(pool, { exigirLogin }) {
  const r = Router();
  r.use(exigirLogin); // todo lo de turnos requiere sesión

  const buscar = async (id) => {
    const [rows] = await pool.query(`${SELECT} WHERE t.id = ?`, [id]);
    return rows[0] ?? null;
  };
  // Un cliente solo toca sus turnos; el admin, todos
  const puedeTocar = (req, fila) => req.usuario.rol === 'admin' || fila.usuario_uid === req.usuario.uid;

  // Admin: todos los turnos. Cliente: solo los suyos.
  r.get('/', async (req, res) => {
    const esAdmin = req.usuario.rol === 'admin';
    const [rows] = await pool.query(
      `${SELECT} ${esAdmin ? '' : 'WHERE t.usuario_uid = ?'} ORDER BY t.dia, t.hora`,
      esAdmin ? [] : [req.usuario.uid]
    );
    res.json(rows.map(mapTurno));
  });

  // Horas ya reservadas en un día (para deshabilitarlas en el formulario)
  r.get('/ocupados', async (req, res) => {
    const dia = req.query.dia;
    if (!esFechaValida(dia)) return res.status(400).json({ error: 'Falta ?dia=AAAA-MM-DD.' });
    const [rows] = await pool.query('SELECT hora FROM turnos WHERE dia = ? ORDER BY hora', [dia]);
    res.json(rows.map((x) => String(x.hora).slice(0, 5)));
  });

  r.get('/:id', async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(400).json({ error: 'Id inválido.' });
    const fila = await buscar(id);
    if (!fila) return res.status(404).json({ error: 'Turno no encontrado.' });
    if (!puedeTocar(req, await filaConUid(pool, id))) return res.status(403).json({ error: 'No es tu turno.' });
    res.json(mapTurno(fila));
  });

  r.post('/', async (req, res) => {
    const b = req.body ?? {};
    const nombre = textoValido(b.nombre, 60);
    const apellido = textoValido(b.apellido, 60);
    const servicioId = idValido(b.servicio_id);
    const obs = typeof b.observaciones === 'string' ? b.observaciones.trim().slice(0, 500) : '';

    if (!nombre || !apellido) return res.status(400).json({ error: 'Nombre y apellido son obligatorios.' });
    if (!servicioId) return res.status(400).json({ error: 'Elegí un servicio.' });
    const errorFecha = validarDiaHora(b.dia, b.hora);
    if (errorFecha) return res.status(400).json({ error: errorFecha });

    const [srv] = await pool.query('SELECT id FROM servicios WHERE id = ?', [servicioId]);
    if (srv.length === 0) return res.status(400).json({ error: 'Ese servicio no existe.' });

    try {
      const [ins] = await pool.query(
        `INSERT INTO turnos (usuario_uid, mail, nombre, apellido, servicio_id, dia, hora, observaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.usuario.uid, req.usuario.email ?? '', nombre, apellido, servicioId, b.dia, b.hora, obs || null]
      );
      res.status(201).json(mapTurno(await buscar(ins.insertId)));
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ese horario ya fue reservado. Elegí otro.' });
      throw e;
    }
  });

  r.put('/:id', async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(400).json({ error: 'Id inválido.' });

    const actual = await buscar(id);
    if (!actual) return res.status(404).json({ error: 'Turno no encontrado.' });
    if (!puedeTocar(req, await filaConUid(pool, id))) return res.status(403).json({ error: 'No es tu turno.' });

    const b = req.body ?? {};
    const nombre = b.nombre === undefined ? actual.nombre : textoValido(b.nombre, 60);
    const apellido = b.apellido === undefined ? actual.apellido : textoValido(b.apellido, 60);
    const servicioId = b.servicio_id === undefined ? actual.servicio_id : idValido(b.servicio_id);
    const dia = b.dia === undefined ? actual.dia : b.dia;
    const hora = b.hora === undefined ? String(actual.hora).slice(0, 5) : b.hora;
    const obs = b.observaciones === undefined
      ? (actual.observaciones ?? '')
      : (typeof b.observaciones === 'string' ? b.observaciones.trim().slice(0, 500) : '');
    // Solo el admin cambia el estado; si un cliente lo manda, se ignora
    const estado = req.usuario.rol === 'admin' && b.estado !== undefined ? b.estado : actual.estado;

    if (!nombre || !apellido) return res.status(400).json({ error: 'Nombre y apellido no son válidos.' });
    if (!servicioId) return res.status(400).json({ error: 'Servicio inválido.' });
    if (!['Pendiente', 'Confirmado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido (Pendiente o Confirmado).' });
    }
    // Las reglas de fecha/hora solo se exigen si se cambió el horario
    if (dia !== actual.dia || hora !== String(actual.hora).slice(0, 5)) {
      const errorFecha = validarDiaHora(dia, hora);
      if (errorFecha) return res.status(400).json({ error: errorFecha });
    }
    if (servicioId !== actual.servicio_id) {
      const [srv] = await pool.query('SELECT id FROM servicios WHERE id = ?', [servicioId]);
      if (srv.length === 0) return res.status(400).json({ error: 'Ese servicio no existe.' });
    }

    try {
      await pool.query(
        `UPDATE turnos SET nombre = ?, apellido = ?, servicio_id = ?, dia = ?, hora = ?, estado = ?, observaciones = ?
         WHERE id = ?`,
        [nombre, apellido, servicioId, dia, hora, estado, obs || null, id]
      );
      res.json(mapTurno(await buscar(id)));
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ese horario ya fue reservado. Elegí otro.' });
      throw e;
    }
  });

  r.delete('/:id', async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(400).json({ error: 'Id inválido.' });

    const fila = await filaConUid(pool, id);
    if (!fila) return res.status(404).json({ error: 'Turno no encontrado.' });
    if (!puedeTocar(req, fila)) return res.status(403).json({ error: 'No es tu turno.' });

    await pool.query('DELETE FROM turnos WHERE id = ?', [id]);
    res.status(204).end();
  });

  return r;
}

// El uid del dueño no se manda al front, por eso se consulta aparte
async function filaConUid(pool, id) {
  const [rows] = await pool.query('SELECT id, usuario_uid FROM turnos WHERE id = ?', [id]);
  return rows[0] ?? null;
}
