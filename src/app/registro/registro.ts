import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Registros } from '../templates/templates';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-registro',
  imports: [FormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro {
  miRegistro: Registros;
  cargando = false;

  constructor(public route: Router, private auth: AuthService) {
    this.miRegistro = new Registros();
  }

  async ClickRegistros() {
    if (this.cargando) return;

    if (this.miRegistro.contra !== this.miRegistro.contra2) {
      alert('Las contraseñas no coinciden.');
      return;
    }
    if (this.miRegistro.contra.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    this.cargando = true;
    try {
      // Firebase crea el usuario y deja la sesión iniciada
      await this.auth.register(this.miRegistro.mail.trim(), this.miRegistro.contra);
    } catch (e) {
      alert(this.auth.traducirError(e));
      this.cargando = false;
      return;
    }
    this.cargando = false;
    this.route.navigateByUrl('turno');
  }
}
