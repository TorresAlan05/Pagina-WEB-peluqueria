import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Servicio, TurnosService } from '../services/turnos.service';
import { descargarCsv } from '../shared/csv';
import { AvisoService } from '../services/aviso.service';

@Component({
  selector: 'app-admin-servicios',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './admin-servicios.html'
})
export class AdminServicios implements OnInit {
  private svc = inject(TurnosService);
  private fb = inject(FormBuilder);
  private aviso = inject(AvisoService);

  servicios = signal<Servicio[]>([]);
  cargando = signal(true);
  guardando = signal(false);
  procesando = signal<number | null>(null);
  error = signal('');
  /** null = alta de un servicio nuevo; número = id del servicio que se está editando */
  editandoId = signal<number | null>(null);

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    precio: [0, [Validators.required, Validators.min(0), Validators.max(9_999_999)]]
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.servicios.set(await this.svc.listarServicios());
    } catch (e) {
      console.error(e);
      this.error.set(e instanceof Error ? e.message : 'No se pudieron cargar los servicios.');
    } finally {
      this.cargando.set(false);
    }
  }

  async guardar(): Promise<void> {
    if (this.form.invalid || this.guardando()) return;

    const { nombre, precio } = this.form.getRawValue();
    const datos = { nombre: nombre.trim(), precio: Number(precio) };
    if (!datos.nombre) {
      this.error.set('El nombre es obligatorio.');
      return;
    }

    this.guardando.set(true);
    this.error.set('');
    try {
      const id = this.editandoId();
      if (id === null) {
        await this.svc.crearServicio(datos);
      } else {
        await this.svc.actualizarServicio(id, datos);
      }
      this.cancelar();
      await this.cargar();
    } catch (e) {
      console.error(e);
      this.error.set(e instanceof Error ? e.message : 'No se pudo guardar el servicio.');
    } finally {
      this.guardando.set(false);
    }
  }

  editar(s: Servicio): void {
    this.editandoId.set(s.id);
    this.form.setValue({ nombre: s.nombre, precio: s.precio });
    this.error.set('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelar(): void {
    this.editandoId.set(null);
    this.form.reset({ nombre: '', precio: 0 });
    this.error.set('');
  }

  async eliminar(s: Servicio): Promise<void> {
    if (!(await this.aviso.confirmar(`¿Eliminar el servicio "${s.nombre}"?`))) return;

    this.procesando.set(s.id);
    try {
      await this.svc.eliminarServicio(s.id);
      this.servicios.update((l) => l.filter((x) => x.id !== s.id));
      if (this.editandoId() === s.id) this.cancelar();
    } catch (e) {
      console.error(e);
      // Si hay turnos que usan el servicio, el servidor responde con el motivo
      this.aviso.error(e instanceof Error ? e.message : 'No se pudo eliminar el servicio.');
    } finally {
      this.procesando.set(null);
    }
  }

  formatearPrecio(precio: number): string {
    return precio.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  }
    exportarCsv(): void {
    descargarCsv(
      'servicios.csv',
      ['ID', 'Servicio', 'Precio (ARS)'],
      this.servicios().map((s) => [s.id, s.nombre, s.precio])
    );
  }
}