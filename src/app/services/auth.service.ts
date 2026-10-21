import { Injectable, computed, signal } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  User,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseConfig } from '../firebase.config';

export type Rol = 'admin' | 'cliente';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private app = initializeApp(firebaseConfig);
  private auth = getAuth(this.app);
  private db = getFirestore(this.app);

  /** Usuario actual de Firebase (null si no hay sesión). */
  readonly user = signal<User | null>(null);
  /** Rol del usuario actual, leído de Firestore (users/{uid}.role). */
  readonly rol = signal<Rol | null>(null);

  readonly email = computed(() => this.user()?.email ?? null);
  readonly isAdmin = computed(() => this.rol() === 'admin');

  /** Se resuelve cuando Firebase restauró la sesión Y se cargó el rol. */
  readonly ready: Promise<void>;

  // Evita leer/crear dos veces el mismo perfil si se llama a la vez
  private enCurso = new Map<string, Promise<Rol>>();

  constructor() {
    this.ready = new Promise<void>((resolve) => {
      onAuthStateChanged(this.auth, async (u) => {
        this.user.set(u);
        this.rol.set(u ? await this.cargarRol(u) : null);
        resolve();
      });
    });
  }

  async register(email: string, password: string): Promise<void> {
    const cred = await createUserWithEmailAndPassword(this.auth, email, password);
    this.user.set(cred.user);
    this.rol.set(await this.cargarRol(cred.user));
  }

  async login(email: string, password: string): Promise<void> {
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    this.user.set(cred.user);
    this.rol.set(await this.cargarRol(cred.user));
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
    this.user.set(null);
    this.rol.set(null);
  }

  /** Token (JWT) del usuario para mandarlo al backend. Firebase lo renueva solo si venció. */
   async obtenerToken(): Promise<string> {
     const u = this.auth.currentUser;
     if (!u) throw new Error('No hay una sesión iniciada.');
     return u.getIdToken();
   }
   
  private cargarRol(u: User): Promise<Rol> {
    let p = this.enCurso.get(u.uid);
    if (!p) {
      p = this.leerOCrearPerfil(u).finally(() => this.enCurso.delete(u.uid));
      this.enCurso.set(u.uid, p);
    }
    return p;
  }

  /** Lee users/{uid}. Si no existe (primer ingreso), lo crea como 'cliente'. */
  private async leerOCrearPerfil(u: User): Promise<Rol> {
    try {
      const ref = doc(this.db, 'users', u.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        return snap.data()['role'] === 'admin' ? 'admin' : 'cliente';
      }
      await setDoc(ref, { email: u.email, role: 'cliente', creadoEn: serverTimestamp() });
      return 'cliente';
    } catch (e) {
      // Ante cualquier error se asume el rol de menos privilegios
      console.error('No se pudo cargar el rol del usuario:', e);
      return 'cliente';
    }
  }

  /** Convierte los errores de Firebase en mensajes entendibles. */
  traducirError(e: unknown): string {
    const code = (e as { code?: string })?.code ?? '';
    switch (code) {
      case 'auth/email-already-in-use':
        return 'Ese email ya está registrado.';
      case 'auth/invalid-email':
        return 'El email no es válido.';
      case 'auth/weak-password':
        return 'La contraseña es muy débil (mínimo 6 caracteres).';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Email o contraseña incorrectos.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Probá de nuevo en unos minutos.';
      case 'auth/network-request-failed':
        return 'Sin conexión. Revisá tu internet.';
      case 'auth/operation-not-allowed':
        return 'El login con email no está habilitado en Firebase.';
      case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      case 'auth/invalid-api-key':
        return 'La config de Firebase no es válida. Revisá firebase.config.ts.';
      default:
        return 'Ocurrió un error. Intentá de nuevo.';
    }
  }
}