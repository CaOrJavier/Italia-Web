// Descarga bajo demanda de las teselas del mapa, para que funcione sin cobertura.
// Nunca se descarga sola: siempre la pide el usuario desde Ajustes.

export const CACHE_TILES = 'italia2026-tiles-v1';
export const URL_TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const KB_POR_TESELA = 18; // media real de las teselas raster de OSM

// Ciudades donde se anda a pie, y por tanto hace falta detalle (zoom alto).
export const CIUDADES = [
  { nombre: 'Roma',         lat: 41.8986, lon: 12.4769, radio: 4.0 },
  { nombre: 'Siena',        lat: 43.3180, lon: 11.3300, radio: 1.6 },
  { nombre: 'Florencia',    lat: 43.7731, lon: 11.2560, radio: 2.6 },
  { nombre: 'Lucca',        lat: 43.8447, lon: 10.5060, radio: 1.6 },
  { nombre: 'Pisa',         lat: 43.7230, lon: 10.3966, radio: 1.8 },
  { nombre: 'Cinque Terre', lat: 44.1230, lon:  9.7050, radio: 5.0 },
  { nombre: 'Bolonia',      lat: 44.4938, lon: 11.3426, radio: 2.2 },
  { nombre: 'Venecia',      lat: 45.4341, lon: 12.3388, radio: 3.0 },
  { nombre: 'Rávena',       lat: 44.4208, lon: 12.1969, radio: 1.8 },
  { nombre: 'Asís',         lat: 43.0748, lon: 12.6053, radio: 1.6 }
];

const aX = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
const aY = (lat, z) => {
  const r = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z);
};

const url = (z, x, y) => URL_TILE.replace('{z}', z).replace('{x}', x).replace('{y}', y);

/** Interpola puntos intermedios para que el corredor no deje huecos. */
function densificar(polilinea, pasos = 24) {
  const pts = [];
  for (let i = 1; i < polilinea.length; i++) {
    const [aLat, aLon] = polilinea[i - 1];
    const [bLat, bLon] = polilinea[i];
    for (let k = 0; k < pasos; k++) {
      pts.push([aLat + (bLat - aLat) * k / pasos, aLon + (bLon - aLon) * k / pasos]);
    }
  }
  pts.push(polilinea[polilinea.length - 1]);
  return pts;
}

/**
 * Conjunto de URLs a descargar.
 * @param {number[][]} polilinea  ruta del viaje
 * @param {{ruta:[number,number], ciudad:[number,number], margen:number}} opciones
 */
export function listaTeselas(polilinea, { ruta = [8, 12], ciudad = [13, 15], margen = 1 } = {}) {
  const urls = new Set();
  const puntos = densificar(polilinea);

  for (let z = ruta[0]; z <= ruta[1]; z++) {
    for (const [lat, lon] of puntos) {
      const cx = aX(lon, z), cy = aY(lat, z);
      for (let dx = -margen; dx <= margen; dx++) {
        for (let dy = -margen; dy <= margen; dy++) urls.add(url(z, cx + dx, cy + dy));
      }
    }
  }

  for (let z = ciudad[0]; z <= ciudad[1]; z++) {
    for (const c of CIUDADES) {
      const dLat = c.radio / 111;
      const dLon = c.radio / (111 * Math.cos(c.lat * Math.PI / 180));
      const x1 = aX(c.lon - dLon, z), x2 = aX(c.lon + dLon, z);
      const y1 = aY(c.lat + dLat, z), y2 = aY(c.lat - dLat, z);
      for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) urls.add(url(z, x, y));
    }
  }

  return [...urls];
}

export const estimarMB = (n) => Math.round(n * KB_POR_TESELA / 1024);

/** Cuántas de esas teselas ya están guardadas. */
export async function yaDescargadas(urls) {
  if (!('caches' in window)) return 0;
  const cache = await caches.open(CACHE_TILES);
  const claves = new Set((await cache.keys()).map(r => r.url));
  return urls.filter(u => claves.has(u)).length;
}

/**
 * Descarga y guarda las teselas. Va despacio a propósito: las teselas de
 * OpenStreetMap son un servicio donado y su política pide no hacer descargas
 * masivas agresivas.
 */
export async function descargar(urls, { alProgreso, senal, concurrencia = 3 } = {}) {
  if (!('caches' in window)) throw new Error('Este navegador no permite guardar mapas offline.');
  const cache = await caches.open(CACHE_TILES);
  const existentes = new Set((await cache.keys()).map(r => r.url));
  const pendientes = urls.filter(u => !existentes.has(u));

  let hechas = 0, fallos = 0;
  const total = pendientes.length;
  let i = 0;

  async function obrero() {
    while (i < total) {
      if (senal?.abortada) return;
      const u = pendientes[i++];
      try {
        const res = await fetch(u, { mode: 'cors', credentials: 'omit' });
        if (res.ok) await cache.put(u, res.clone());
        else fallos++;
      } catch {
        fallos++;
      }
      hechas++;
      if (hechas % 5 === 0 || hechas === total) alProgreso?.({ hechas, total, fallos });
      await new Promise(r => setTimeout(r, 12));
    }
  }

  alProgreso?.({ hechas: 0, total, fallos: 0 });
  await Promise.all(Array.from({ length: concurrencia }, obrero));
  return { hechas, total, fallos, cancelado: !!senal?.abortada };
}

export async function resumenCache() {
  if (!('caches' in window)) return { n: 0, mb: 0 };
  const cache = await caches.open(CACHE_TILES);
  const n = (await cache.keys()).length;
  return { n, mb: estimarMB(n) };
}

export async function borrarCache() {
  if ('caches' in window) await caches.delete(CACHE_TILES);
}
