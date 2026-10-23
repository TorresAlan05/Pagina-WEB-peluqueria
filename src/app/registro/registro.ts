import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Registros } from '../templates/templates';
import { AuthService } from '../services/auth.service';
import { AvisoService } from '../services/aviso.service';

@Component({
  selector: 'app-registro',
  imports: [FormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro {
  miRegistro: Registros;
  cargando = false;

  constructor(public route: Router, private auth: AuthService, private aviso: AvisoService) {
    this.miRegistro = new Registros();
  }

    async ClickRegistros() {
    if (this.cargando) return;

    if (!this.miRegistro.nombre.trim() || !this.miRegistro.apellido.trim()) {
      this.aviso.error('Completá tu nombre y apellido.');
      return;
    }
    if (this.miRegistro.contra !== this.miRegistro.contra2) {
      this.aviso.error('Las contraseñas no coinciden.');
      return;
    }
    if (this.miRegistro.contra.length < 6) {
      this.aviso.error('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    this.cargando = true;
    try {
      // Firebase crea el usuario, guarda nombre y apellido en su perfil y deja la sesión iniciada
      await this.auth.register(
        this.miRegistro.nombre,
        this.miRegistro.apellido,
        this.miRegistro.mail.trim(),
        this.miRegistro.contra
      );
    } catch (e) {
      this.aviso.error(this.auth.traducirError(e));
      this.cargando = false;
      return;
    }
    this.cargando = false;
    this.route.navigateByUrl('turno');
  }
}
