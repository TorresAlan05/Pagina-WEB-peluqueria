import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Turno, TurnosService } from '../services/turnos.service';
import { EstadoDirective } from '../shared/estado.directive';

@Component({
  selector: 'app-agenda',
  standalone: true,
  imports: [EstadoDirective],
  templateUrl: './agenda.html'
})
export class Agenda implements OnInit {
  private turnosSvc = inject(TurnosService);
  protected auth = inject(AuthService);

  turnos = signal<Turno[]>([]);
  cargando = signal(true);
  error = signal('');

  pendientes = computed(() => this.turnos().filter((t) => t.estado === 'Pendiente').length);

  /** Turnos agrupados por día (la API ya los manda ordenados por día y hora). */
  porDia = computed(() => {
    const mapa = new Map<string, Turno[]>();
    for (const t of this.turnos()) {
      mapa.set(t.dia, [...(mapa.get(t.dia) ?? []), t]);
    }
    return [...mapa.entries()].map(([dia, turnos]) => ({ dia, turnos }));
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.turnos.set(await this.turnosSvc.listarAgenda());
    } catch (e) {
      console.error(e);
      this.error.set(e instanceof Error ? e.message : 'No se pudo cargar tu agenda.');
    } finally {
      this.cargando.set(false);
    }
  }

  /** "2026-10-20" → "20/10/2026" */
  formatearDia(dia: string): string {
    const [y, m, d] = dia.split('-');
    return y && m && d ? `${d}/${m}/${y}` : dia;
  }

  /** "2026-10-20" → "martes" */
  nombreDia(dia: string): string {
    const [y, m, d] = dia.split('-').map(Number);
    if (!y || !m || !d) return '';
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long' });
  }
}