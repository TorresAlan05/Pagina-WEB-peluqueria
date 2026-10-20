import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ESTADOS, EstadoTurno, Turno, TurnosService } from '../services/turnos.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class Admin implements OnInit {
  private router = inject(Router);
  private auth = inject(AuthService);
  private turnosSvc = inject(TurnosService);

  readonly estados = ESTADOS;

  listaTurnos = signal<Turno[]>([]);
  cargando = signal(true);
  error = signal('');
  /** id del turno que se está modificando (para deshabilitar sus controles) */
  procesando = signal<string | null>(null);

  async ngOnInit() {
    await this.auth.ready;
    if (!this.auth.isAdmin()) {
      this.router.navigateByUrl('login');
      return;
    }
    await this.cargarTurnos();
  }

  async cargarTurnos(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.listaTurnos.set(await this.turnosSvc.listarTodos());
    } catch (e) {
      console.error('No se pudieron cargar los turnos:', e);
      this.error.set('No se pudieron cargar los turnos. Revisá las reglas de Firestore y tu conexión.');
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarEstado(turno: Turno, valor: string): Promise<void> {
    const nuevo = valor as EstadoTurno;
    if (!this.estados.includes(nuevo) || nuevo === turno.estado) return;

    this.procesando.set(turno.id);
    try {
      await this.turnosSvc.cambiarEstado(turno.id, nuevo);
      this.listaTurnos.update((l) => l.map((t) => (t.id === turno.id ? { ...t, estado: nuevo } : t)));
    } catch (e) {
      console.error(e);
      alert('No se pudo cambiar el estado. Verificá que tu usuario tenga rol admin.');
      // se recarga para que el selector vuelva al valor real
      await this.cargarTurnos();
    } finally {
      this.procesando.set(null);
    }
  }

  async eliminarTurno(turno: Turno): Promise<void> {
    const ok = confirm(
      `¿Eliminar el turno de ${turno.nombre} ${turno.apellido} (${this.formatearDia(turno.dia)} ${turno.hora})?`
    );
    if (!ok) return;

    this.procesando.set(turno.id);
    try {
      await this.turnosSvc.eliminar(turno);
      this.listaTurnos.update((l) => l.filter((t) => t.id !== turno.id));
    } catch (e) {
      console.error(e);
      alert('No se pudo eliminar el turno.');
    } finally {
      this.procesando.set(null);
    }
  }

  /** "2026-10-20" → "20/10/2026" */
  formatearDia(dia: string): string {
    const [y, m, d] = dia.split('-');
    return y && m && d ? `${d}/${m}/${y}` : dia;
  }

  /** "2026-10-20" → "Martes" */
  nombreDia(dia: string): string {
    const [y, m, d] = dia.split('-').map(Number);
    if (!y || !m || !d) return '';
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long' });
  }

  async cerrarSesion() {
    await this.auth.logout();
    this.router.navigateByUrl('login');
  }
}
