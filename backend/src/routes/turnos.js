import { Router } from 'express';
import { esFechaValida, idValido, textoValido, validarDiaHora } from '../validaciones.js';

const SELECT = `
  SELECT t.id, t.usuario_uid AS uid, t.mail, t.nombre, t.apellido, t.servicio_id, s.nombre AS servicio, s.precio,
         t.peluquero_uid, t.peluquero_nombre,
         t.dia, t.hora, t.estado, t.observaciones, t.creado_en
  FROM turnos t JOIN servicios s ON s.id = t.servicio_id`;

const mapTurno = (r) => ({
  id: r.id,
  uid: r.uid,
  mail: r.mail,
  nombre: r.nombre,
  apellido: r.apellido,
  servicio_id: r.servicio_id,
  servicio: r.servicio,
  precio: Number(r.precio),
  peluquero_uid: r.peluquero_uid ?? null,
  peluquero: r.peluquero_nombre ?? null,
  dia: r.dia,                       // "2026-10-21"
  hora: String(r.hora).slice(0, 5), // "10:00"
  estado: r.estado,
  observaciones: r.observaciones ?? '',
  creado_en: r.creado_en
});

/** Acepta el servicio por nombre ("Corte") o por id. Devuelve el id, o null si no existe. */
async function resolverServicio(pool, b) {
  let rows;
  if (b.servicio_id !== undefined) {
    const id = idValido(b.servicio_id);
    if (!id) return null;
    [rows] = await pool.query('SELECT id FROM servicios WHERE id = ?', [id]);
  } else {
    const nombre = textoValido(b.servicio, 80);
    if (!nombre) return null;
    [rows] = await pool.query('SELECT id FROM servicios WHERE nombre = ?', [nombre]);
  }
  return rows[0]?.id ?? null;
}

