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
// 3. Con una sola ruta encendida, cada punto lleva escrito el día en que se pisa
//    (D0 a D11). Un mapa de puntos no dice por dónde se empieza ni cuándo estás
//    en cada sitio; con el día encima se lee de un vistazo. El color sigue
//    diciendo qué es cada punto, así que no se pierde nada. Con las cuatro rutas
//    a la vez no se ponen: cada una tiene su propio calendario y serían cuatro
//    numeraciones distintas sobre el mismo sitio.
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

// Los iconos no miden todos lo mismo: un círculo son 24 px y una pastilla con
// «D0·9-11» dentro son 74. Con un radio fijo hay que usar el del más ancho, y
// entonces se fusionan cosas que cabían de sobra. Así que se agrupa por si los
// dos iconos se solaparían de verdad, midiendo cada uno por su etiqueta.
const SEPARACION_MINIMA = 30;   // primer barrido, para juntar lo que casi coincide
const ALTO_ICONO = 28;

const anchoIcono = et => (et ? Math.max(34, 18 + et.length * 8) : 30);

/** Índice del vértice del trazado más cercano a unas coordenadas. Se compara por
 *  cuadrados de la diferencia: no hace falta la distancia real, solo cuál gana. */
function vertice(trazado, lat, lon) {
  let mejor = 0, min = Infinity;
  trazado.forEach((p, i) => {
    const d = (p[0] - lat) ** 2 + (p[1] - lon) ** 2;
    if (d < min) { min = d; mejor = i; }
  });
  return mejor;
}

const plano = (a, b) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * 0.74);

/** El punto que parte un camino en dos mitades de igual longitud. Ahí es donde se
 *  pone la etiqueta de kilómetros, para que caiga encima de la línea y no al lado. */
