// Las rutas sobre el mapa.
//
// Tres decisiones que vienen de que la primera versión era ilegible:
//
// 1. Los puntos se agrupan. Con los 54 sueltos había 97 pares solapados: en Roma,
//    ocho sitios caían a menos de cuatro píxeles unos de otros. Ahora, cuando dos
//    puntos se pisan, se dibuja un solo círculo con el número de sitios dentro, y
//    al pincharlo el mapa se acerca hasta separarlos.
// 2. Se ve una ruta cada vez. Las cuatro comparten casi todo el recorrido, así que
//    dibujadas a la vez son cuatro líneas encima de la misma carretera. Hay botón
//    para verlas todas, y entonces se pintan con grosores distintos para que los
//    tramos compartidos se lean como bandas concéntricas.
// 3. Con una sola ruta encendida salen los números de orden. Un mapa de puntos no
//    dice por dónde se empieza; numerado, se lee de un vistazo.
//
// Leaflet pesa 145 KB y solo hace falta aquí: se carga al abrir esta pantalla.

import * as datos from '../datos.js';
import { imagenSuelta } from '../fotos.js';
import { marca, leyenda } from '../marcas.js';
import { esc } from '../util.js';

const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const SRI_JS = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
const SRI_CSS = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
const TESELAS = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Distancia en píxeles por debajo de la cual dos puntos se juntan en uno. */
const RADIO_GRUPO = 40;

// Patrón de trazo además del color: en gris, o para quien no distingue el verde
// del rojo, siguen siendo cuatro líneas distintas.
const TRAZO = { toscana: null, agua: '10 7', comer: '2 8', etruria: '18 6 3 6' };

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

