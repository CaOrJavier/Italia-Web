// Utilidades sueltas. Sin dependencias.

/** Escapa texto que va a ir dentro de innerHTML. Todo lo que venga de los JSON pasa por aquí. */
export function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** '2026-08-14' → 'viernes 14 de agosto' */
export function fechaLarga(iso) {
  const d = fecha(iso);
  if (!d) return '';
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** '2026-08-14' → 'vie 14' */
export function fechaCorta(iso) {
  const d = fecha(iso);
  if (!d) return '';
  return `${DIAS[d.getDay()].slice(0, 3)} ${d.getDate()}`;
}

/** Parsea la fecha ISO en horario local, no en UTC: 'new Date("2026-08-14")' se va un día atrás
 *  en husos negativos y aquí las fechas son días de calendario, no instantes. */
export function fecha(iso) {
  if (!iso) return null;
  const [a, m, d] = iso.split('-').map(Number);
  if (!a || !m || !d) return null;
  return new Date(a, m - 1, d);
}

/** 195 → '3 h 15' · 60 → '1 h' · 45 → '45 min' */
export function minutosAHoras(min) {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/** 1307 → '1.307' */
export function numero(n) {
  return new Intl.NumberFormat('es-ES').format(n);
}

/** 490 → '490 €' */
export function euros(n) {
  if (n === 0) return 'gratis';
  if (n === null || n === undefined) return '—';
  return `${numero(n)} €`;
}

/** Días entre hoy y una fecha ISO. Negativo si ya pasó. */
export function diasHasta(iso) {
  const objetivo = fecha(iso);
  if (!objetivo) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((objetivo - hoy) / 86400000);
}

/** Crea un elemento con clase y contenido HTML de una sentada. */
export function el(tag, clase, html) {
  const n = document.createElement(tag);
  if (clase) n.className = clase;
  if (html !== undefined) n.innerHTML = html;
  return n;
}

/** Normaliza a array un campo que puede venir suelto, en array o vacío. */
export function comoArray(v) {
  if (v === null || v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}
