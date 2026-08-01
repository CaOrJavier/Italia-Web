// Las tres rutas sobre el mapa, superpuestas y con interruptor.
// Leaflet pesa 145 KB y solo hace falta aquí: se carga la primera vez que se abre
// esta pantalla, no en el arranque de la web.

import * as datos from '../datos.js';
import { imagenSuelta } from '../fotos.js';
import { esc } from '../util.js';

const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const SRI_JS = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
const SRI_CSS = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
const TESELAS = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

// Cada ruta con su patrón de trazo además de su color: en un mapa impreso en gris,
// o para quien no distingue el verde del rojo, siguen siendo tres líneas distintas.
const TRAZO = { toscana: null, mar: '9 7', comer: '2 7' };

let cargando = null;

function cargarLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (cargando) return cargando;

  cargando = new Promise((ok, mal) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = LEAFLET_CSS;
      css.integrity = SRI_CSS;
      css.crossOrigin = '';
      document.head.append(css);
    }
    const s = document.createElement('script');
    s.src = LEAFLET_JS;
    s.integrity = SRI_JS;
    s.crossOrigin = '';
    s.onload = () => ok(window.L);
    s.onerror = () => mal(new Error('No se ha podido cargar Leaflet. ¿Estás sin conexión?'));
    document.head.append(s);
  });
  return cargando;
}

export async function pintar(main) {
  const rutas = datos.RUTAS.rutas;
  const tipos = datos.LUGARES.tipos;

  main.innerHTML = `
    <p class="intro">Las tres rutas a la vez. Apaga y enciende cada una para ver en qué se
    separan: comparten todo el tramo de Roma a Cinque Terre y se distinguen en los extremos.</p>

    <div class="filtros" id="f-rutas" role="group" aria-label="Rutas">
      ${rutas.map(r => `<button type="button" data-r="${esc(r.id)}" aria-pressed="true"
        style="--c:${esc(r.color)}"><span class="raya"></span>${r.numero}. ${esc(r.nombre)}</button>`).join('')}
    </div>

    <div class="mapa-caja"><div id="mapa" role="application" aria-label="Mapa de las tres rutas"></div></div>

    <div class="filtros" id="f-tipos" role="group" aria-label="Tipos de lugar">
      ${Object.entries(tipos).map(([id, t]) => `<button type="button" data-t="${esc(id)}"
        aria-pressed="true" style="--c:${esc(t.color)}"><span class="punto"></span>${esc(t.nombre)}</button>`).join('')}
    </div>

    <p class="peq">Teselas de OpenStreetMap. Las coordenadas de los aparcamientos son
    aproximadas: en el navegador del coche, busca el nombre del aparcamiento, no el punto.</p>
  `;

  let L;
  try {
    L = await cargarLeaflet();
  } catch (e) {
    document.getElementById('mapa').innerHTML =
      `<div class="caja caja-mal" style="margin:14px">${esc(e.message)}</div>`;
    return;
  }

  const mapa = L.map('mapa', { scrollWheelZoom: false, attributionControl: true });
  L.tileLayer(TESELAS, {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(mapa);
  mapa.on('click', () => mapa.scrollWheelZoom.enable());

  // Sin cobertura las teselas fallan pero los trazados y los puntos se siguen viendo:
  // el mapa sigue sirviendo aunque el fondo se quede liso.
  let fallos = 0, alguna = false;
  mapa.on('tileload', () => { alguna = true; });
  mapa.on('tileerror', () => {
    if (alguna || ++fallos < 4 || document.querySelector('.sin-tiles')) return;
    const av = document.createElement('div');
    av.className = 'sin-tiles';
    av.textContent = 'No se cargan las teselas del mapa (sin conexión). Los trazados y los puntos sí funcionan.';
    document.querySelector('.mapa-caja').append(av);
  });

  // Trazados
  const lineas = new Map();
  rutas.forEach(r => {
    const linea = L.polyline(r.trazado.map(p => [p[0], p[1]]), {
      color: r.color,
      weight: 4,
      opacity: 0.85,
      dashArray: TRAZO[r.id] || null,
      lineJoin: 'round'
    }).bindPopup(`<b>${esc(r.numero)}. ${esc(r.nombre)}</b>
      <span class="peq">${esc(r.lema)} · ${r.km} km</span>`);
    linea.addTo(mapa);
    lineas.set(r.id, linea);
  });

  // Puntos
  const capaPuntos = L.layerGroup().addTo(mapa);
  const puntos = datos.LUGARES.lugares.map(l => {
    const t = datos.LUGARES.tipos[l.tipo];
    const marca = L.marker([l.lat, l.lon], {
      title: l.nombre,
      icon: L.divIcon({
        className: '',
        html: `<span class="pin" style="--c:${esc(t.color)}">${esc(t.icono)}</span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        popupAnchor: [0, -12]
      })
    });
    const enRutas = l.rutas.map(id => datos.RUTA.get(id)).filter(Boolean);
    marca.bindPopup(`
      ${imagenSuelta(l.id)}
      <b>${esc(l.nombre)}</b>
      <span class="peq">${esc(t.nombre)}${l.precio ? ' · ' + esc(l.precio) : ''}</span>
      <p style="margin:6px 0 0">${esc(l.nota)}</p>
      <span class="peq">Ruta ${enRutas.map(r => r.numero).join(', ')}${l.aprox ? ' · coordenadas aproximadas' : ''}</span>`,
      { minWidth: 240, maxWidth: 280 });
    return { lugar: l, marca };
  });

  const activas = new Set(rutas.map(r => r.id));
  const activos = new Set(Object.keys(datos.LUGARES.tipos));

  function refrescar() {
    rutas.forEach(r => {
      const linea = lineas.get(r.id);
      if (activas.has(r.id)) linea.addTo(mapa);
      else linea.remove();
    });
    capaPuntos.clearLayers();
    puntos.forEach(({ lugar, marca }) => {
      const visible = activos.has(lugar.tipo) && lugar.rutas.some(id => activas.has(id));
      if (visible) capaPuntos.addLayer(marca);
    });
  }

  main.querySelector('#f-rutas').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    // Que no se puedan apagar las tres a la vez: un mapa vacío no informa de nada.
    if (activas.has(b.dataset.r) && activas.size === 1) return;
    activas.has(b.dataset.r) ? activas.delete(b.dataset.r) : activas.add(b.dataset.r);
    b.setAttribute('aria-pressed', String(activas.has(b.dataset.r)));
    refrescar();
  });

  main.querySelector('#f-tipos').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    activos.has(b.dataset.t) ? activos.delete(b.dataset.t) : activos.add(b.dataset.t);
    b.setAttribute('aria-pressed', String(activos.has(b.dataset.t)));
    refrescar();
  });

  refrescar();
  mapa.fitBounds(L.latLngBounds(rutas.flatMap(r => r.trazado.map(p => [p[0], p[1]]))), { padding: [24, 24] });

  // El contenedor se mide mal si la pantalla se pinta mientras aún está encajando.
  setTimeout(() => mapa.invalidateSize(), 60);

  return () => mapa.remove();
}
