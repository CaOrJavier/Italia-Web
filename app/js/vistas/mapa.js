// La ruta sobre el mapa.
//
// Tres decisiones que vienen de que la primera versión era ilegible:
//
// 1. Los puntos se agrupan. Con los 54 sueltos había 97 pares solapados: en Roma,
//    ocho sitios caían a menos de cuatro píxeles unos de otros. Ahora, cuando dos
//    puntos se pisan, se dibuja un solo círculo con el número de sitios dentro, y
//    al pincharlo el mapa se acerca hasta separarlos.
// 2. Los sitios que solo se pisan cogiendo un desvío empiezan apagados. Son 18 y
//    encendidos taparían la ruta, que es lo que se viene a ver. El botón los
//    enciende para ver dónde caen los desvíos que lleva cada día.
// 3. Cada punto de la ruta lleva escrito el día en que se pisa (D0 a D11). Un
//    mapa de puntos no dice por dónde se empieza ni cuándo estás en cada sitio;
//    con el día encima se lee de un vistazo. El color sigue diciendo qué es cada
//    punto, así que no se pierde nada. Los desvíos no llevan día: dependen de si
//    los coges, y eso va escrito dentro de su día.
//
// Leaflet pesa 145 KB y solo hace falta aquí: se carga al abrir esta pantalla.

import * as datos from '../datos.js';
import { imagenSuelta } from '../fotos.js';
import { esc, minutosAHoras, numero, euros } from '../util.js';

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

/** El punto que está a una fracción dada de la longitud de un camino. La etiqueta
 *  de kilómetros va ahí, encima de la línea. Si el punto medio está ocupado por un
 *  icono se prueban otros: es preferible la cifra un poco descentrada a no verla. */
function puntoEn(puntos, fraccion) {
  const acum = [0];
  for (let i = 1; i < puntos.length; i++) acum.push(acum[i - 1] + plano(puntos[i - 1], puntos[i]));
  const total = acum[acum.length - 1];
  if (!total) return puntos[0];
  const objetivo = total * fraccion;
  const i = Math.max(1, acum.findIndex(a => a >= objetivo));
  const t = (objetivo - acum[i - 1]) / (acum[i] - acum[i - 1] || 1);
  return [puntos[i - 1][0] + (puntos[i][0] - puntos[i - 1][0]) * t,
          puntos[i - 1][1] + (puntos[i][1] - puntos[i - 1][1]) * t];
}

/** Por dónde se intenta colocar la etiqueta, en orden de preferencia. */
const FRACCIONES = [0.5, 0.35, 0.65, 0.22, 0.78];

