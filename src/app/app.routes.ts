import { Routes } from '@angular/router';
import { Registro } from './registro/registro';
import { Login } from './login/login';
import { Home } from './home/home';
import { Admin } from './admin/admin';
import { Turno } from './turno/turno';
import { MisTurnos } from './mis-turnos/mis-turnos';
import { Usuarios } from './usuarios/usuarios';
import { roleGuard } from './guards/auth.guard';


export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: Home },
  { path: 'login', component: Login },
  { path: 'registro', component: Registro },
  { path: 'admin-dashboard', component: Admin, canActivate: [roleGuard(['admin'])] },
  { path: 'admin-usuarios', component: Usuarios, canActivate: [roleGuard(['admin'])] },
  { path: 'mis-turnos', component: MisTurnos, canActivate: [roleGuard(['cliente'])] },
  { path: 'turno', component: Turno, canActivate: [roleGuard(['cliente'])] },
  { path: '**', redirectTo: 'home', pathMatch: 'full' }
];
