import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

interface Turno {
  nombre: string;
  apellido: string;
  mail: string;
  servicio: string;
  fecha: string;
  dia: string;
  hora: string;
  estado: 'Confirmado' | 'Pendiente';
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule], 
  templateUrl: './admin.html',  
  styleUrl: './admin.css'        
})
export class Admin implements OnInit { 
  listaTurnos: Turno[] = [];

  constructor(private router: Router, private auth: AuthService) {}

  async ngOnInit() {
    await this.auth.ready;
    if (!this.auth.isAdmin()) {
      this.router.navigateByUrl('login');
      return;
    }
    this.cargarTurnos();
  }

  cargarTurnos(): void {
    this.listaTurnos = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('turnos_')) {
        const datos = localStorage.getItem(key);
        if (datos) {
          try {
            const turnosUsuario = JSON.parse(datos);
            this.listaTurnos.push(...turnosUsuario);
          } catch (e) {
            console.error("Error al parsear datos de: " + key);
          }
        }
      }
    }
  }

  eliminarTurno(mailCliente: string, hora: string, dia: string) {
    const key = `turnos_${mailCliente}`;
    const datos = localStorage.getItem(key);
    
    if (datos) {
      let turnos: Turno[] = JSON.parse(datos);
      
      // Filtrar: mantenemos todos los que NO coincidan exactamente
      const antes = turnos.length;
      turnos = turnos.filter(t => !(t.hora === hora && t.dia === dia));
      
      if (turnos.length < antes) {
        if (turnos.length > 0) {
          localStorage.setItem(key, JSON.stringify(turnos));
        } else {
          localStorage.removeItem(key);
        }
        this.cargarTurnos(); // Recargamos la vista
      }
    }
  }

  async cerrarSesion() {
    await this.auth.logout();
    this.router.navigateByUrl('login');
  }
}