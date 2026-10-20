import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, Rol } from '../services/auth.service';

/** Deja pasar solo si hay una sesión iniciada; si no, manda a /login. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.ready;
  return auth.user() ? true : router.createUrlTree(['/login']);
};

/**
 * Deja pasar solo a usuarios con alguno de los roles indicados.
 *  - Sin sesión            → /login
 *  - Con sesión, otro rol  → a la pantalla que le corresponde a su rol
 */
export const roleGuard = (roles: Rol[]): CanActivateFn => {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    await auth.ready;

    const rol = auth.rol();
    if (!auth.user() || !rol) return router.createUrlTree(['/login']);
    if (roles.includes(rol)) return true;

    return router.createUrlTree([rol === 'admin' ? '/admin-dashboard' : '/mis-turnos']);
  };
};