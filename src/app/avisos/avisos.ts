import { Component, HostListener, inject } from '@angular/core';
import { AvisoService } from '../services/aviso.service';

@Component({
  selector: 'app-avisos',
  template: `
    @if (svc.aviso(); as a) {
      <div class="fondo" (click)="svc.cerrar(false)">
        <div class="caja" [class.exito]="a.tipo === 'exito'" [class.error]="a.tipo === 'error'"
             role="alertdialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="icono">
            @switch (a.tipo) {
              @case ('exito') { ✓ }
              @case ('error') { ! }
              @default { ? }
            }
          </div>
          <p class="mensaje">{{ a.mensaje }}</p>
          <div class="acciones">
            @if (a.tipo === 'confirmar') {
              <button type="button" class="btn btn-secundario" (click)="svc.cerrar(false)">Cancelar</button>
              <button type="button" class="btn btn-primario" (click)="svc.cerrar(true)">Aceptar</button>
            } @else {
              <button type="button" class="btn btn-primario" (click)="svc.cerrar(true)">Entendido</button>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .fondo {
      position: fixed; inset: 0; z-index: 1000;
      display: flex; align-items: center; justify-content: center;
      padding: 1rem;
      background: rgb(0 0 0 / 0.6);
      backdrop-filter: blur(4px);
      animation: fundir 0.2s ease both;
    }
    .caja {
      width: 100%; max-width: 24rem; text-align: center;
      background: rgb(var(--n-900));
      border: 1px solid rgb(var(--n-800));
      border-top: 3px solid rgb(var(--acento));
      border-radius: 1rem;
      padding: 1.75rem 1.5rem 1.5rem;
      box-shadow: var(--sombra);
      animation: subir 0.25s ease both;
    }
    .caja.exito { border-top-color: #10b981; }
    .caja.error { border-top-color: rgb(var(--peligro)); }
    .icono {
      width: 3rem; height: 3rem; margin: 0 auto 1rem;
      display: flex; align-items: center; justify-content: center;
      border-radius: 9999px; font-size: 1.4rem; font-weight: 800;
      background: rgb(var(--acento) / 0.14); color: var(--acento-texto);
    }
    .exito .icono { background: rgb(16 185 129 / 0.14); color: #10b981; }
    .error .icono { background: rgb(var(--peligro) / 0.14); color: rgb(var(--peligro)); }
    .mensaje {
      margin: 0 0 1.5rem; font-size: 0.95rem; line-height: 1.5;
      color: rgb(var(--n-200)); white-space: pre-line;
    }
    .acciones { display: flex; gap: 0.6rem; }
    .acciones .btn { flex: 1; }
    @keyframes fundir { from { opacity: 0; } to { opacity: 1; } }
    @keyframes subir {
      from { opacity: 0; transform: translateY(12px) scale(0.97); }
      to { opacity: 1; transform: none; }
    }
  `
})
export class Avisos {
  protected svc = inject(AvisoService);

  @HostListener('document:keydown.escape')
  alEscape(): void {
    if (this.svc.aviso()) this.svc.cerrar(false);
  }
}