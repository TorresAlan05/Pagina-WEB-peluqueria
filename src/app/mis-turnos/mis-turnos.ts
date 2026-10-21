import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { ApiError, Turno, TurnosService } from '../services/turnos.service';

@Component({
  selector: 'app-mis-turnos',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './mis-turnos.html',
  styleUrls: ['./mis-turnos.css']
})
export class MisTurnos implements OnInit {
  listaTurnos = signal<Turno[]>([]);
  indiceEditando = signal(-1);
  horasOcupadas = signal<string[]>([]);
  guardando = signal(false);

  turnoEditado: Partial<Turno> = {};

  fechaMin = '';
  fechaMax = '';
  listaServicios = signal<string[]>([]); // se carga desde la API
  listaHoras: string[] = [
    '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
  ];

  constructor(
    private router: Router,
    private auth: AuthService,
    private turnosSvc: TurnosService
  ) {}

  async ngOnInit(): Promise<void> {
    if (!this.auth.user()) {
      alert('Debes iniciar sesión para ver tus turnos.');
      this.router.navigate(['/login']);
      return;
    }
    const hoy = new Date();
    const limite = new Date();
    limite.setDate(limite.getDate() + 30);
    this.fechaMin = this.aFormatoFecha(hoy);
    this.fechaMax = this.aFormatoFecha(limite);
    void this.cargarServicios();
    await this.cargarTurnos();
  }

  private async cargarServicios(): Promise<void> {
    try {
      this.listaServicios.set((await this.turnosSvc.listarServicios()).map((s) => s.nombre));
    } catch (e) {
      console.error(e);
    }
  }

  async cerrarSesion(): Promise<void> {
    if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
      await this.auth.logout();
      this.router.navigate(['/login']);
    }
  }

  async cargarTurnos(): Promise<void> {
    const user = this.auth.user();
    if (!user) return;
    try {
      this.listaTurnos.set(await this.turnosSvc.listarMios(user.uid));
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'No se pudieron cargar tus turnos.');
    }
  }

  async eliminarTurno(index: number): Promise<void> {
    const turno = this.listaTurnos()[index];
    if (!turno) return;
    if (!confirm(`¿Estás seguro de que deseas eliminar el turno de ${turno.nombre} ${turno.apellido}?`)) return;

    try {
      await this.turnosSvc.eliminar(turno);
      await this.cargarTurnos();
    } catch (e) {
      console.error(e);
      alert('No se pudo eliminar el turno.');
    }
  }

  async habilitarEdicion(index: number): Promise<void> {
    this.indiceEditando.set(index);
    this.turnoEditado = { ...this.listaTurnos()[index] };
    this.horasOcupadas.set(await this.obtenerHorasOcupadas(this.turnoEditado.dia || '', index));
  }

  cancelarEdicion(): void {
    this.indiceEditando.set(-1);
    this.turnoEditado = {};
  }

  private aFormatoFecha(f: Date): string {
    const y = f.getFullYear();
    const m = String(f.getMonth() + 1).padStart(2, '0');
    const d = String(f.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private esFinDeSemana(fecha: string): boolean {
    const [y, m, d] = fecha.split('-').map(Number);
    const diaSemana = new Date(y, m - 1, d).getDay();
    return diaSemana === 0 || diaSemana === 6;
  }

  // Horas ocupadas en una fecha por otros turnos (se ignora el que se está editando)
  private async obtenerHorasOcupadas(fecha: string, indiceIgnorado: number): Promise<string[]> {
    if (!fecha) return [];
    const idIgnorado = this.listaTurnos()[indiceIgnorado]?.id;
    try {
      const ocupadas = await this.turnosSvc.horasOcupadas(fecha);
      return ocupadas.filter((o) => o.turnoId !== idIgnorado).map((o) => o.hora);
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  async cambioDia(): Promise<void> {
    this.turnoEditado.hora = '';
    this.horasOcupadas.set(
      await this.obtenerHorasOcupadas(this.turnoEditado.dia || '', this.indiceEditando())
    );
  }

  horaNoDisponible(hora: string): boolean {
    if (this.horasOcupadas().includes(hora)) return true;

    // Si la fecha elegida es hoy, las horas que ya pasaron tampoco se pueden
    if (this.turnoEditado.dia === this.fechaMin) {
      const ahora = new Date();
      const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
      const [h, min] = hora.split(':').map(Number);
      return h * 60 + min <= horaActual;
    }
    return false;
  }

  async guardarEdicion(index: number): Promise<void> {
    const turno = this.listaTurnos()[index];
    const { dia, hora, servicio } = this.turnoEditado;

    if (!turno || !servicio || !dia || !hora || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
      alert('Elegí un servicio, una fecha del calendario y una hora.');
      return;
    }
    if (this.esFinDeSemana(dia)) {
      alert('Atendemos de lunes a viernes.');
      return;
    }

    this.guardando.set(true);
    try {
      const ocupadas = await this.obtenerHorasOcupadas(dia, index);
      if (ocupadas.includes(hora)) {
        this.horaTomada(ocupadas);
        return;
      }
      await this.turnosSvc.actualizar(turno, { servicio, dia, hora });
      this.cancelarEdicion();
      await this.cargarTurnos();
      alert('Turno modificado con éxito.');
    } catch (e) {
      console.error(e);
      if (e instanceof ApiError && e.status === 409) {
        this.horaTomada(await this.obtenerHorasOcupadas(dia, index));
      } else {
        alert(e instanceof Error ? e.message : 'No se pudo guardar el turno.');
      }
    } finally {
      this.guardando.set(false);
    }
  }

  private horaTomada(ocupadas: string[]): void {
    alert('No se pudo guardar: ese horario ya fue reservado. Elegí otro, por favor.');
    this.horasOcupadas.set(ocupadas);
    this.turnoEditado.hora = '';
  }

  async borrarTodosLosTurnos(): Promise<void> {
    if (!confirm('¿Estás seguro de que querés borrar todos los turnos agendados?')) return;
    try {
      await this.turnosSvc.eliminarVarios(this.listaTurnos());
      await this.cargarTurnos();
    } catch (e) {
      console.error(e);
      alert('No se pudieron borrar los turnos.');
    }
  }
}
