import { Router } from 'express';
import { idValido, textoValido } from '../validaciones.js';

const mapServicio = (r) => ({ id: r.id, nombre: r.nombre, precio: Number(r.precio) });

function precioValido(p) {
  const n = Number(p);
  return p !== '' && p !== null && Number.isFinite(n) && n >= 0 && n <= 9_999_999 ? n : null;
}

export function serviciosRouter(pool, { exigirLogin, exigirRol }) {
  const r = Router();

  // Público: el formulario de reserva necesita el catálogo
  r.get('/', async (_req, res) => {
    const [rows] = await pool.query('SELECT id, nombre, precio FROM servicios ORDER BY id');
    res.json(rows.map(mapServicio));
  });

  r.post('/', exigirLogin, exigirRol('admin'), async (req, res) => {
    const nombre = textoValido(req.body?.nombre, 80);
    const precio = precioValido(req.body?.precio ?? 0);
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio (máx. 80 caracteres).' });
    if (precio === null) return res.status(400).json({ error: 'El precio no es válido.' });

    try {
      const [ins] = await pool.query('INSERT INTO servicios (nombre, precio) VALUES (?, ?)', [nombre, precio]);
      res.status(201).json({ id: ins.insertId, nombre, precio });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe un servicio con ese nombre.' });
      throw e;
    }
  });

  r.put('/:id', exigirLogin, exigirRol('admin'), async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(400).json({ error: 'Id inválido.' });

    const [rows] = await pool.query('SELECT id, nombre, precio FROM servicios WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Servicio no encontrado.' });

    const nombre = req.body?.nombre === undefined ? rows[0].nombre : textoValido(req.body.nombre, 80);
    const precio = req.body?.precio === undefined ? Number(rows[0].precio) : precioValido(req.body.precio);
    if (!nombre) return res.status(400).json({ error: 'El nombre no es válido.' });
    if (precio === null) return res.status(400).json({ error: 'El precio no es válido.' });

    try {
      await pool.query('UPDATE servicios SET nombre = ?, precio = ? WHERE id = ?', [nombre, precio, id]);
      res.json({ id, nombre, precio });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe un servicio con ese nombre.' });
      throw e;
    }
  });

  r.delete('/:id', exigirLogin, exigirRol('admin'), async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(400).json({ error: 'Id inválido.' });

    try {
      const [del] = await pool.query('DELETE FROM servicios WHERE id = ?', [id]);
      if (del.affectedRows === 0) return res.status(404).json({ error: 'Servicio no encontrado.' });
      res.status(204).end();
    } catch (e) {
      if (e.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(409).json({ error: 'No se puede borrar: hay turnos que usan este servicio.' });
      }
      throw e;
    }
  });

  return r;
}