export async function pintar(main, params) {
  const rutas = datos.RUTAS.rutas;
  const tipos = datos.LUGARES.tipos;
  const inicial = datos.RUTA.has(params.get('r')) ? params.get('r') : rutas[0].id;

  main.innerHTML = `
    <p class="intro">Una ruta cada vez, que es como se lee. Los números son el orden de
    las paradas, y los círculos con cifra son varios sitios juntos: pínchalos y el mapa
    se acerca hasta separarlos.</p>

    <div class="filtros" id="f-rutas" role="group" aria-label="Ruta que se muestra">
      ${rutas.map(r => `<button type="button" data-r="${esc(r.id)}"
        aria-pressed="${r.id === inicial}" style="--c:${esc(r.color)}">
        <span class="raya"></span>${r.numero}. ${esc(r.nombre)}</button>`).join('')}
      <button type="button" data-r="todas" aria-pressed="false" style="--c:var(--tinta-2)">
        <span class="punto"></span>Las cuatro a la vez</button>
    </div>

    <div class="mapa-caja">
      <div id="mapa" role="application" aria-label="Mapa de las rutas"></div>
      <button type="button" id="agrandar" class="mapa-btn" aria-pressed="false">Agrandar</button>
    </div>

    <div class="filtros" id="f-tipos" role="group" aria-label="Tipos de lugar">
      ${Object.entries(tipos).map(([id, t]) => `<button type="button" data-t="${esc(id)}"
        aria-pressed="true" style="--c:${esc(t.color)}"><span class="punto"></span>${esc(t.nombre)}</button>`).join('')}
    </div>

    ${leyenda()}

    <p class="peq">Teselas de OpenStreetMap. Las coordenadas de los aparcamientos son
    aproximadas: en el navegador del coche busca el nombre del aparcamiento, no el punto.</p>
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

  // La vista se fija antes de dibujar nada: agrupar los puntos exige proyectar
  // coordenadas a píxeles, y sin centro ni zoom Leaflet todavía no sabe hacerlo.
  const TODO = rutas.flatMap(r => r.trazado.map(p => [p[0], p[1]]));
  mapa.fitBounds(L.latLngBounds(TODO), { padding: [26, 26] });

  avisarSinTeselas(mapa);

  const capaLineas = L.layerGroup().addTo(mapa);
  const capaOrden = L.layerGroup().addTo(mapa);
  const capaPuntos = L.layerGroup().addTo(mapa);

  /** Rutas encendidas. Empieza con una sola: es lo que hace el mapa legible. */
  let activas = new Set([inicial]);
  const activos = new Set(Object.keys(tipos));

  // ── Trazados ────────────────────────────────────────────────────────────

  function pintarLineas() {
    capaLineas.clearLayers();
    capaOrden.clearLayers();
    const enOrden = rutas.filter(r => activas.has(r.id));

    // Con varias encendidas, grosores decrecientes: donde coinciden se ven como
    // bandas concéntricas en vez de taparse unas a otras.
    const grueso = enOrden.length > 1;
    enOrden.forEach((r, i) => {
      L.polyline(r.trazado.map(p => [p[0], p[1]]), {
        color: r.color,
        weight: grueso ? 9 - i * 2 : 4,
        opacity: grueso ? 0.55 : 0.9,
        dashArray: TRAZO[r.id] || null,
        lineJoin: 'round'
      }).bindPopup(`<b>${r.numero}. ${esc(r.nombre)}</b>
        <span class="peq">${esc(r.lema)} · ${r.km} km</span>`).addTo(capaLineas);
    });

    // Los números de orden solo con una ruta: con cuatro serían cuatro numeraciones
    // distintas sobre la misma carretera y no se entendería ninguna.
    if (enOrden.length === 1) pintarOrden(enOrden[0]);
  }

  function pintarOrden(r) {
    r.trazado.forEach((p, i) => {
      L.marker([p[0], p[1]], {
        title: `${i + 1}. ${p[2]}`,
        zIndexOffset: 400,
        icon: L.divIcon({
          className: '',
          html: `<span class="orden" style="--c:${esc(r.color)}">${i + 1}</span>`,
          iconSize: [20, 20], iconAnchor: [10, 10]
        })
      }).bindPopup(`<b>${i + 1}. ${esc(p[2])}</b>
        <span class="peq">Parada ${i + 1} de ${r.trazado.length} · ruta ${r.numero}</span>`)
        .addTo(capaOrden);
    });
  }

  // ── Puntos, agrupados ───────────────────────────────────────────────────

  function visibles() {
    return datos.LUGARES.lugares.filter(l =>
      activos.has(l.tipo) && l.rutas.some(id => activas.has(id)));
  }

  /** Junta en un grupo los lugares que caen a menos de RADIO_GRUPO píxeles. */
  function agrupar(lista) {
    const grupos = [];
    for (const l of lista) {
      const p = mapa.latLngToLayerPoint([l.lat, l.lon]);
      const cerca = grupos.find(g => g.p.distanceTo(p) < RADIO_GRUPO);
      if (cerca) cerca.items.push(l);
      else grupos.push({ p, items: [l] });
    }
    return grupos;
  }

  function pintarPuntos() {
    capaPuntos.clearLayers();
    for (const g of agrupar(visibles())) {
      if (g.items.length === 1) capaPuntos.addLayer(pinSuelto(g.items[0]));
      else capaPuntos.addLayer(pinGrupo(g.items));
    }
  }

  function pinSuelto(l) {
    const t = datos.LUGARES.tipos[l.tipo];
    const e = datos.exclusividadDe(l);
    const enRutas = l.rutas.map(id => datos.RUTA.get(id)).filter(Boolean);
    return L.marker([l.lat, l.lon], {
      title: l.nombre,
      icon: L.divIcon({
        className: '',
        html: `<span class="pin pin-${e.clave}" style="--c:${esc(t.color)};--m:${esc(e.color)}"
                 >${esc(t.icono)}</span>`,
        iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -13]
      })
    }).bindPopup(`
      ${imagenSuelta(l.id)}
      <b>${esc(l.nombre)}</b>
      <span class="peq">${esc(t.nombre)}${l.precio ? ' · ' + esc(l.precio) : ''}</span>
      <p style="margin:6px 0 0">${esc(l.nota)}</p>
      ${marca(l, { largo: true })}
      <span class="peq">Ruta ${enRutas.map(r => r.numero).join(', ')}${l.aprox ? ' · coordenadas aproximadas' : ''}</span>`,
      { minWidth: 240, maxWidth: 280 });
  }

  function pinGrupo(items) {
    const centro = [
      items.reduce((s, l) => s + l.lat, 0) / items.length,
      items.reduce((s, l) => s + l.lon, 0) / items.length
    ];
    const solos = items.filter(l => datos.exclusividadDe(l).clave === 'solo').length;
    const m = L.marker(centro, {
      title: items.map(l => l.nombre).join('\n'),
      zIndexOffset: 200,
      icon: L.divIcon({
        className: '',
        html: `<span class="grupo${solos ? ' grupo-solo' : ''}">${items.length}</span>`,
        iconSize: [30, 30], iconAnchor: [15, 15]
      })
    });
    // Pinchar un grupo lo abre: acerca hasta que sus puntos se separan.
    m.on('click', () => {
      const b = L.latLngBounds(items.map(l => [l.lat, l.lon]));
      mapa.fitBounds(b.pad(0.4), { maxZoom: 15 });
    });
    return m;
  }

  // ── Interacción ─────────────────────────────────────────────────────────

  function refrescar({ encuadrar = false } = {}) {
    pintarLineas();
    // Primero encuadrar y luego agrupar: los grupos dependen del zoom, así que
    // calcularlos antes de mover la vista daría el reparto de la vista anterior.
    if (encuadrar) {
      const pts = rutas.filter(r => activas.has(r.id)).flatMap(r => r.trazado.map(p => [p[0], p[1]]));
      if (pts.length) mapa.fitBounds(L.latLngBounds(pts), { padding: [26, 26] });
    }
    pintarPuntos();
    main.querySelectorAll('#f-rutas button').forEach(b => {
      const activo = b.dataset.r === 'todas'
        ? activas.size === rutas.length
        : activas.has(b.dataset.r) && activas.size === 1;
      b.setAttribute('aria-pressed', String(activo));
    });
  }

  main.querySelector('#f-rutas').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    // Selección única: pinchar una ruta muestra esa y apaga las demás. Es lo que
    // hace que no se solapen cuatro líneas sobre la misma carretera.
    activas = b.dataset.r === 'todas' ? new Set(rutas.map(r => r.id)) : new Set([b.dataset.r]);
    refrescar({ encuadrar: true });
  });

  main.querySelector('#f-tipos').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    activos.has(b.dataset.t) ? activos.delete(b.dataset.t) : activos.add(b.dataset.t);
    b.setAttribute('aria-pressed', String(activos.has(b.dataset.t)));
    pintarPuntos();
  });

  const btn = main.querySelector('#agrandar');
  btn.addEventListener('click', () => {
    const grande = main.querySelector('.mapa-caja').classList.toggle('grande');
    btn.setAttribute('aria-pressed', String(grande));
    btn.textContent = grande ? 'Reducir' : 'Agrandar';
    setTimeout(() => mapa.invalidateSize(), 220);
  });

  // Los grupos dependen del zoom: al acercarse, los puntos se separan solos.
  mapa.on('zoomend', pintarPuntos);

  refrescar({ encuadrar: true });
  setTimeout(() => mapa.invalidateSize(), 60);

  return () => mapa.remove();
}

/** Sin cobertura las teselas fallan, pero trazados y puntos se siguen viendo. */
function avisarSinTeselas(mapa) {
  let fallos = 0, alguna = false;
  mapa.on('tileload', () => { alguna = true; });
  mapa.on('tileerror', () => {
    if (alguna || ++fallos < 4 || document.querySelector('.sin-tiles')) return;
    const av = document.createElement('div');
    av.className = 'sin-tiles';
    av.textContent = 'No se cargan las teselas del mapa (sin conexión). Los trazados y los puntos sí funcionan.';
    document.querySelector('.mapa-caja').append(av);
  });
}
