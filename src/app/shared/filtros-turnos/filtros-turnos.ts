import { Component, input, output, signal } from '@angular/core';
import { ESTADOS } from '../../services/turnos.service';

/**
 * Componente hijo: barra de búsqueda y filtro por estado.
 *  - Recibe del padre (input):  cuántos turnos hay en total y cuántos se muestran.
 *  - Avisa al padre (output):   el texto buscado y el estado elegido.
 * No filtra nada por sí mismo: de eso se encarga el pipe `filtroTurnos` en el padre.
 */
@Component({
  selector: 'app-filtros-turnos',
  standalone: true,
  templateUrl: './filtros-turnos.html'
})
export class FiltrosTurnos {
  readonly total = input.required<number>();
  readonly mostrados = input.required<number>();

  readonly buscar = output<string>();
  readonly estadoElegido = output<string>();

  readonly estados = ESTADOS;
  protected texto = signal('');
  protected estado = signal('');

  protected onTexto(valor: string): void {
    this.texto.set(valor);
    this.buscar.emit(valor);
  }

  protected onEstado(valor: string): void {
    this.estado.set(valor);
    this.estadoElegido.emit(valor);
  }

  protected hayFiltros(): boolean {
    return this.texto() !== '' || this.estado() !== '';
  }

  protected limpiar(): void {
    this.onTexto('');
    this.onEstado('');
  }
}
