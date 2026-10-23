import { Injectable, inject } from '@angular/core';
import { collection, doc, getDocs, getFirestore, query, updateDoc, where } from 'firebase/firestore';
import { AuthService, Rol, aRol } from './auth.service';

export interface Usuario {
  uid: string;
  email: string;
  /** Nombre y apellido juntos ('' si la cuenta no los cargó). */
  nombre: string;
  role: Rol;
  creadoEn: Date | null;
}

export interface Peluquero {
  uid: string;
  nombre: string;
}

const nombreCompleto = (d: Record<string, unknown>): string =>
  `${(d['nombre'] as string) ?? ''} ${(d['apellido'] as string) ?? ''}`.trim();

/**
 * Administración de usuarios sobre la colección users/{uid} de Firestore
 * (la misma que usa AuthService y el backend para saber el rol).
 * Las reglas de Firestore solo dejan listar usuarios y cambiar roles al admin;
 * cualquier usuario con sesión puede ver a los peluqueros.
 */
@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private auth = inject(AuthService); // asegura que Firebase ya esté inicializado
  private db = getFirestore();

  async listar(): Promise<Usuario[]> {
    const snap = await getDocs(collection(this.db, 'users'));
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          email: (data['email'] as string) ?? '(sin mail)',
          nombre: nombreCompleto(data),
          role: aRol(data['role']),
          creadoEn: data['creadoEn']?.toDate?.() ?? null
        };
      })
      .sort((a, b) => (a.nombre || a.email).localeCompare(b.nombre || b.email));
  }

  /** Peluqueros disponibles para reservar. */
  async listarPeluqueros(): Promise<Peluquero[]> {
    const snap = await getDocs(query(collection(this.db, 'users'), where('role', '==', 'peluquero')));
    return snap.docs
      .map((d) => {
        const data = d.data();
        return { uid: d.id, nombre: nombreCompleto(data) || (data['email'] as string) || 'Peluquero' };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  /** Solo cliente o peluquero: las reglas de Firestore no dejan crear otro admin. */
  async cambiarRol(uid: string, role: Rol): Promise<void> {
    await updateDoc(doc(this.db, 'users', uid), { role });
  }
}