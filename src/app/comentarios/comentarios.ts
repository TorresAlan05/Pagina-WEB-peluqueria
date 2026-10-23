import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AvisoService } from '../services/aviso.service';
import { Comentario, ComentariosService } from '../services/comentarios.service';

@Component({
  selector: 'app-comentarios',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <button type="button" class="btn btn-primario flotante" (click)="alternar()">
      💬 Comentarios
    </button>

    @if (abierto()) {
      <section class="panel" role="dialog" aria-label="Comentarios">
        <header class="cabecera">
          <h2>Comentarios</h2>
          <button type="button" class="cerrar" (click)="abierto.set(false)" aria-label="Cerrar">✕</button>
        </header>

        <div class="lista">
          @for (c of svc.lista(); track c.id) {
            <article class="msg" [class.mio]="c.uid === auth.user()?.uid">
              <div class="meta">
                <strong>{{ c.nombre }}</strong>
                <small>{{ c.fecha | date: 'dd/MM HH:mm' }}</small>
              </div>
              <p>{{ c.texto }}</p>
              @if (puedeBorrar(c)) {
                <button type="button" class="borrar" (click)="borrar(c)">Eliminar</button>
              }
            </article>
          } @empty {
            <p class="vacio">Todavía no hay comentarios. ¡Sé el primero!</p>
          }
        </div>

        @if (auth.user()) {
          <div class="envio">
            <textarea class="campo" rows="2" [maxlength]="max" placeholder="Escribí tu comentario..."
              [ngModel]="texto()" (ngModelChange)="texto.set($event)"
              (keydown.enter)="$event.preventDefault(); enviar()"></textarea>
            <div class="envio-pie">
              <small>{{ texto().length }}/{{ max }}</small>
              <button type="button" class="btn btn-primario btn-chico"
                [disabled]="enviando() || !texto().trim()" (click)="enviar()">Enviar</button>
            </div>
          </div>
        } @else {
          <p class="login">
            Para comentar <a routerLink="/login" class="link-marca" (click)="abierto.set(false)">iniciá sesión</a>
            o <a routerLink="/registro" class="link-marca" (click)="abierto.set(false)">creá tu cuenta</a>.
          </p>
        }
      </section>
    }
  `,
  styles: `
    .flotante { position: fixed; right: 1rem; bottom: 1rem; z-index: 900; }
    .panel {
      position: fixed; right: 1rem; bottom: 4.5rem; z-index: 900;
      width: min(24rem, calc(100vw - 2rem)); height: min(34rem, 70vh);
      display: flex; flex-direction: column;
      background: rgb(var(--n-900));
      border: 1px solid rgb(var(--n-800));
      border-top: 3px solid rgb(var(--acento));
      border-radius: 1rem; box-shadow: var(--sombra);
    }
    .cabecera {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.9rem 1.1rem; border-bottom: 1px solid rgb(var(--n-800));
    }
    .cabecera h2 { margin: 0; font-size: 1.05rem; font-weight: 800; }
    .cerrar { background: none; border: 0; cursor: pointer; font-size: 1rem; color: rgb(var(--n-400)); }
    .cerrar:hover { color: var(--acento-texto); }
    .lista {
      flex: 1; overflow-y: auto; padding: 1rem;
      display: flex; flex-direction: column; gap: 0.7rem;
    }
    .msg {
      padding: 0.7rem 0.9rem; border-radius: 0.8rem;
      background: rgb(var(--n-950)); border: 1px solid rgb(var(--n-800));
    }
    .msg.mio { border-color: rgb(var(--acento) / 0.5); }
    .meta { display: flex; justify-content: space-between; gap: 0.5rem; font-size: 0.8rem; }
    .meta strong { color: var(--acento-texto); }
    .meta small { color: rgb(var(--n-500)); }
    .msg p { margin: 0.35rem 0 0; font-size: 0.9rem; word-break: break-word; white-space: pre-line; }
    .borrar {
      margin-top: 0.4rem; background: none; border: 0; padding: 0; cursor: pointer;
      font-size: 0.72rem; color: rgb(var(--peligro));
    }
    .borrar:hover { text-decoration: underline; }
    .vacio, .login { text-align: center; font-size: 0.85rem; color: rgb(var(--n-500)); }
    .vacio { margin: auto 0; }
    .login { margin: 0; padding: 1rem; border-top: 1px solid rgb(var(--n-800)); }
    .envio { padding: 0.8rem 1rem 1rem; border-top: 1px solid rgb(var(--n-800)); }
    .envio textarea { min-height: 3rem; resize: none; }
    .envio-pie { display: flex; align-items: center; justify-content: space-between; margin-top: 0.5rem; }
    .envio-pie small { color: rgb(var(--n-500)); }
  `
})
export class Comentarios {
  protected svc = inject(ComentariosService);
  protected auth = inject(AuthService);
  private aviso = inject(AvisoService);

  readonly max = 300;
  abierto = signal(false);
  texto = signal('');
  enviando = signal(false);

  alternar(): void {
    this.abierto.update((v) => !v);
    if (this.abierto()) this.svc.escuchar();
  }

  puedeBorrar(c: Comentario): boolean {
    return c.uid === this.auth.user()?.uid || this.auth.isAdmin();
  }

  async enviar(): Promise<void> {
    const t = this.texto().trim();
    if (!t || this.enviando()) return;
    this.enviando.set(true);
    try {
      await this.svc.enviar(t);
      this.texto.set('');
    } catch (e) {
      console.error(e);
      this.aviso.error(e instanceof Error ? e.message : 'No se pudo enviar el comentario.');
    } finally {
      this.enviando.set(false);
    }
  }

  async borrar(c: Comentario): Promise<void> {
    if (!(await this.aviso.confirmar('¿Eliminar este comentario?'))) return;
    try {
      await this.svc.eliminar(c.id);
    } catch (e) {
      console.error(e);
      this.aviso.error('No se pudo eliminar el comentario.');
    }
  }
}