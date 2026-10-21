import { Injectable, inject } from '@angular/core';
import { API_URL } from '../api.config';
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
  precio?: number;
}

/** Datos que carga el cliente al reservar. El estado siempre arranca en Pendiente. */
export type NuevoTurno = Omit<Turno, 'id' | 'estado' | 'precio'>;

export interface HoraOcupada {
  hora: string;
  turnoId: string;
}

export interface Servicio {
  id: number;
  nombre: string;
  precio: number;
}

/** Error de la API. `status` es el código HTTP (409 = horario ya reservado, 0 = sin conexión). */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Así llega un turno desde la API (el id es numérico)
interface TurnoApi extends Omit<Turno, 'id'> {
  id: number;
}

/**
 * Único lugar que habla con el backend de turnos (API REST + MySQL).
 * Los componentes no saben de HTTP: usan estos métodos.
 *
 * El dueño y el mail del turno los toma el servidor del token de Firebase,
 * por eso `uid` y `mail` de NuevoTurno no se envían.
 */
@Injectable({ providedIn: 'root' })
export class TurnosService {
  private auth = inject(AuthService);

  /** Hace el pedido HTTP con el token de la sesión y traduce los errores. */
  private async pedir<T>(
    metodo: 'GET' | 'POST' | 'PUT' | 'DELETE',
    ruta: string,
    cuerpo?: unknown,
    conSesion = true
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
    if (conSesion) headers['Authorization'] = `Bearer ${await this.auth.obtenerToken()}`;

    let r: Response;
    try {
      r = await fetch(`${API_URL}${ruta}`, {
        method: metodo,
        headers,
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
      });
    } catch {
      throw new ApiError(0, 'No se pudo conectar con el servidor. ¿Está corriendo el backend?');
    }

    if (r.status === 204) return undefined as T;
    const datos = await r.json().catch(() => null);
    if (!r.ok) throw new ApiError(r.status, datos?.error ?? 'Error del servidor.');
    return datos as T;
  }

  private aTurno(t: TurnoApi): Turno {
    return { ...t, id: String(t.id) };
  }

  /** Catálogo de servicios (público). */
  listarServicios(): Promise<Servicio[]> {
    return this.pedir<Servicio[]>('GET', '/servicios', undefined, false);
  }

  /** Reserva un turno. Si el horario ya fue tomado, lanza ApiError con status 409. */
  async crear(datos: NuevoTurno): Promise<void> {
    await this.pedir('POST', '/turnos', {
      nombre: datos.nombre,
      apellido: datos.apellido,
      servicio: datos.servicio,
      dia: datos.dia,
      hora: datos.hora,
      observaciones: datos.observaciones ?? ''
    });
  }

  /** Todos los turnos (solo admin, lo exige el servidor). */
  async listarTodos(): Promise<Turno[]> {
    return (await this.pedir<TurnoApi[]>('GET', '/turnos')).map((t) => this.aTurno(t));
  }

  /** Turnos del usuario que inició sesión. */
  async listarMios(_uid?: string): Promise<Turno[]> {
    return (await this.pedir<TurnoApi[]>('GET', '/turnos?mios=true')).map((t) => this.aTurno(t));
  }

  /** Horas ya tomadas en una fecha (de todos los clientes). */
  async horasOcupadas(dia: string): Promise<HoraOcupada[]> {
    if (!dia) return [];
    const lista = await this.pedir<{ hora: string; turnoId: number }[]>(
      'GET',
      `/turnos/ocupados?dia=${encodeURIComponent(dia)}`
    );
    return lista.map((o) => ({ hora: o.hora, turnoId: String(o.turnoId) }));
  }

  /** El cliente modifica servicio / día / hora de su turno. */
  async actualizar(
    turno: Turno,
    cambios: { servicio: string; dia: string; hora: string }
  ): Promise<void> {
    await this.pedir('PUT', `/turnos/${turno.id}`, cambios);
  }

  /** Solo el admin (lo exige el servidor): Pendiente ⇄ Finalizado. */
  async cambiarEstado(id: string, estado: EstadoTurno): Promise<void> {
    await this.pedir('PUT', `/turnos/${id}`, { estado });
  }

  /** Borra el turno y libera el horario. */
  async eliminar(turno: Turno): Promise<void> {
    await this.pedir('DELETE', `/turnos/${turno.id}`);
  }

  async eliminarVarios(turnos: Turno[]): Promise<void> {
    // Se intentan todos; si alguno falla, se avisa al final
    const resultados = await Promise.allSettled(turnos.map((t) => this.eliminar(t)));
    const fallo = resultados.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (fallo) throw fallo.reason;
  }
}
