import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router'; 
import { FormsModule } from '@angular/forms'; 
import { AuthService } from '../services/auth.service';

interface Turno {
  nombre: string;
  apellido: string;
  mail: string;
  servicio: string;
  fecha: string;
  dia: string;
  hora: string;
  estado: 'Confirmado' | 'Pendiente';
  observaciones?: string;
}

@Component({
  selector: 'app-mis-turnos',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule], 
  templateUrl: './mis-turnos.html',
  styleUrls: ['./mis-turnos.css'] 
})
export class MisTurnos implements OnInit {
  listaTurnos: Turno[] = [];
  
  constructor(private router: Router, private auth: AuthService) {} 

  indiceEditando: number = -1; 
  turnoEditado: Partial<Turno> = {};

  horasOcupadas: string[] = [];
  fechaMin = '';
  fechaMax = '';
  listaServicios: string[] = ['Corte', 'Barba', 'Corte + Barba', 'Coloración + Corte'];
  listaHoras: string[] = [
    '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
  ];

  // Helper para obtener la llave dinámica del usuario logueado
  private getStorageKey(): string {
    return `turnos_${this.auth.email()}`;
  }

  ngOnInit(): void {
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
    this.cargarTurnos();
  }

async cerrarSesion(): Promise<void> {
  if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }
}

  cargarTurnos(): void {
    const datosLocales = localStorage.getItem(this.getStorageKey());
    if (datosLocales) {
      this.listaTurnos = JSON.parse(datosLocales);
    }
  }

  eliminarTurno(index: number): void {
    const turno = this.listaTurnos[index];
    const confirmar = confirm(`¿Estás seguro de que deseas eliminar el turno de ${turno.nombre} ${turno.apellido}?`);
    if (confirmar) {
      this.listaTurnos.splice(index, 1); 
      this.actualizarLocalStorage();
    }
  }

  habilitarEdicion(index: number): void {
  this.indiceEditando = index;
  this.turnoEditado = { ...this.listaTurnos[index] }; 
  this.horasOcupadas = this.obtenerHorasOcupadas(this.turnoEditado.dia || '', index);
}

  cancelarEdicion(): void {
    this.indiceEditando = -1;
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

// Horas ocupadas en una fecha, ignorando el turno que se está editando
private obtenerHorasOcupadas(fecha: string, indiceIgnorado: number): string[] {
  if (!fecha) return [];
  const ocupadas: string[] = [];
  const keyActual = this.getStorageKey();

  // Mis otros turnos (en memoria)
  this.listaTurnos.forEach((t, i) => {
    if (i !== indiceIgnorado && t.dia === fecha) ocupadas.push(t.hora);
  });

  // Turnos de los demás usuarios
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('turnos_') && key !== keyActual) {
      const turnos = JSON.parse(localStorage.getItem(key) || '[]');
      turnos.forEach((t: any) => {
        if (t.dia === fecha) ocupadas.push(t.hora);
      });
    }
  }
  return ocupadas;
}

cambioDia(): void {
  this.turnoEditado.hora = '';
  this.horasOcupadas = this.obtenerHorasOcupadas(this.turnoEditado.dia || '', this.indiceEditando);
}

horaNoDisponible(hora: string): boolean {
  if (this.horasOcupadas.includes(hora)) return true;

  // Si la fecha elegida es hoy, las horas que ya pasaron tampoco se pueden
  if (this.turnoEditado.dia === this.fechaMin) {
    const ahora = new Date();
    const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
    const [h, min] = hora.split(':').map(Number);
    return h * 60 + min <= horaActual;
  }
  return false;
}

  guardarEdicion(index: number): void {
  const { dia, hora } = this.turnoEditado;

  if (!dia || !hora || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
    alert('Elegí una fecha del calendario y una hora.');
    return;
  }
  if (this.esFinDeSemana(dia)) {
    alert('Atendemos de lunes a viernes.');
    return;
  }
  if (this.obtenerHorasOcupadas(dia, index).includes(hora)) {
    alert('Ese horario ya fue reservado. Elegí otro, por favor.');
    this.horasOcupadas = this.obtenerHorasOcupadas(dia, index);
    this.turnoEditado.hora = '';
    return;
  }
    this.listaTurnos[index] = { ...this.turnoEditado } as Turno;
    this.actualizarLocalStorage();
    this.cancelarEdicion();
    alert('Turno modificado con éxito.');
}

  borrarTodosLosTurnos(): void {
    if (confirm('¿Estás seguro de que querés borrar todos los turnos agendados?')) {
      this.listaTurnos = [];
      this.actualizarLocalStorage();
    }
  }

  private actualizarLocalStorage(): void {
    const key = this.getStorageKey();
    if (this.listaTurnos.length > 0) {
      localStorage.setItem(key, JSON.stringify(this.listaTurnos, null, 2));
    } else {
      localStorage.removeItem(key); 
    }
  }
}