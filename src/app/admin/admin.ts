import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ESTADOS, EstadoTurno, Turno, TurnosService } from '../services/turnos.service';
import { EstadoDirective } from '../shared/estado.directive';
import { FiltroTurnosPipe } from '../shared/filtro-turnos.pipe';
import { FiltrosTurnos } from '../shared/filtros-turnos/filtros-turnos';
import { descargarCsv } from '../shared/csv';
import { AvisoService } from '../services/aviso.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterLink, FiltrosTurnos, FiltroTurnosPipe, EstadoDirective],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class Admin implements OnInit {
  private router = inject(Router);
  private auth = inject(AuthService);
  private turnosSvc = inject(TurnosService);
  private aviso = inject(AvisoService);

  readonly estados = ESTADOS;

  listaTurnos = signal<Turno[]>([]);
  cargando = signal(true);
  error = signal('');
  // Filtros que manda el componente hijo; el pipe `filtroTurnos` los aplica en el template
  busqueda = signal('');
  estadoFiltro = signal('');

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
      this.error.set(e instanceof Error ? e.message : 'No se pudieron cargar los turnos.');
    } finally {
      this.cargando.set(false);
    }
  }

  onBuscar(texto: string): void {
    this.busqueda.set(texto);
  }

  onEstadoFiltro(estado: string): void {
    this.estadoFiltro.set(estado);
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
      this.aviso.error(e instanceof Error ? e.message : 'No se pudo cambiar el estado.');
      // se recarga para que el selector vuelva al valor real
      await this.cargarTurnos();
    } finally {
      this.procesando.set(null);
    }
  }

  async eliminarTurno(turno: Turno): Promise<void> {
    const ok = await this.aviso.confirmar(
      `¿Eliminar el turno de ${turno.nombre} ${turno.apellido} (${this.formatearDia(turno.dia)} ${turno.hora})?`
    );
    if (!ok) return;

    this.procesando.set(turno.id);
    try {
      await this.turnosSvc.eliminar(turno);
      this.listaTurnos.update((l) => l.filter((t) => t.id !== turno.id));
    } catch (e) {
      console.error(e);
      this.aviso.error('No se pudo eliminar el turno.');
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
    exportarCsv(turnos: Turno[]): void {
    descargarCsv(
      'turnos.csv',
      ['ID', 'Cliente', 'Mail', 'Servicio', 'Peluquero', 'Precio (ARS)', 'Fecha', 'Hora', 'Estado', 'Observaciones'],
      turnos.map((t) => [
        t.id,
        `${t.nombre} ${t.apellido}`,
        t.mail,
        t.servicio,
        t.peluquero ?? '',
        t.precio,
        this.formatearDia(t.dia),
        t.hora,
        t.estado,
        t.observaciones ?? ''
      ])
    );
  }

  async cerrarSesion() {
    await this.auth.logout();
    this.router.navigateByUrl('login');
  }
}
