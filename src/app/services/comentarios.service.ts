import { Injectable, inject, signal } from '@angular/core';
import {
  addDoc, collection, deleteDoc, doc, getFirestore,
  limit, onSnapshot, orderBy, query, serverTimestamp
} from 'firebase/firestore';
import { AuthService } from './auth.service';

export interface Comentario {
  id: string;
  uid: string;
  nombre: string;
  texto: string;
  fecha: Date | null;
}

@Injectable({ providedIn: 'root' })
export class ComentariosService {
  private auth = inject(AuthService); // asegura que Firebase ya esté inicializado
  private db = getFirestore();

  readonly lista = signal<Comentario[]>([]);
  private escuchando = false;

  /** Escucha en tiempo real los últimos 50 comentarios (se activa una sola vez). */
  escuchar(): void {
    if (this.escuchando) return;
    this.escuchando = true;

    const q = query(collection(this.db, 'comentarios'), orderBy('creadoEn', 'desc'), limit(50));
    onSnapshot(
      q,
      (snap) => {
        this.lista.set(
          snap.docs.map((d) => {
            const data = d.data({ serverTimestamps: 'estimate' });
            return {
              id: d.id,
              uid: data['uid'] as string,
              nombre: data['nombre'] as string,
              texto: data['texto'] as string,
              fecha: data['creadoEn']?.toDate?.() ?? null
            };
          })
        );
      },
      (e) => {
        console.error('No se pudieron cargar los comentarios:', e);
        this.escuchando = false;
      }
    );
  }

  async enviar(texto: string): Promise<void> {
    const u = this.auth.user();
    if (!u) throw new Error('Tenés que iniciar sesión para comentar.');
    const nombre = this.auth.nombreCompleto() || (u.email ?? 'Usuario').split('@')[0];
    await addDoc(collection(this.db, 'comentarios'), {
      uid: u.uid,
      nombre,
      texto: texto.trim(),
      creadoEn: serverTimestamp()
    });
  }

  eliminar(id: string): Promise<void> {
    return deleteDoc(doc(this.db, 'comentarios', id));
  }
}