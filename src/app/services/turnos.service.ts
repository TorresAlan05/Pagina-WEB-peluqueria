import { Injectable, inject } from '@angular/core';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { AuthService } from './auth.service';

export type EstadoTurno = 'Pendiente' | 'Finalizado';
export const ESTADOS: EstadoTurno[] = ['Pendiente', 'Finalizado'];

export interface Turno {
  id: string;
  uid: string;
  nombre: string;
  apellido: string;
  mail: string;
  servicio: string;
  dia: string; // "2026-10-20"
  hora: string; // "10:00"
  estado: EstadoTurno;
  observaciones?: string;
}

/** Datos que carga el cliente al reservar. El estado siempre arranca en Pendiente. */
export type NuevoTurno = Omit<Turno, 'id' | 'estado'>;

export interface HoraOcupada {
  hora: string;
  turnoId: string;
}

/**
 * Único lugar que habla con la base de datos de turnos.
 * Cuando exista el backend (MySQL/Postgres) solo hay que reemplazar el
 * interior de estos métodos por llamadas HTTP; los componentes no cambian.
 *
 * Colecciones:
 *  - turnos/{id}              → el turno en sí
 *  - ocupados/{dia_hora}      → "candado" de horario. Como el id es único, dos
 *                               clientes no pueden reservar el mismo horario.
 */
@Injectable({ providedIn: 'root' })
export class TurnosService {
  // Inyectar AuthService garantiza que Firebase ya fue inicializado
  private auth = inject(AuthService);
  private db = getFirestore();

  private slotId(dia: string, hora: string): string {
    return `${dia}_${hora}`;
  }

  /** Crea el turno y bloquea el horario en una sola operación atómica. */
  async crear(datos: NuevoTurno): Promise<void> {
    const turnoRef = doc(collection(this.db, 'turnos'));
    const slotRef = doc(this.db, 'ocupados', this.slotId(datos.dia, datos.hora));

    const batch = writeBatch(this.db);
    batch.set(slotRef, { dia: datos.dia, hora: datos.hora, uid: datos.uid, turnoId: turnoRef.id });
    batch.set(turnoRef, { ...datos, estado: 'Pendiente', creadoEn: serverTimestamp() });
    await batch.commit();
  }

  /** Todos los turnos (solo admin, lo exigen las reglas de Firestore). */
  async listarTodos(): Promise<Turno[]> {
    const snap = await getDocs(collection(this.db, 'turnos'));
    return this.ordenar(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Turno, 'id'>) })));
  }

  /** Turnos de un cliente. */
  async listarMios(uid: string): Promise<Turno[]> {
    const snap = await getDocs(query(collection(this.db, 'turnos'), where('uid', '==', uid)));
    return this.ordenar(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Turno, 'id'>) })));
  }

  /** Horas ya tomadas en una fecha (de todos los clientes). */
  async horasOcupadas(dia: string): Promise<HoraOcupada[]> {
    if (!dia) return [];
    const snap = await getDocs(query(collection(this.db, 'ocupados'), where('dia', '==', dia)));
    return snap.docs.map((d) => ({
      hora: d.data()['hora'] as string,
      turnoId: d.data()['turnoId'] as string
    }));
  }

  /** El cliente modifica servicio / día / hora de su turno. */
  async actualizar(
    turno: Turno,
    cambios: { servicio: string; dia: string; hora: string }
  ): Promise<void> {
    const batch = writeBatch(this.db);

    if (turno.dia !== cambios.dia || turno.hora !== cambios.hora) {
      batch.delete(doc(this.db, 'ocupados', this.slotId(turno.dia, turno.hora)));
      batch.set(doc(this.db, 'ocupados', this.slotId(cambios.dia, cambios.hora)), {
        dia: cambios.dia,
        hora: cambios.hora,
        uid: turno.uid,
        turnoId: turno.id
      });
    }
    batch.update(doc(this.db, 'turnos', turno.id), cambios);
    await batch.commit();
  }

  /** Solo el admin (lo exigen las reglas): Pendiente ⇄ Finalizado. */
  async cambiarEstado(id: string, estado: EstadoTurno): Promise<void> {
    await updateDoc(doc(this.db, 'turnos', id), { estado });
  }

  /** Borra el turno y libera el horario. */
  async eliminar(turno: Turno): Promise<void> {
    await this.eliminarVarios([turno]);
  }

  async eliminarVarios(turnos: Turno[]): Promise<void> {
    // Un batch admite hasta 500 operaciones → 2 por turno
    for (let i = 0; i < turnos.length; i += 200) {
      const batch = writeBatch(this.db);
      for (const t of turnos.slice(i, i + 200)) {
        batch.delete(doc(this.db, 'turnos', t.id));
        batch.delete(doc(this.db, 'ocupados', this.slotId(t.dia, t.hora)));
      }
      await batch.commit();
    }
  }

  private ordenar(lista: Turno[]): Turno[] {
    return lista.sort((a, b) => (a.dia + a.hora).localeCompare(b.dia + b.hora));
  }
}