export function turnosRouter(pool, { exigirLogin, obtenerPeluquero }) {
  const r = Router();
  r.use(exigirLogin); // todo lo de turnos requiere sesión

  const buscar = async (id) => {
    const [rows] = await pool.query(`${SELECT} WHERE t.id = ?`, [id]);
    return rows[0] ?? null;
  };
    // Modificar o borrar: el admin (todos) o el cliente (solo los suyos). El peluquero solo mira.
  const puedeTocar = (req, fila) =>
    req.usuario.rol === 'admin' || (req.usuario.rol === 'cliente' && fila.usuario_uid === req.usuario.uid);
  // Ver un turno: además, el peluquero ve los que le asignaron a él
  const puedeVer = (req, fila) =>
    puedeTocar(req, fila) || (req.usuario.rol === 'peluquero' && fila.peluquero_uid === req.usuario.uid);

  // Admin: todos los turnos (o solo los suyos con ?mios=true). Los demás: siempre solo los suyos.
    // Admin: todos (o solo los suyos con ?mios=true). Peluquero: solo los que le asignaron.
  // Cliente: solo los suyos.
  r.get('/', async (req, res) => {
    const { rol, uid } = req.usuario;
    let filtro = '';
    let params = [];
    if (rol === 'peluquero') {
      filtro = 'WHERE t.peluquero_uid = ?';
      params = [uid];
    } else if (rol !== 'admin' || req.query.mios === 'true') {
      filtro = 'WHERE t.usuario_uid = ?';
      params = [uid];
    }
    const [rows] = await pool.query(`${SELECT} ${filtro} ORDER BY t.dia, t.hora`, params);
    res.json(rows.map(mapTurno));
  });

  // Horas ya reservadas en un día CON UN PELUQUERO (para deshabilitarlas en el formulario)
  r.get('/ocupados', async (req, res) => {
    const dia = req.query.dia;
    if (!esFechaValida(dia)) return res.status(400).json({ error: 'Falta ?dia=AAAA-MM-DD.' });

    const peluquero = typeof req.query.peluquero === 'string' ? req.query.peluquero : '';
    if (!peluquero) return res.json([]); // sin peluquero elegido no hay horarios tomados que mostrar

    const [rows] = await pool.query(
      'SELECT id, hora FROM turnos WHERE dia = ? AND peluquero_uid = ? ORDER BY hora',
      [dia, peluquero]
    );
    res.json(rows.map((x) => ({ hora: String(x.hora).slice(0, 5), turnoId: x.id })));
  });

    r.get('/:id', async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(400).json({ error: 'Id inválido.' });
    const fila = await buscar(id);
    if (!fila) return res.status(404).json({ error: 'Turno no encontrado.' });
    if (!puedeVer(req, await filaConUid(pool, id))) return res.status(403).json({ error: 'No es tu turno.' });
    res.json(mapTurno(fila));
  });

  r.post('/', async (req, res) => {
    if (req.usuario.rol === 'peluquero') {
      return res.status(403).json({ error: 'Los peluqueros no reservan turnos.' });
    }
    const b = req.body ?? {};
    const nombre = textoValido(b.nombre, 60);
    const apellido = textoValido(b.apellido, 60);
    const obs = typeof b.observaciones === 'string' ? b.observaciones.trim().slice(0, 500) : '';

    if (!nombre || !apellido) return res.status(400).json({ error: 'Nombre y apellido son obligatorios.' });
    const errorFecha = validarDiaHora(b.dia, b.hora);
    if (errorFecha) return res.status(400).json({ error: errorFecha });

    const servicioId = await resolverServicio(pool, b);
    if (!servicioId) return res.status(400).json({ error: 'Elegí un servicio que exista.' });

    // El peluquero tiene que existir y tener ese rol en Firestore (el nombre lo toma el servidor de ahí)
    const peluqueroUid = textoValido(b.peluquero_uid, 128);
    if (!peluqueroUid) return res.status(400).json({ error: 'Elegí un peluquero.' });
    const peluquero = await obtenerPeluquero(peluqueroUid, req.token);
    if (!peluquero) return res.status(400).json({ error: 'Ese peluquero no está disponible.' });

    try {
      const [ins] = await pool.query(
        `INSERT INTO turnos
           (usuario_uid, mail, nombre, apellido, servicio_id, peluquero_uid, peluquero_nombre, dia, hora, observaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.usuario.uid, req.usuario.email ?? '', nombre, apellido, servicioId,
          peluquero.uid, peluquero.nombre.slice(0, 121), b.dia, b.hora, obs || null
        ]
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
    const cambiaServicio = b.servicio_id !== undefined || b.servicio !== undefined;
    const servicioId = cambiaServicio ? await resolverServicio(pool, b) : actual.servicio_id;
    const dia = b.dia === undefined ? actual.dia : b.dia;
    const hora = b.hora === undefined ? String(actual.hora).slice(0, 5) : b.hora;
    const obs = b.observaciones === undefined
      ? (actual.observaciones ?? '')
      : (typeof b.observaciones === 'string' ? b.observaciones.trim().slice(0, 500) : '');
    // Solo el admin cambia el estado; si otro lo manda, se ignora
    const estado = req.usuario.rol === 'admin' && b.estado !== undefined ? b.estado : actual.estado;

    if (!nombre || !apellido) return res.status(400).json({ error: 'Nombre y apellido no son válidos.' });
    if (!servicioId) return res.status(400).json({ error: 'Elegí un servicio que exista.' });
    if (!['Pendiente', 'Finalizado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido (Pendiente o Finalizado).' });
    }
    // Las reglas de fecha/hora solo se exigen si se cambió el horario
    if (dia !== actual.dia || hora !== String(actual.hora).slice(0, 5)) {
      const errorFecha = validarDiaHora(dia, hora);
      if (errorFecha) return res.status(400).json({ error: errorFecha });
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

async function filaConUid(pool, id) {
  const [rows] = await pool.query('SELECT id, usuario_uid, peluquero_uid FROM turnos WHERE id = ?', [id]);
  return rows[0] ?? null;
}