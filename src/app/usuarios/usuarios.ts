import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService, Rol } from '../services/auth.service';
import { Usuario, UsuariosService } from '../services/usuarios.service';
import { EstadoDirective } from '../shared/estado.directive';
import { TurnosService } from '../services/turnos.service';
import { AvisoService } from '../services/aviso.service';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [RouterLink, EstadoDirective],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.css'
})
export class Usuarios implements OnInit {
  private aviso = inject(AvisoService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private svc = inject(UsuariosService);
    private turnosSvc = inject(TurnosService);
  readonly puedeEliminar = this.auth.esAdminPrincipal;

  readonly roles: Rol[] = ['cliente', 'peluquero'];

  usuarios = signal<Usuario[]>([]);
  busqueda = signal('');
  cargando = signal(true);
  error = signal('');
  procesando = signal<string | null>(null);

  miUid = computed(() => this.auth.user()?.uid ?? '');

    filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return q
      ? this.usuarios().filter((u) => `${u.nombre} ${u.email}`.toLowerCase().includes(q))
      : this.usuarios();
  });

  totalPeluqueros = computed(() => this.usuarios().filter((u) => u.role === 'peluquero').length);

  async ngOnInit(): Promise<void> {
    await this.auth.ready;
    if (!this.auth.isAdmin()) {
      this.router.navigateByUrl('login');
      return;
    }
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.usuarios.set(await this.svc.listar());
    } catch (e) {
      console.error(e);
      this.error.set('No se pudieron cargar los usuarios. Revisá las reglas de Firestore.');
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarRol(u: Usuario, valor: string): Promise<void> {
    const nuevo = valor as Rol;
    if (u.role === 'admin') return; // el administrador es único y no se modifica
    if (!this.roles.includes(nuevo) || nuevo === u.role) return;

    // Evita sacarse el rol uno mismo y quedarse sin administradores
    if (u.uid === this.miUid()) {
      this.aviso.error('No podés cambiar tu propio rol.');
      await this.cargar();
      return;
    }
    if (!(await this.aviso.confirmar(`¿Cambiar el rol de ${u.email} a "${nuevo}"?`))) {
      await this.cargar(); // el selector vuelve al valor real
      return;
    }

    this.procesando.set(u.uid);
    try {
      await this.svc.cambiarRol(u.uid, nuevo);
      this.usuarios.update((l) => l.map((x) => (x.uid === u.uid ? { ...x, role: nuevo } : x)));
    } catch (e) {
      console.error(e);
      this.aviso.error('No se pudo cambiar el rol.');
      await this.cargar();
    } finally {
      this.procesando.set(null);
    }
  }
    async eliminar(u: Usuario): Promise<void> {
    if (u.role === 'admin' || u.uid === this.miUid()) return;
    const ok = await this.aviso.confirmar(
      `¿Eliminar la cuenta de ${u.nombre || u.email}?\n\nSe borran su acceso, su perfil y sus turnos. No se puede deshacer.`
    );
    if (!ok) return;

    this.procesando.set(u.uid);
    try {
      await this.turnosSvc.eliminarCuenta(u.uid);
      this.usuarios.update((l) => l.filter((x) => x.uid !== u.uid));
    } catch (e) {
      console.error(e);
      this.aviso.error(e instanceof Error ? e.message : 'No se pudo eliminar la cuenta.');
    } finally {
      this.procesando.set(null);
    }
  }

  onBuscar(valor: string): void {
    this.busqueda.set(valor);
  }

  async cerrarSesion(): Promise<void> {
    await this.auth.logout();
    this.router.navigateByUrl('login');
  }
}
