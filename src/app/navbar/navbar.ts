import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar {
  constructor(private router: Router, private auth: AuthService) {}

  reservarTurno() {
    this.router.navigateByUrl(this.auth.user() ? '/turno' : '/registro');
  }
}
