import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from "@angular/router"; 
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

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

  horasOcupadas: string[] = [];
  fechaMin = '';
  fechaMax = '';

  constructor(private fb: FormBuilder, private router: Router, private auth: AuthService) {}

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
    this.formTurno.get('dia')!.valueChanges.subscribe(fecha => {
      this.formTurno.get('hora')!.setValue('');
      this.horasOcupadas = this.obtenerHorasOcupadas(fecha);
    });
  }

  // "2026-10-05" en hora local (toISOString usa UTC y puede correr el día)
  private aFormatoFecha(f: Date): string {
    const y = f.getFullYear();
    const m = String(f.getMonth() + 1).padStart(2, '0');
    const d = String(f.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Junta los turnos de TODOS los usuarios para esa fecha
  private obtenerHorasOcupadas(fecha: string): string[] {
    if (!fecha) return [];
    const ocupadas: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('turnos_')) {
        const turnos = JSON.parse(localStorage.getItem(key) || '[]');
        turnos.forEach((t: any) => {
          if (t.dia === fecha) ocupadas.push(t.hora);
        });
      }
    }
    return ocupadas;
  }

  // Ocupada, o ya pasó si la fecha elegida es hoy
  horaNoDisponible(hora: string): boolean {
    if (this.horasOcupadas.includes(hora)) return true;

    const fecha = this.formTurno.get('dia')?.value;
    if (fecha === this.fechaMin) {
      const ahora = new Date();
      const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
      const [h, min] = hora.split(':').map(Number);
      return h * 60 + min <= horaActual;
    }
    return false;
  }

  onSubmit(): void {
    if (this.formTurno.invalid) return;

    const { dia, hora } = this.formTurno.value;

    // Volvemos a chequear justo antes de guardar
    if (this.obtenerHorasOcupadas(dia).includes(hora)) {
      alert('Ese horario ya fue reservado. Elegí otro, por favor.');
      this.horasOcupadas = this.obtenerHorasOcupadas(dia);
      this.formTurno.get('hora')!.setValue('');
      return;
    }

    this.guardarEnLocalStorage(this.formTurno.value); 
    this.router.navigate(['/mis-turnos']); 
  }

  guardarEnLocalStorage(nuevoTurnoObjeto: any) {
    const key = `turnos_${this.auth.email()}`;
    const datosLocales = localStorage.getItem(key);
    let listaTurnos: any[] = datosLocales ? JSON.parse(datosLocales) : [];

    listaTurnos.push(nuevoTurnoObjeto);
    localStorage.setItem(key, JSON.stringify(listaTurnos, null, 2));
    alert(`¡Turno agendado con éxito!`);
  }
}