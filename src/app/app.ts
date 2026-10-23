import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './navbar/navbar';
import { Avisos } from './avisos/avisos';
import { Comentarios } from './comentarios/comentarios';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Avisos, Comentarios],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('peluqueria');
}