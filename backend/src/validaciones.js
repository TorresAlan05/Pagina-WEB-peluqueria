export const HORAS = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
export const DIAS_MAX_ADELANTE = 30;
const ZONA = 'America/Argentina/Buenos_Aires';

/** Fecha ("YYYY-MM-DD") y minutos desde las 00:00 en hora argentina. */
export function ahoraArgentina() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date()).map((x) => [x.type, x.value])
  );
  return { fecha: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) };
}

function sumarDias(fecha, n) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function esFechaValida(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const d = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}

/** Mismas reglas que el formulario del front. Devuelve un mensaje de error o null si está bien. */
export function validarDiaHora(dia, hora) {
  if (!esFechaValida(dia)) return 'El día debe tener formato AAAA-MM-DD.';
  if (!HORAS.includes(hora)) return `La hora debe ser una de: ${HORAS.join(', ')}.`;

  const diaSemana = new Date(`${dia}T00:00:00Z`).getUTCDay(); // 0 = domingo, 6 = sábado
  if (diaSemana === 0 || diaSemana === 6) return 'Solo se atiende de lunes a viernes.';

  const hoy = ahoraArgentina();
  if (dia < hoy.fecha) return 'No se puede reservar en una fecha pasada.';
  if (dia > sumarDias(hoy.fecha, DIAS_MAX_ADELANTE)) {
    return `Solo se puede reservar hasta ${DIAS_MAX_ADELANTE} días adelante.`;
  }
  if (dia === hoy.fecha) {
    const [h, m] = hora.split(':').map(Number);
    if (h * 60 + m <= hoy.minutos) return 'Esa hora ya pasó.';
  }
  return null;
}

/** Texto obligatorio con largo máximo. Devuelve el texto limpio o null si es inválido. */
export function textoValido(valor, max) {
  if (typeof valor !== 'string') return null;
  const t = valor.trim();
  return t.length > 0 && t.length <= max ? t : null;
}

export function idValido(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}
