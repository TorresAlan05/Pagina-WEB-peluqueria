import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip
} from 'chart.js';
import { Turno, TurnosService } from '../services/turnos.service';

// Se registra solo lo que se usa (el bundle queda más chico)
Chart.register(
  BarController, BarElement, DoughnutController, ArcElement,
  CategoryScale, LinearScale, Tooltip, Legend
);

const PALETA = ['#f59e0b', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#fb923c', '#22d3ee', '#facc15'];

@Component({
  selector: 'app-admin-graficos',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-graficos.html'
})
export class AdminGraficos implements OnInit {
  private turnosSvc = inject(TurnosService);

  turnos = signal<Turno[]>([]);
  cargando = signal(true);
  error = signal('');

  private canvasTurnos = viewChild<ElementRef<HTMLCanvasElement>>('canvasTurnos');
  private canvasIngresos = viewChild<ElementRef<HTMLCanvasElement>>('canvasIngresos');
  private graficos: Chart[] = [];

  /** Números de las tarjetas. Los ingresos cuentan solo turnos Finalizados. */
  resumen = computed(() => {
    const t = this.turnos();
    const fin = t.filter((x) => x.estado === 'Finalizado');
    return {
      total: t.length,
      pendientes: t.length - fin.length,
      finalizados: fin.length,
      ingresos: fin.reduce((suma, x) => suma + (x.precio ?? 0), 0)
    };
  });

  hayIngresos = computed(() => this.resumen().ingresos > 0);

  /** Un registro por servicio, ordenado del más usado al menos usado. */
  porServicio = computed(() => {
    const mapa = new Map<string, { pendientes: number; finalizados: number; ingresos: number }>();
    for (const t of this.turnos()) {
      const e = mapa.get(t.servicio) ?? { pendientes: 0, finalizados: 0, ingresos: 0 };
      if (t.estado === 'Finalizado') {
        e.finalizados++;
        e.ingresos += t.precio ?? 0;
      } else {
        e.pendientes++;
      }
      mapa.set(t.servicio, e);
    }
    return [...mapa.entries()]
      .map(([servicio, v]) => ({ servicio, ...v }))
      .sort((a, b) => b.pendientes + b.finalizados - (a.pendientes + a.finalizados));
  });

  constructor() {
    // Redibuja los gráficos cuando cambian los datos o cuando los canvas ya existen
    effect(() => {
      const datos = this.porServicio();
      const c1 = this.canvasTurnos()?.nativeElement;
      const c2 = this.canvasIngresos()?.nativeElement;
      if (!c1 || !c2) return;
      this.dibujar(c1, c2, datos);
    });
    inject(DestroyRef).onDestroy(() => this.destruir());
  }

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.turnos.set(await this.turnosSvc.listarTodos());
    } catch (e) {
      console.error(e);
      this.error.set(e instanceof Error ? e.message : 'No se pudieron cargar los turnos.');
    } finally {
      this.cargando.set(false);
    }
  }

  moneda(n: number): string {
    return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  }

  private destruir(): void {
    this.graficos.forEach((g) => g.destroy());
    this.graficos = [];
  }

  private dibujar(
    c1: HTMLCanvasElement,
    c2: HTMLCanvasElement,
    datos: { servicio: string; pendientes: number; finalizados: number; ingresos: number }[]
  ): void {
    this.destruir();

    Chart.defaults.color = '#a3a3a3';
    Chart.defaults.borderColor = '#262626';
    Chart.defaults.font.family = 'Montserrat, sans-serif';

    const etiquetas = datos.map((d) => d.servicio);

    this.graficos.push(
      new Chart(c1, {
        type: 'bar',
        data: {
          labels: etiquetas,
          datasets: [
            { label: 'Pendientes', data: datos.map((d) => d.pendientes), backgroundColor: '#f59e0b' },
            { label: 'Finalizados', data: datos.map((d) => d.finalizados), backgroundColor: '#34d399' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      })
    );

    this.graficos.push(
      new Chart(c2, {
        type: 'doughnut',
        data: {
          labels: etiquetas,
          datasets: [
            {
              data: datos.map((d) => d.ingresos),
              backgroundColor: PALETA,
              borderColor: '#171717',
              borderWidth: 2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.label}: ${this.moneda(Number(ctx.parsed))}`
              }
            }
          }
        }
      })
    );
  }
}