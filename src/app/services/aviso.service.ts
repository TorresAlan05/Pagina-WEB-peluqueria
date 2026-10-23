import { Injectable, signal } from '@angular/core';

export type TipoAviso = 'exito' | 'error' | 'confirmar';

export interface AvisoActivo {
  tipo: TipoAviso;
  mensaje: string;
}

@Injectable({ providedIn: 'root' })
export class AvisoService {
  readonly aviso = signal<AvisoActivo | null>(null);
  private resolver: ((ok: boolean) => void) | null = null;

  exito(mensaje: string): void {
    void this.abrir('exito', mensaje);
  }

  error(mensaje: string): void {
    void this.abrir('error', mensaje);
  }

  /** Devuelve true si el usuario toca "Aceptar", false si cancela. */
  confirmar(mensaje: string): Promise<boolean> {
    return this.abrir('confirmar', mensaje);
  }

  cerrar(ok = false): void {
    this.aviso.set(null);
    this.resolver?.(ok);
    this.resolver = null;
  }

  private abrir(tipo: TipoAviso, mensaje: string): Promise<boolean> {
    this.resolver?.(false); // si había otro abierto, se da por cancelado
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
      this.aviso.set({ tipo, mensaje });
    });
  }
}