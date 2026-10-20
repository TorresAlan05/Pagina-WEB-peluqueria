import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from "@angular/router"; 
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { TurnosService } from '../services/turnos.service';

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
  formTurno!: FormGroup;
  listaServicios: string[] = ['Corte', 'Barba', 'Corte + Barba', 'Coloración + Corte'];
  listaHoras: string[] = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

  horasOcupadas = signal<string[]>([]);
  enviando = signal(false);
  fechaMin = '';
  fechaMax = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private auth: AuthService,
    private turnosSvc: TurnosService
  ) {}

  ngOnInit(): void {
    const hoy = new Date();
    const limite = new Date();
    limite.setDate(limite.getDate() + 30); // se puede reservar hasta 30 días adelante

    this.fechaMin = this.aFormatoFecha(hoy);
    this.fechaMax = this.aFormatoFecha(limite);

    this.formTurno = this.fb.group({
      nombre: ['', Validators.required],
      apellido: ['', Validators.required],
      servicio: ['', Validators.required],
      dia: ['', [Validators.required, diaHabil]],
      hora: ['', Validators.required],
      observaciones: ['']
    });

    // Cada vez que cambia la fecha, recalculamos qué horas están ocupadas
    this.formTurno.get('dia')!.valueChanges.subscribe(async fecha => {
      this.formTurno.get('hora')!.setValue('');
      this.horasOcupadas.set(await this.obtenerHorasOcupadas(fecha));
    });
  }

  // "2026-10-05" en hora local (toISOString usa UTC y puede correr el día)
  private aFormatoFecha(f: Date): string {
    const y = f.getFullYear();
    const m = String(f.getMonth() + 1).padStart(2, '0');
    const d = String(f.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Horas ya reservadas por cualquier cliente en esa fecha
  private async obtenerHorasOcupadas(fecha: string): Promise<string[]> {
    if (!fecha) return [];
    try {
      return (await this.turnosSvc.horasOcupadas(fecha)).map(o => o.hora);
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

    const { nombre, apellido, servicio, dia, hora, observaciones } = this.formTurno.value;
    this.enviando.set(true);

    try {
      // Volvemos a chequear justo antes de guardar
      const ocupadas = await this.obtenerHorasOcupadas(dia);
      if (ocupadas.includes(hora)) {
        this.horaTomada(ocupadas);
        return;
      }

      await this.turnosSvc.crear({
        uid: user.uid,
        mail: user.email ?? '',
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        servicio,
        dia,
        hora,
        observaciones: (observaciones ?? '').trim()
      });
      alert('¡Turno agendado con éxito!');
      this.router.navigate(['/mis-turnos']);
    } catch (e) {
      console.error(e);
      // Si dos personas reservan a la vez, las reglas rechazan al segundo
      this.horaTomada(await this.obtenerHorasOcupadas(dia));
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
