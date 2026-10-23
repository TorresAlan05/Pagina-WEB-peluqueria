import { Injectable, signal } from '@angular/core';

export type NombreTema = 'oscuro' | 'claro';

const CLAVE = 'tema-peluqueria';

/** Guarda y aplica el tema. Los estilos globales leen el atributo data-theme. */
@Injectable({ providedIn: 'root' })
export class TemaService {
  readonly tema = signal<NombreTema>(this.leerInicial());

  constructor() {
    this.aplicar(this.tema());
  }

  alternar(): void {
    const nuevo: NombreTema = this.tema() === 'oscuro' ? 'claro' : 'oscuro';
    this.tema.set(nuevo);
    this.aplicar(nuevo);
    try {
      localStorage.setItem(CLAVE, nuevo);
    } catch {
      /* modo privado: no se guarda */
    }
  }

  private aplicar(t: NombreTema): void {
    document.documentElement.setAttribute('data-theme', t === 'claro' ? 'light' : 'dark');
  }

  private leerInicial(): NombreTema {
    try {
      const guardado = localStorage.getItem(CLAVE);
      if (guardado === 'claro' || guardado === 'oscuro') return guardado;
    } catch {
      /* sin acceso a localStorage */
    }
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'claro' : 'oscuro';
  }
}