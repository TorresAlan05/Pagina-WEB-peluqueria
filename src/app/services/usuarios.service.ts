import { Injectable, inject } from '@angular/core';
import { collection, doc, getDocs, getFirestore, updateDoc } from 'firebase/firestore';
import { AuthService, Rol } from './auth.service';

export interface Usuario {
  uid: string;
  email: string;
  role: Rol;
  creadoEn: Date | null;
}

/**
 * Administración de usuarios sobre la colección users/{uid} de Firestore
 * (la misma que usa AuthService y el backend para saber el rol).
 * Las reglas de Firestore solo dejan listar usuarios y cambiar roles al admin.
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
          role: (data['role'] === 'admin' ? 'admin' : 'cliente') as Rol,
          creadoEn: data['creadoEn']?.toDate?.() ?? null
        };
      })
      .sort((a, b) => a.email.localeCompare(b.email));
  }

  async cambiarRol(uid: string, role: Rol): Promise<void> {
    await updateDoc(doc(this.db, 'users', uid), { role });
  }
}
