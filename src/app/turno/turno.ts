import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { ApiError, TurnosService } from '../services/turnos.service';
import { Peluquero, UsuariosService } from '../services/usuarios.service';

// Solo lunes a viernes
function diaHabil(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  const [y, m, d] = control.value.split('-').map(Number);
  const diaSemana = new Date(y, m - 1, d).getDay(); // 0 = domingo, 6 = sábado
  return diaSemana === 0 || diaSemana === 6 ? { finDeSemana: true } : null;
}

@Component({
  selector: 'app-turnos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './turno.html',
  styleUrls: ['./turno.css']
})
export class Turno implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);
  private turnosSvc = inject(TurnosService);
  private usuariosSvc = inject(UsuariosService);

  formTurno!: FormGroup;
  listaServicios = signal<string[]>([]); // se carga desde la API
  listaPeluqueros = signal<Peluquero[]>([]); // usuarios con rol peluquero (Firestore)
  cargandoPeluqueros = signal(true);
  listaHoras: string[] = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

  horasOcupadas = signal<string[]>([]);
  enviando = signal(false);
  fechaMin = '';
  fechaMax = '';

  // Nombre y apellido salen del perfil que se cargó al registrarse
  readonly nombreCompleto = this.auth.nombreCompleto;
  readonly perfilCompleto = computed(() => !!this.auth.nombre() && !!this.auth.apellido());

  ngOnInit(): void {
    const hoy = new Date();
    const limite = new Date();
    limite.setDate(limite.getDate() + 30); // se puede reservar hasta 30 días adelante

    this.fechaMin = this.aFormatoFecha(hoy);
    this.fechaMax = this.aFormatoFecha(limite);
    void this.cargarServicios();
    void this.cargarPeluqueros();

    this.formTurno = this.fb.group({
      peluquero: ['', Validators.required],
      servicio: ['', Validators.required],
      dia: ['', [Validators.required, diaHabil]],
      hora: ['', Validators.required],
      observaciones: ['']
    });

    // Las horas ocupadas dependen del día Y del peluquero elegido
    this.formTurno.get('dia')!.valueChanges.subscribe(() => void this.refrescarHoras());
    this.formTurno.get('peluquero')!.valueChanges.subscribe(() => void this.refrescarHoras());
  }

  private async refrescarHoras(): Promise<void> {
    this.formTurno.get('hora')!.setValue('');
    const { dia, peluquero } = this.formTurno.value;
    this.horasOcupadas.set(await this.obtenerHorasOcupadas(dia, peluquero));
  }

  private async cargarServicios(): Promise<void> {
    try {
      this.listaServicios.set((await this.turnosSvc.listarServicios()).map((s) => s.nombre));
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'No se pudieron cargar los servicios.');
    }
  }

  private async cargarPeluqueros(): Promise<void> {
    try {
      this.listaPeluqueros.set(await this.usuariosSvc.listarPeluqueros());
    } catch (e) {
      console.error(e);
      alert('No se pudo cargar la lista de peluqueros. ¿Publicaste las reglas de Firestore?');
    } finally {
      this.cargandoPeluqueros.set(false);
    }
  }

  // "2026-10-05" en hora local (toISOString usa UTC y puede correr el día)
  private aFormatoFecha(f: Date): string {
    const y = f.getFullYear();
    const m = String(f.getMonth() + 1).padStart(2, '0');
    const d = String(f.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Horas ya reservadas con ese peluquero en esa fecha
  private async obtenerHorasOcupadas(fecha: string, peluquero: string): Promise<string[]> {
    if (!fecha || !peluquero) return [];
    try {
      return (await this.turnosSvc.horasOcupadas(fecha, peluquero)).map((o) => o.hora);
    } catch (e) {
      console.error('No se pudieron consultar los horarios:', e);
      return [];
    }
  }

  // Ocupada, o ya pasó si la fecha elegida es hoy
  horaNoDisponible(hora: string): boolean {
    if (this.horasOcupadas().includes(hora)) return true;

    const fecha = this.formTurno.get('dia')?.value;
    if (fecha === this.fechaMin) {
      const ahora = new Date();
      const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
      const [h, min] = hora.split(':').map(Number);
      return h * 60 + min <= horaActual;
    }
    return false;
  }

  async onSubmit(): Promise<void> {
    if (this.formTurno.invalid || this.enviando()) return;

    const user = this.auth.user();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    if (!this.perfilCompleto()) {
      alert('Tu cuenta no tiene nombre y apellido cargados.');
      return;
    }

    const { servicio, peluquero, dia, hora, observaciones } = this.formTurno.value;
    this.enviando.set(true);

    try {
      // Volvemos a chequear justo antes de guardar
      const ocupadas = await this.obtenerHorasOcupadas(dia, peluquero);
      if (ocupadas.includes(hora)) {
        this.horaTomada(ocupadas);
        return;
      }

      await this.turnosSvc.crear({
        uid: user.uid,
        mail: user.email ?? '',
        nombre: this.auth.nombre(),
        apellido: this.auth.apellido(),
        peluquero_uid: peluquero,
        servicio,
        dia,
        hora,
        observaciones: (observaciones ?? '').trim()
      });
      alert('¡Turno agendado con éxito!');
      this.router.navigate(['/mis-turnos']);
    } catch (e) {
      console.error(e);
      if (e instanceof ApiError && e.status === 409) {
        // Si dos personas reservan a la vez, el servidor rechaza al segundo
        this.horaTomada(await this.obtenerHorasOcupadas(dia, peluquero));
      } else {
        alert(e instanceof Error ? e.message : 'No se pudo reservar el turno.');
      }
    } finally {
      this.enviando.set(false);
    }
  }

  private horaTomada(ocupadas: string[]): void {
    alert('No se pudo reservar: ese horario ya fue tomado. Elegí otro, por favor.');
    this.horasOcupadas.set(ocupadas);
    this.formTurno.get('hora')!.setValue('');
  }
}