import { Directive, computed, input } from '@angular/core';

const TONOS: Record<string, string> = {
  Finalizado: 'text-emerald-400 border-emerald-500/30',
  Pendiente: 'text-amber-500 border-amber-500/30',
  admin: 'text-amber-500 border-amber-500/30',
  cliente: 'text-neutral-300 border-neutral-700'
};
const NEUTRO = 'text-neutral-300 border-neutral-700';

/**
 * Directiva propia: pinta un elemento según un estado o rol.
 *   <select [appEstado]="turno.estado"> ...
 * Se aplica sobre los estilos que ya tenga el elemento (no los reemplaza).
 */
@Directive({
  selector: '[appEstado]',
  standalone: true,
  host: { '[class]': 'clases()' }
})
export class EstadoDirective {
  /** Valor a colorear: 'Pendiente', 'Finalizado', 'admin' o 'cliente'. */
  readonly appEstado = input.required<string>();

  protected readonly clases = computed(() => TONOS[this.appEstado()] ?? NEUTRO);
}