// Patrón de trazo además del color: en gris, o para quien no distingue el verde
// del rojo, siguen siendo dos líneas distintas.

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
  const ruta = datos.RUTAS.rutas[0];
  const tipos = datos.LUGARES.tipos;
  // Los sitios que solo existen como desvío empiezan apagados: son 21 y taparían
  // la ruta, que es lo que se viene a ver.
  const inicial = params.get('d') === '1';

  main.innerHTML = `
    <p class="intro">Cada icono lleva el día en que estás ahí: <b>D0</b> es el desembarco y <b>D11</b> el día del ferri de vuelta.
    <b>D3-4</b> quiere decir que pasas dos días seguidos, y la chapita negra dice cuántos
    sitios hay debajo: pínchala y el mapa se acerca hasta separarlos. Los kilómetros van
    sobre la línea, en mitad del tramo que se hace ese día.</p>

    <div class="filtros" id="f-desvios" role="group" aria-label="Qué se muestra">
      <button type="button" data-d="0" aria-pressed="${!inicial}" style="--c:${esc(ruta.color)}">
        <span class="raya"></span>Solo la ruta</button>
      <button type="button" data-d="1" aria-pressed="${inicial}" style="--c:var(--ambar-txt)">
        <span class="punto"></span>Con los desvíos</button>
    </div>

    <div class="mapa-caja">
      <div id="mapa" role="application" aria-label="Mapa de la ruta"></div>
      <button type="button" id="agrandar" class="mapa-btn" aria-pressed="false">Agrandar</button>
    </div>

    <div class="filtros" id="f-tipos" role="group" aria-label="Tipos de lugar">
      ${Object.entries(tipos).map(([id, t]) => `<button type="button" data-t="${esc(id)}"
        aria-pressed="true" style="--c:${esc(t.color)}"><span class="punto"></span>${esc(t.nombre)}
        <b class="cuantos" data-cuenta="${esc(id)}"></b></button>`).join('')}
    </div>

    <div id="datos-mapa"></div>

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
  const TODO = datos.RUTAS.rutas[0].trazado.map(p => [p[0], p[1]]);
  mapa.fitBounds(L.latLngBounds(TODO), { padding: [26, 26] });

  avisarSinTeselas(mapa);

  const capaLineas = L.layerGroup().addTo(mapa);
  const capaKm = L.layerGroup().addTo(mapa);
  const capaPuntos = L.layerGroup().addTo(mapa);

  /** Si se pintan también los sitios que solo se pisan cogiendo un desvío. */
  let conDesvios = inicial;
  const activos = new Set(Object.keys(tipos));

  // ── Trazados ────────────────────────────────────────────────────────────

  function pintarLineas() {
    capaLineas.clearLayers();
    L.polyline(ruta.trazado.map(p => [p[0], p[1]]), {
      color: ruta.color, weight: 4, opacity: 0.9, lineJoin: 'round'
    }).bindPopup(`<b>${esc(ruta.nombre)}</b>
      <span class="peq">${esc(ruta.lema)} · ${ruta.km} km</span>`).addTo(capaLineas);
  }

  /** Dónde han quedado los iconos de los puntos. Las etiquetas de kilómetros los
   *  esquivan: si no, el pin del día se pinta encima y tapa media cifra. */
  let ocupados = [];

  /** Los kilómetros de cada día, puestos encima del tramo que se recorre ese día.
   *  Van en la línea y no junto al punto porque son de lo que hay entre dos sitios:
   *  «150 km» pegado a Siena no dice si es para llegar o para salir. */
  function pintarKm() {
    capaKm.clearLayers();
    const r = ruta;

    // Se colocan de mayor a menor: si dos etiquetas chocan, gana la del día largo,
    // que es la que más informa. Y se esquivan también los puntos ya dibujados.
    const puestas = [...ocupados];
    for (const { dia, camino } of tramos(r).sort((a, b) => b.dia.km - a.dia.km)) {
      const ancho = 22 + String(dia.km).length * 8;
      const libre = q => !puestas.some(o =>
        Math.abs(o.p.x - q.x) < (o.ancho + ancho) / 2 && Math.abs(o.p.y - q.y) < 22);

      let centro = null, p = null;
      for (const f of FRACCIONES) {
        const c = puntoEn(camino, f);
        const q = mapa.latLngToLayerPoint(c);
        if (libre(q)) { centro = c; p = q; break; }
      }
      if (!centro) continue;         // el tramo entero está ocupado: se deja para el zoom
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

      // Los días de 0 km son los de coche parado (Roma en metro o en tren): un
      // «0 km» encima de la línea no dice nada y estorba. Eso ya lo cuenta la
      // pastilla del día y el plan.
      if (dia.km && camino && camino.length > 1) salida.push({ dia, camino });
      desde = hasta;
    });
    return salida;
  }

  // ── Puntos, agrupados ───────────────────────────────────────────────────

  function visibles() {
    return datos.LUGARES.lugares.filter(l =>
      activos.has(l.tipo) && (l.rutas.length || conDesvios));
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
    const ancho = g => anchoIcono(etiquetaDe(g.items));
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
    ocupados = [];
    for (const g of agrupar(visibles())) {
      const et = etiquetaDe(g.items);
      ocupados.push({ p: g.p, ancho: anchoIcono(et) });
      if (g.items.length === 1) capaPuntos.addLayer(pinSuelto(g.items[0]));
      else capaPuntos.addLayer(pinGrupo(g));
    }
  }

  /** Los días en que se pisa un lugar. Los desvíos no tienen: dependen de si los
   *  coges, y eso va escrito dentro de su día. */
  const diasDe = l => datos.diasDeLugar(ruta.id, l.id);

  function pinSuelto(l) {
    const t = datos.LUGARES.tipos[l.tipo];
    const e = datos.exclusividadDe(l);
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
      <span class="peq"><b>${esc(e.nombre)}.</b> ${esc(e.explica)}${l.aprox ? ' Coordenadas aproximadas.' : ''}</span>`,
      { minWidth: 240, maxWidth: 280 });
  }

  function pinGrupo(g) {
    const items = g.items;
    // El icono va exactamente en el punto que se ha usado para agrupar, para que
    // lo que se mide y lo que se ve sean lo mismo.
    const donde = mapa.layerPointToLatLng(g.p);
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
        html: `<span class="grupo${et ? ' grupo-dia' : ''}"
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

  // ── Los números de lo que se está mirando ───────────────────────────────

  /** Cuenta de sitios por tipo, solo de las rutas encendidas. Va en los propios
   *  filtros: así el botón dice cuánto te vas a quitar antes de pulsarlo. */
  function contarPorTipo() {
    const cuenta = {};
    for (const l of datos.LUGARES.lugares) {
      if (!l.rutas.length && !conDesvios) continue;
      cuenta[l.tipo] = (cuenta[l.tipo] || 0) + 1;
    }
    main.querySelectorAll('[data-cuenta]').forEach(b => {
      const n = cuenta[b.dataset.cuenta] || 0;
      b.textContent = n || '';
      b.closest('button').disabled = n === 0;
    });
    return cuenta;
  }

  function pintarDatos() {
    const caja = main.querySelector('#datos-mapa');
    contarPorTipo();
    caja.innerHTML = datosDeUna(ruta);
  }

  function datosDeUna(r) {
    const suyos = datos.lugaresDe(r.id);
    const vistos = visibles();
    const desvios = datos.soloDesvio().length;
    const comb = datos.combustible(r);
    const apretados = datos.apretadosDe(r);
    const tpt = r.dias.reduce((t, d) => t + datos.minutosTransporte(d), 0);
    const nochesGratis = r.dias.filter(d => datos.camaDe(d) && datos.camaDe(d).precio === 0).length;
    const largo = datos.diaMasLargo(r);
    const porTipo = Object.entries(datos.LUGARES.tipos)
      .map(([tid, t]) => [t, suyos.filter(l => l.tipo === tid).length])
      .filter(([, n]) => n > 0);

    return `
      <div class="tarjeta" style="--barra:${esc(r.color)}">
        <div class="cab-tarjeta">
          <h3>${esc(r.nombre)}</h3>
          <span class="etiq etiq-gris">${esc(r.lema)}</span>
        </div>
        <div class="cifras">
          <div><b>${numero(r.km)}</b><span>kilómetros</span></div>
          <div><b>${minutosAHoras(r.minutos_volante)}</b><span>al volante</span></div>
          <div><b>${vistos.length}${vistos.length !== suyos.length ? `<small> de ${suyos.length}</small>` : ''}</b><span>sitios en el mapa</span></div>
          <div><b>${desvios}</b><span>sitios de desvío</span></div>
        </div>
        <div class="tarjeta-c">
          <div class="reparto">${porTipo.map(([t, n]) => `
            <span class="reparto-i" style="--c:${esc(t.color)}">
              <i>${esc(t.icono)}</i>${n} <small>${esc(t.nombre.toLowerCase())}</small></span>`).join('')}
          </div>
          <dl class="datos">
            <div><dt>Día más largo</dt><dd>D${largo.n} · ${largo.km} km <small>${esc(largo.titulo)}</small></dd></div>
            <div><dt>Días apretados</dt><dd>${apretados.length ? apretados.map(d => 'D' + d.n).join(', ') : 'ninguno'}</dd></div>
            <div><dt>Noches</dt><dd>${nochesGratis} gratis de ${r.dias.filter(d => d.dormir).length} <small>durmiendo en el coche</small></dd></div>
            <div><dt>Bases</dt><dd>${r.bases.length} sitios distintos <small>${r.bases.filter(b => b.noches > 1).length} con más de una noche</small></dd></div>
            <div><dt>Transporte público</dt><dd>${minutosAHoras(tpt)} <small>en total, ida y vuelta a los centros</small></dd></div>
            <div><dt>Combustible</dt><dd>${comb.litros} litros · ${euros(comb.euros)} <small>a ${String(datos.VIAJE.combustible.precio_litro_estimado).replace('.', ',')} €/l</small></dd></div>
            <div><dt>Gasto estimado</dt><dd>${euros(r.coste_estimado)} <small>${euros(Math.round(r.coste_estimado / 12))} al día</small></dd></div>
          </dl>
        </div>
      </div>`;
  }

  function refrescar({ encuadrar = false } = {}) {
    pintarLineas();
    // Primero encuadrar y luego agrupar: los grupos dependen del zoom, así que
    // calcularlos antes de mover la vista daría el reparto de la vista anterior.
    if (encuadrar) {
      const pts = ruta.trazado.map(p => [p[0], p[1]]);
      if (pts.length) mapa.fitBounds(L.latLngBounds(pts), { padding: [26, 26] });
    }
    // Los puntos primero y los kilómetros después: las etiquetas necesitan saber
    // dónde han quedado los iconos para no meterse debajo.
    pintarPuntos();
    pintarKm();
    pintarDatos();
    main.querySelectorAll('#f-desvios button').forEach(b =>
      b.setAttribute('aria-pressed', String((b.dataset.d === '1') === conDesvios)));
  }

  main.querySelector('#f-desvios').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    // Selección única: pinchar una ruta muestra esa y apaga las demás. Es lo que
    // hace que no se solapen dos líneas sobre la misma carretera.
    conDesvios = b.dataset.d === '1';
    refrescar({ encuadrar: true });
  });

  main.querySelector('#f-tipos').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    activos.has(b.dataset.t) ? activos.delete(b.dataset.t) : activos.add(b.dataset.t);
    b.setAttribute('aria-pressed', String(activos.has(b.dataset.t)));
    pintarPuntos();
    pintarKm();
    pintarDatos();
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