function mitad(puntos) {
  const acum = [0];
  for (let i = 1; i < puntos.length; i++) acum.push(acum[i - 1] + plano(puntos[i - 1], puntos[i]));
  const total = acum[acum.length - 1];
  if (!total) return puntos[0];
  const i = acum.findIndex(a => a >= total / 2);
  const t = (total / 2 - acum[i - 1]) / (acum[i] - acum[i - 1]);
  return [puntos[i - 1][0] + (puntos[i][0] - puntos[i - 1][0]) * t,
          puntos[i - 1][1] + (puntos[i][1] - puntos[i - 1][1]) * t];
}

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
    <p class="intro">Una ruta cada vez, que es como se lee. Cada icono lleva el día en que
    estás ahí: <b>D0</b> es el desembarco y <b>D11</b> el día del ferri de vuelta.
    <b>D3-4</b> quiere decir que pasas dos días seguidos, y la chapita negra dice cuántos
    sitios hay debajo: pínchala y el mapa se acerca hasta separarlos. Los kilómetros van
    sobre la línea, en mitad del tramo que se hace ese día.</p>

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
  const capaKm = L.layerGroup().addTo(mapa);
  const capaPuntos = L.layerGroup().addTo(mapa);

  /** La ruta única encendida, o null si hay varias. Es lo que permite poner días. */
  const rutaUnica = () => (activas.size === 1 ? [...activas][0] : null);

  /** Rutas encendidas. Empieza con una sola: es lo que hace el mapa legible. */
  let activas = new Set([inicial]);
  const activos = new Set(Object.keys(tipos));

  // ── Trazados ────────────────────────────────────────────────────────────

  function pintarLineas() {
    capaLineas.clearLayers();
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

    pintarKm();
  }

  /** Los kilómetros de cada día, puestos encima del tramo que se recorre ese día.
   *  Van en la línea y no junto al punto porque son de lo que hay entre dos sitios:
   *  «150 km» pegado a Siena no dice si es para llegar o para salir. */
  function pintarKm() {
    capaKm.clearLayers();
    const id = rutaUnica();
    if (!id) return;                       // con varias rutas, cada una tiene los suyos
    const r = datos.RUTA.get(id);

    // Se colocan de mayor a menor: si dos etiquetas chocan, gana la del día largo,
    // que es la que más informa.
    const puestas = [];
    for (const { dia, camino } of tramos(r).sort((a, b) => b.dia.km - a.dia.km)) {
      const centro = mitad(camino);
      const p = mapa.latLngToLayerPoint(centro);
      const ancho = 22 + String(dia.km).length * 8;
      const choca = puestas.some(q =>
        Math.abs(q.p.x - p.x) < (q.ancho + ancho) / 2 && Math.abs(q.p.y - p.y) < 20);
      if (choca) continue;
      puestas.push({ p, ancho });

      L.marker(centro, {
        interactive: false,
        zIndexOffset: -200,                // por debajo de los puntos
        icon: L.divIcon({
          className: '',
          html: `<span class="km" style="--c:${esc(r.color)}">${dia.km} km</span>`,
          iconSize: [ancho, 18], iconAnchor: [ancho / 2, 9]
        })
      }).addTo(capaKm);
    }
  }

  /** Un tramo por día: el trozo de trazado que se recorre ese día. Los extremos se
   *  buscan por el sitio donde se duerme, no por el nombre, que no siempre casa. */
  function tramos(r) {
    const t = r.trazado;
    const puerto = datos.lugar('civitavecchia');
    const salida = [];
    let desde = vertice(t, puerto.lat, puerto.lon);

    r.dias.forEach(dia => {
      const cama = datos.camaDe(dia) || puerto;
      const hasta = vertice(t, cama.lat, cama.lon);
      let camino = null;

      if (hasta > desde) {
        camino = t.slice(desde, hasta + 1).map(p => [p[0], p[1]]);
      } else {
        // Día de ida y vuelta (duermes donde dormiste): el recorrido no avanza por
        // el trazado, así que se toma del sitio más lejano que se pisa ese día.
        const base = [t[hasta][0], t[hasta][1]];
        const lejos = datos.lugaresDeDia(dia)
          .map(l => [l, plano(base, [l.lat, l.lon])])
          .sort((a, b) => b[1] - a[1])[0];
        if (lejos && lejos[1] > 0) camino = [base, [lejos[0].lat, lejos[0].lon]];
      }

      if (camino && camino.length > 1) salida.push({ dia, camino });
      desde = hasta;
    });
    return salida;
  }

  // ── Puntos, agrupados ───────────────────────────────────────────────────

  function visibles() {
    return datos.LUGARES.lugares.filter(l =>
      activos.has(l.tipo) && l.rutas.some(id => activas.has(id)));
  }

  /** Centro en píxeles de un montón de lugares. Es donde se dibuja el icono, así
   *  que es también el punto contra el que hay que medir distancias. */
  function centro(items) {
    const ps = items.map(l => mapa.latLngToLayerPoint([l.lat, l.lon]));
    return ps.reduce((a, b) => a.add(b)).divideBy(ps.length);
  }

  /** La etiqueta que llevará el icono de un montón de lugares: el día, o nada. */
  function etiquetaDe(items) {
    const dias = [...new Set(items.flatMap(diasDe))].sort((a, b) => a - b);
    return datos.etiquetaDias(dias);
  }

  /** Junta en un grupo los lugares cuyos iconos se pisarían a este zoom. */
  function agrupar(lista) {
    const grupos = [];

    // Primer barrido: juntar lo que prácticamente coincide.
    for (const l of lista) {
      const p = mapa.latLngToLayerPoint([l.lat, l.lon]);
      const cerca = grupos.find(g => g.p.distanceTo(p) < SEPARACION_MINIMA);
      if (cerca) { cerca.items.push(l); cerca.p = centro(cerca.items); }
      else grupos.push({ p, items: [l] });
    }

    // Segundo barrido: fusionar solo los que de verdad se pisarían, midiendo cada
    // icono por su propia etiqueta. Así dos pastillas cortas pueden quedarse a
    // 40 px sin molestarse, y solo se juntan las que se taparían.
    const ancho = g => anchoIcono(g.items.length > 1 || rutaUnica() ? etiquetaDe(g.items) : null);
    for (let toco = true; toco; ) {
      toco = false;
      salir:
      for (let i = 0; i < grupos.length; i++) {
        for (let j = i + 1; j < grupos.length; j++) {
          const dx = Math.abs(grupos[i].p.x - grupos[j].p.x);
          const dy = Math.abs(grupos[i].p.y - grupos[j].p.y);
          if (dx >= (ancho(grupos[i]) + ancho(grupos[j])) / 2 || dy >= ALTO_ICONO) continue;
          grupos[i].items.push(...grupos[j].items);
          grupos[i].p = centro(grupos[i].items);
          grupos.splice(j, 1);
          toco = true;
          break salir;
        }
      }
    }
    return grupos;
  }

  function pintarPuntos() {
    capaPuntos.clearLayers();
    for (const g of agrupar(visibles())) {
      if (g.items.length === 1) capaPuntos.addLayer(pinSuelto(g.items[0]));
      else capaPuntos.addLayer(pinGrupo(g));
    }
  }

  /** Los días de un lugar en la ruta que esté sola encendida. */
  function diasDe(l) {
    const r = rutaUnica();
    return r ? datos.diasDeLugar(r, l.id) : [];
  }

  function pinSuelto(l) {
    const t = datos.LUGARES.tipos[l.tipo];
    const e = datos.exclusividadDe(l);
    const enRutas = l.rutas.map(id => datos.RUTA.get(id)).filter(Boolean);
    const dias = diasDe(l);
    const et = datos.etiquetaDias(dias);
    // Con día, el icono es una pastilla con el día escrito; sin él (varias rutas
    // encendidas), vuelve al símbolo del tipo.
    const cuerpo = et
      ? `<span class="pin pin-dia pin-${e.clave}" style="--c:${esc(t.color)};--m:${esc(e.color)}">${esc(et)}</span>`
      : `<span class="pin pin-${e.clave}" style="--c:${esc(t.color)};--m:${esc(e.color)}">${esc(t.icono)}</span>`;
    const ancho = anchoIcono(et);

    return L.marker([l.lat, l.lon], {
      title: et ? `${et} · ${l.nombre}` : l.nombre,
      icon: L.divIcon({
        className: '', html: cuerpo,
        iconSize: [ancho, 24], iconAnchor: [ancho / 2, 12], popupAnchor: [0, -13]
      })
    }).bindPopup(`
      ${imagenSuelta(l.id)}
      <b>${esc(l.nombre)}</b>
      <span class="peq">${esc(t.nombre)}${l.precio ? ' · ' + esc(l.precio) : ''}</span>
      ${dias.length ? `<span class="peq"><b>${esc(textoDias(dias))}</b></span>` : ''}
      <p style="margin:6px 0 0">${esc(l.nota)}</p>
      ${marca(l, { largo: true })}
      <span class="peq">Ruta ${enRutas.map(r => r.numero).join(', ')}${l.aprox ? ' · coordenadas aproximadas' : ''}</span>`,
      { minWidth: 240, maxWidth: 280 });
  }

  function pinGrupo(g) {
    const items = g.items;
    // El icono va exactamente en el punto que se ha usado para agrupar, para que
    // lo que se mide y lo que se ve sean lo mismo.
    const donde = mapa.layerPointToLatLng(g.p);
    const solos = items.filter(l => datos.exclusividadDe(l).clave === 'solo').length;
    // El día manda sobre la cuenta: en un grupo que es una ciudad, saber que son
    // los días 9 a 11 dice más que saber que hay nueve puntos dentro.
    const dias = [...new Set(items.flatMap(diasDe))].sort((a, b) => a - b);
    const et = etiquetaDe(items);
    const ancho = anchoIcono(et);

    const m = L.marker(donde, {
      title: (et ? `${et}\n` : '') + items.map(l => l.nombre).join('\n'),
      zIndexOffset: 200,
      icon: L.divIcon({
        className: '',
        html: `<span class="grupo${solos ? ' grupo-solo' : ''}${et ? ' grupo-dia' : ''}"
                 >${esc(et || items.length)}<i>${items.length}</i></span>`,
        iconSize: [ancho, 30], iconAnchor: [ancho / 2, 15]
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

  // Grupos y etiquetas de km se reparten según el zoom: al acercarse, lo que
  // estaba montado se separa y cabe más.
  mapa.on('zoomend', () => { pintarPuntos(); pintarKm(); });

  refrescar({ encuadrar: true });
  setTimeout(() => mapa.invalidateSize(), 60);

  return () => mapa.remove();
}

/** 'Día 3' · 'Días 3 y 4' · 'Días 9, 10 y 11'. Para el globo, donde cabe entero. */
function textoDias(ns) {
  if (ns.length === 1) return `Día ${ns[0]} del viaje`;
  const lista = ns.slice(0, -1).join(', ') + ' y ' + ns[ns.length - 1];
  return `Días ${lista} del viaje`;
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
