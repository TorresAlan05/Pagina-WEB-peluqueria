import { Component } from '@angular/core';
import { Registros } from '../templates/templates';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { TurnosService } from '../services/turnos.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  miLogin: Registros;
  cargando = false;

  constructor(public router: Router, private auth: AuthService, private turnosSvc: TurnosService) {
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
        if (this.auth.isPeluquero()) {
      this.router.navigateByUrl('agenda');
      return;
    }

    // Cliente: si ya tiene turnos va a verlos, si no a reservar uno
    let tieneTurnos = false;
    try {
      const uid = this.auth.user()?.uid;
      tieneTurnos = !!uid && (await this.turnosSvc.listarMios(uid)).length > 0;
    } catch (e) {
      console.error(e);
    }
    this.router.navigateByUrl(tieneTurnos ? 'mis-turnos' : 'turno');
  }
}
