// Utilidades comunes: DOM, fechas en hora de Roma, formato y geometría.

export const $  = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

export const ZONA = 'Europe/Rome';

/** Escapa texto para poder interpolarlo en HTML sin riesgo. */
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const FMT_ROMA = new Intl.DateTimeFormat('sv-SE', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false
});

/** Fecha y hora actuales en Italia: { fecha:'2026-08-19', hora:'14:30', min:870 }. */
export function ahora() {
  const [fecha, hora] = FMT_ROMA.format(new Date()).replace(',', '').split(' ');
  return { fecha, hora, min: aMinutos(hora) };
}

/** 'HH:MM' -> minutos desde medianoche. */
export function aMinutos(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm ?? ''));
  return m ? +m[1] * 60 + +m[2] : 0;
}

export function deMinutos(min) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Días completos entre dos fechas ISO (b - a). */
export function diasEntre(a, b) {
  return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
}

const DIA_SEM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
             'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** '2026-08-19' -> 'miércoles 19 de agosto'. */
export function fechaLarga(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  return `${DIA_SEM[d.getUTCDay()]} ${d.getUTCDate()} de ${MES[d.getUTCMonth()]}`;
}

/** '2026-08-19' -> '19 ago'. */
export function fechaCorta(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  return `${d.getUTCDate()} ${MES[d.getUTCMonth()].slice(0, 3)}`;
}

export function eur(n, decimales = 0) {
  const v = Number(n) || 0;
  return v.toLocaleString('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }) + ' €';
}

export function num(n, decimales = 0) {
  return (Number(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

/** 210 -> '3 h 30'. */
export function duracion(min) {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`;
}

/** Distancia en km entre dos [lat, lon]. */
export function haversine(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const s = Math.sin(dLat / 2) ** 2 +
            Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Longitud total de una cadena de puntos [[lat,lon], …] en km. */
export function largoCadena(pts) {
  let t = 0;
  for (let i = 1; i < pts.length; i++) t += haversine(pts[i - 1], pts[i]);
  return t;
}

/**
 * Convierte los precios del JSON ("GRATIS", "18 €", "5-8 €", "1,50 €/h") a euros.
 * En los rangos se queda con el extremo bajo: es un viaje de presupuesto mínimo.
 */
export function precioEur(txt) {
  if (txt == null) return 0;
  if (typeof txt === 'number') return txt;
  const t = String(txt).toLowerCase();
  if (/gratis|gratuit|incluido|con la card/.test(t)) return 0;
  const m = t.replace(/\./g, '').match(/\d+(?:,\d+)?/);
  return m ? parseFloat(m[0].replace(',', '.')) : 0;
}

/** true si el precio del JSON representa algo gratuito. */
export function esGratis(txt) {
  return txt == null || /gratis|gratuit|incluido/i.test(String(txt));
}

/** Enlaces a las apps de navegación del móvil. */
export function enlacesNavegacion(lat, lon, nombre = '') {
  const q = `${lat},${lon}`;
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`,
    waze:   `https://waze.com/ul?ll=${q}&navigate=yes`,
    apple:  `https://maps.apple.com/?daddr=${q}&dirflg=d`,
    geo:    `geo:${q}?q=${q}(${encodeURIComponent(nombre)})`,
    texto:  q
  };
}

/**
 * Texto plano de un fragmento HTML: quita etiquetas y descodifica entidades
 * (&amp;, &nbsp;…). Con un simple replace de <…> las entidades se quedarían
 * crudas y luego esc() las escaparía otra vez.
 */
export function soloTexto(html) {
  const t = document.createElement('template');
  t.innerHTML = String(html ?? '');
  return (t.content.textContent || '').replace(/\s+/g, ' ').trim();
}

/** Recorta un texto por la última palabra entera. */
export function recortar(texto, max) {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max);
  return corte.slice(0, corte.lastIndexOf(' ')) + '…';
}

/** Crea un nodo a partir de HTML. */
export function nodo(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Aviso efímero en la parte inferior. */
let temporizadorAviso;
export function avisar(texto) {
  const caja = $('#aviso-flotante');
  caja.textContent = texto;
  caja.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { caja.hidden = true; }, 2600);
}

/** Descarga un texto como fichero. */
export function descargar(nombre, texto, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
