import { Pipe, PipeTransform } from '@angular/core';
import { Turno } from '../services/turnos.service';

/** Minúsculas y sin tildes, para que "jose" encuentre "José". */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Filtra una lista de turnos.
 *   turnos | filtroTurnos : texto : estado
 *  - texto:  busca en nombre, apellido, mail y servicio
 *  - estado: 'Pendiente' | 'Finalizado' | '' (todos)
 * Es un pipe puro: solo se recalcula cuando cambia la lista o alguno de los filtros.
 */
@Pipe({ name: 'filtroTurnos', standalone: true })
export class FiltroTurnosPipe implements PipeTransform {
  transform(turnos: Turno[], texto = '', estado = ''): Turno[] {
    const q = normalizar(texto);
    return turnos.filter((t) => {
      if (estado && t.estado !== estado) return false;
      if (!q) return true;
      return normalizar(`${t.nombre} ${t.apellido} ${t.mail} ${t.servicio}`).includes(q);
    });
  }
}
