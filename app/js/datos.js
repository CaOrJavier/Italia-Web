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
export let IMAGENES = null;
export let ARBOL = null;

/** id → objeto, para resolver las referencias de los días. */
export const RUTA = new Map();
export const PARKING = new Map();
export const CAMA = new Map();
export const FOTO = new Map();

async function json(ruta) {
  const r = await fetch(ruta);
  if (!r.ok) throw new Error(`No se pudo cargar ${ruta} (${r.status})`);
  return r.json();
}

export async function cargar() {
  const [viaje, rutas, lugares, aparcar, comer, dormir, imagenes, arbol] = await Promise.all([
    json('datos/viaje.json'),
    json('datos/rutas.json'),
    json('datos/lugares.json'),
    json('datos/aparcar.json'),
    json('datos/comer.json'),
    json('datos/dormir.json'),
    // Las fotos son un extra: si faltan, la web va igual, solo que sin imágenes.
    json('datos/imagenes.json').catch(() => ({ fotos: [] })),
    json('datos/arbol.json')
  ]);

  VIAJE = viaje;
  RUTAS = rutas;
  LUGARES = lugares;
  APARCAR = aparcar;
  COMER = comer;
  DORMIR = dormir;
  IMAGENES = imagenes;
  ARBOL = arbol;

  RUTAS.rutas.forEach(r => RUTA.set(r.id, r));
  APARCAR.ciudades.forEach(c => PARKING.set(c.id, c));
  DORMIR.sitios.forEach(s => CAMA.set(s.id, s));
  (IMAGENES.fotos || []).forEach(f => FOTO.set(f.id, f));

  RUTAS.rutas.forEach(comprobarSumas);
  comprobarLugares();
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

/** La foto de un lugar, con su autor y su licencia, o null si no tiene. */
export function fotoDe(idLugar) {
  return FOTO.get(idLugar) || null;
}

/** id → lugar. */
export function lugar(id) {
  return LUGARES.lugares.find(l => l.id === id) || null;
}

/** Los lugares que toca un día, ya resueltos y sin repetir. */
export function lugaresDeDia(dia) {
  return comoArray(dia.lugares).map(lugar).filter(Boolean);
}

/** Los días de una ruta en los que se pisa un lugar. Vacío si esa ruta no pasa. */
export function diasDeLugar(idRuta, idLugar) {
  const r = RUTA.get(idRuta);
  if (!r) return [];
  return r.dias.filter(d => comoArray(d.lugares).includes(idLugar)).map(d => d.n);
}

/** [3] → 'D3' · [3,4,5] → 'D3-5' · [0,9,10,11] → 'D0·9-11'.
 *  Los días seguidos se comprimen en tramos: el sitio donde duermes al empezar y
 *  al acabar sale como «D0·9-11» y no como «D0·9·10·11», que no cabe en el icono. */
export function etiquetaDias(ns) {
  if (!ns || !ns.length) return null;
  const tramos = [];
  for (const n of ns) {
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && n === ultimo[1] + 1) ultimo[1] = n;
    else tramos.push([n, n]);
  }
  return 'D' + tramos.map(([a, b]) => (a === b ? a : `${a}-${b}`)).join('·');
}

/** Aviso por consola si un lugar dice ser de una ruta que no lo visita, o al revés.
 *  Son dos listas escritas a mano y es justo donde se descuadran. */
function comprobarLugares() {
  RUTAS.rutas.forEach(r => {
    const enDias = new Set(r.dias.flatMap(d => comoArray(d.lugares)));
    const suyos = LUGARES.lugares.filter(l => l.rutas.includes(r.id)).map(l => l.id);
    suyos.filter(id => !enDias.has(id))
      .forEach(id => console.warn(`[${r.id}] "${id}" dice ser de esta ruta pero ningún día lo visita`));
    [...enDias].filter(id => !suyos.includes(id))
      .forEach(id => console.warn(`[${r.id}] un día visita "${id}", que no consta en esta ruta`));
  });
}

/** En cuántas rutas sale un lugar, traducido a la marca que se pinta en los menús:
 *  lo que ves siempre, lo que depende de la ruta y lo que solo tiene una.
 *  Es la respuesta a «¿qué gano y qué pierdo eligiendo esta?». */
export function exclusividadDe(l) {
  const total = RUTAS.rutas.length;
  const n = l.rutas.length;
  // Los sitios que solo existen como desvío al mezclar rutas no están en ninguna,
  // así que no se les puede aplicar la escala normal.
  if (!n) {
    return { clave: 'algunas', ...LUGARES.exclusividad.algunas,
             nombre: 'Solo como desvío', corto: 'Desvío',
             cuantas: 0, total, ruta: null };
  }
  const clave = n >= total ? 'todas' : n === 1 ? 'solo' : 'algunas';
  const base = LUGARES.exclusividad[clave];
  // Si es de una sola ruta, la marca se pinta del color de esa ruta: así se ve
  // de un vistazo a cuál pertenece sin leer nada.
  const suya = clave === 'solo' ? RUTA.get(l.rutas[0]) : null;
  return { clave, ...base, color: suya ? suya.color : base.color, ruta: suya, cuantas: n, total };
}

/** Cuenta de lugares propios de una ruta: los que no salen en todas. */
export function propiosDe(idRuta) {
  return LUGARES.lugares.filter(l => l.rutas.includes(idRuta) && l.rutas.length < RUTAS.rutas.length);
}

/** Lugares exclusivos de una ruta: si no la coges, no los ves. */
export function exclusivosDe(idRuta) {
  return LUGARES.lugares.filter(l => l.rutas.length === 1 && l.rutas[0] === idRuta);
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
