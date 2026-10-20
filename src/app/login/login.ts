import { Component } from '@angular/core';
import { Registros } from '../templates/templates';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  miLogin: Registros;
  cargando = false;

  constructor(public router: Router, private auth: AuthService) {
    this.miLogin = new Registros();
  }

  async login() {
    if (this.cargando) return;
    this.cargando = true;

    try {
      await this.auth.login(this.miLogin.mail.trim(), this.miLogin.contra);
    } catch (e) {
      alert(this.auth.traducirError(e));
      this.cargando = false;
      return;
    }
    this.cargando = false;

    if (this.auth.isAdmin()) {
      this.router.navigateByUrl('admin-dashboard');
      return;
    }

    // Cliente: si ya tiene turnos va a verlos, si no a reservar uno
    const turnosGuardados = localStorage.getItem(`turnos_${this.auth.email()}`);
    const listaTurnos = turnosGuardados ? JSON.parse(turnosGuardados) : [];
    this.router.navigateByUrl(listaTurnos.length > 0 ? 'mis-turnos' : 'turno');
  }
}
