import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { TemaService } from '../services/tema';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar {
  private router = inject(Router);
  protected auth = inject(AuthService);
    protected temaSvc = inject(TemaService);

  protected readonly enlace =
    'border border-neutral-800 hover:border-amber-500 bg-neutral-900/50 hover:bg-neutral-900 text-neutral-400 hover:text-amber-500 px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition';
  protected readonly boton =
    'bg-amber-500 hover:bg-amber-600 text-neutral-950 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-amber-500/20';

  reservarTurno() {
    this.router.navigateByUrl(this.auth.user() ? '/turno' : '/registro');
  }

  async cerrarSesion() {
    await this.auth.logout();
    this.router.navigateByUrl('/home');
  }
}