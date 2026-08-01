// Carga de los JSON y todo lo que se deriva de ellos.
// Los ficheros son la fuente de la verdad; aquí no se inventa ningún dato,
// solo se indexa y se suma.

import { comoArray } from './util.js';

export let VIAJE = null;
export let RUTAS = null;
export let LUGARES = null;
export let APARCAR = null;
export let COMER = null;
export let DORMIR = null;

/** id → objeto, para resolver las referencias de los días. */
export const RUTA = new Map();
export const PARKING = new Map();
export const CAMA = new Map();

async function json(ruta) {
  const r = await fetch(ruta);
  if (!r.ok) throw new Error(`No se pudo cargar ${ruta} (${r.status})`);
  return r.json();
}

export async function cargar() {
  const [viaje, rutas, lugares, aparcar, comer, dormir] = await Promise.all([
    json('datos/viaje.json'),
    json('datos/rutas.json'),
    json('datos/lugares.json'),
    json('datos/aparcar.json'),
    json('datos/comer.json'),
    json('datos/dormir.json')
  ]);

  VIAJE = viaje;
  RUTAS = rutas;
  LUGARES = lugares;
  APARCAR = aparcar;
  COMER = comer;
  DORMIR = dormir;

  RUTAS.rutas.forEach(r => RUTA.set(r.id, r));
  APARCAR.ciudades.forEach(c => PARKING.set(c.id, c));
  DORMIR.sitios.forEach(s => CAMA.set(s.id, s));

  RUTAS.rutas.forEach(comprobarSumas);
  return true;
}

/** Los totales de cada ruta están escritos a mano en el JSON: si alguien retoca un día
 *  y se olvida del total, esto lo canta por consola en vez de dejar la web mintiendo. */
function comprobarSumas(r) {
  const km = r.dias.reduce((t, d) => t + (d.km || 0), 0);
  const min = r.dias.reduce((t, d) => t + (d.minutos || 0), 0);
  const eur = r.dias.reduce((t, d) => t + (d.coste_dia || 0), 0);
  if (km !== r.km) console.warn(`[${r.id}] km: los días suman ${km} y el total dice ${r.km}`);
  if (min !== r.minutos_volante) console.warn(`[${r.id}] minutos: los días suman ${min} y el total dice ${r.minutos_volante}`);
  if (eur !== r.coste_estimado) console.warn(`[${r.id}] coste: los días suman ${eur} y el total dice ${r.coste_estimado}`);

  const noches = r.bases.reduce((t, b) => t + b.noches, 0);
  if (noches !== VIAJE.ferri.noches) console.warn(`[${r.id}] bases: suman ${noches} noches y el viaje tiene ${VIAJE.ferri.noches}`);
}

// ── Datos derivados ────────────────────────────────────────────────────────

/** Parkings de un día, ya resueltos. Un día puede tener dos ciudades. */
export function parkingsDe(dia) {
  return comoArray(dia.aparcar).map(id => PARKING.get(id)).filter(Boolean);
}

/** El sitio donde se duerme ese día, resuelto. */
export function camaDe(dia) {
  return dia.dormir ? CAMA.get(dia.dormir) || null : null;
}

/** Minutos que se van en ir y volver del centro en transporte público ese día. */
export function minutosTransporte(dia) {
  return parkingsDe(dia).reduce((t, p) => t + (p.minutos_centro || 0) * 2, 0);
}

/** Días marcados como apretados, con su motivo. */
export function apretadosDe(ruta) {
  return ruta.dias.filter(d => d.apretado);
}

/** Días en los que se para en más de una ciudad. */
export function diasConDosCiudades(ruta) {
  return ruta.dias.filter(d => comoArray(d.aparcar).length > 1);
}

/** El día con más kilómetros. */
export function diaMasLargo(ruta) {
  return ruta.dias.reduce((a, b) => (b.km > a.km ? b : a), ruta.dias[0]);
}

/** Noches que se pasan en una base donde te quedas más de una noche seguida. */
export function nochesEnBaseLarga(ruta) {
  return ruta.bases.filter(b => b.noches > 1).reduce((t, b) => t + b.noches, 0);
}

/** Litros y euros de combustible estimados para una ruta. */
export function combustible(ruta) {
  const litros = (ruta.km * VIAJE.coche.consumo_l100) / 100;
  return { litros: Math.round(litros), euros: Math.round(litros * VIAJE.combustible.precio_litro_estimado) };
}

/** Lugares del mapa que pertenecen a una ruta (o todos si no se pasa ninguna). */
export function lugaresDe(idRuta) {
  if (!idRuta) return LUGARES.lugares;
  return LUGARES.lugares.filter(l => l.rutas.includes(idRuta));
}

/** Las regiones de comida que toca una ruta, en el orden en que se atraviesan. */
export function regionesDe(idRuta) {
  const enTodas = ['lazio', 'toscana', 'liguria', 'maremma'];
  const soloRuta3 = ['emilia', 'umbria'];
  return COMER.regiones.filter(r =>
    enTodas.includes(r.id) || (idRuta === 'comer' && soloRuta3.includes(r.id)) || !idRuta
  );
}
