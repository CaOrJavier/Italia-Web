// Mapa Leaflet, en dos modos:
//   · Puntos    — los 77 lugares con filtros por día y categoría (parte del
//                 mapa de referencia que ya funcionaba: mismos divIcon).
//   · Trayecto  — resumen del anillo completo: km, tiempo de volante, salida
//                 y llegada, y las 12 etapas navegables.

import { esc, avisar, num, duracion, fechaLarga } from '../util.js';
import * as datos from '../datos.js';
import * as estado from '../estado.js';
import { abrirHoja, hojaNavegar, ir } from '../ui.js';
import { URL_TILE } from '../tiles.js';

let cargandoLeaflet = null;

/** Leaflet pesa 145 KB: se carga sólo cuando se abre el mapa. */
function cargarLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (cargandoLeaflet) return cargandoLeaflet;
  cargandoLeaflet = new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = 'vendor/leaflet.js';
    s.onload = () => ok(window.L);
    s.onerror = () => mal(new Error('No se pudo cargar Leaflet'));
    document.head.append(s);
  });
  return cargandoLeaflet;
}

/** Rampa de 12 colores, de terracota a turquesa, para ver el avance del anillo. */
/** Del rosso pompeiano al verde acqua: la misma familia que el resto de la app. */
export const colorDia = (n) => `hsl(${10 + n * 15}, 55%, 40%)`;

/** Un color por ruta alternativa, los mismos de la tabla comparativa. */
const COLOR_RUTA = { termas: '#3d6b2f', 'roma-mar': '#2a6ba3', norte: '#96601a' };
const COLOR_PLAN = '#8c8f96';

export function vistaMapa(raiz, params) {
  const pedido = params.get('vista');
  const modo = pedido === 'trayecto' ? 'trayecto' : pedido === 'rutas' ? 'rutas' : 'puntos';

  raiz.innerHTML = `
    <div class="sub-nav">
      <button class="chip" data-modo="puntos"   aria-pressed="${modo === 'puntos'}">Puntos</button>
      <button class="chip" data-modo="trayecto" aria-pressed="${modo === 'trayecto'}">Trayecto</button>
      ${datos.ALTERNATIVAS ? `<button class="chip" data-modo="rutas" aria-pressed="${modo === 'rutas'}">Las 3 rutas</button>` : ''}
    </div>
    <div id="cuerpo-mapa"></div>`;

  raiz.querySelector('.sub-nav').addEventListener('click', ev => {
    const b = ev.target.closest('[data-modo]');
    if (!b) return;
    ir(b.dataset.modo === 'puntos' ? '#/mapa' : `#/mapa?vista=${b.dataset.modo}`);
  });

  const caja = raiz.querySelector('#cuerpo-mapa');
  if (modo === 'trayecto') return modoTrayecto(caja);
  if (modo === 'rutas') return modoRutas(caja, params);
  return modoPuntos(caja, params);
}

// ============================================================
//  Modo Rutas — las tres alternativas dibujadas y comparables
// ============================================================

function modoRutas(raiz, params) {
  const opciones = datos.ALTERNATIVAS.opciones.filter(o => o.trazado?.length);
  const plan = datos.ALTERNATIVAS.opciones.find(o => o.descartada);
  const pedido = params.get('r');
  let sel = opciones.some(o => o.id === pedido) || pedido === 'plan' ? pedido : 'todas';

  raiz.innerHTML = `
    <div class="filtros" id="f-rutas">
      <button class="chip" data-ruta="todas" aria-pressed="${sel === 'todas'}">Las tres</button>
      ${opciones.map(o => `
        <button class="chip" data-ruta="${esc(o.id)}" aria-pressed="${sel === o.id}">
          <span class="bolita" style="background:${COLOR_RUTA[o.id]}"></span>${esc(o.letra)} · ${esc(o.nombre)}
        </button>`).join('')}
      <button class="chip" data-ruta="plan" aria-pressed="${sel === 'plan'}">
        <span class="bolita" style="background:${COLOR_PLAN}"></span>Con Venecia ✕
      </button>
    </div>

    <div class="mapa-caja" style="margin-top:10px">
      <div id="mapa"></div>
      <div class="sin-tiles" id="sin-tiles" hidden>
        Sin mapa de fondo (no hay cobertura ni teselas guardadas). Los trazados siguen aquí.
      </div>
    </div>
    <p class="suave" style="font-size:13px;margin-top:8px">
      Trazados esquemáticos: unen las paradas en orden, no son la carretera exacta. Toca un punto para ver cuál es.
    </p>
    <div id="ficha-ruta"></div>`;

  const aviso = raiz.querySelector('#sin-tiles');
  const fichas = raiz.querySelector('#ficha-ruta');
  let mapa = null, capas = new Map();

  cargarLeaflet().then(L => {
    if (!raiz.isConnected) return;
    mapa = L.map('mapa', { zoomControl: true, tap: false }).setView([43.4, 11.6], 7);

    const teselas = L.tileLayer(URL_TILE, { maxZoom: 17, minZoom: 5, crossOrigin: true, attribution: '&copy; OpenStreetMap' }).addTo(mapa);
    let ok = 0, fallos = 0;
    teselas.on('tileload', () => { ok++; aviso.hidden = true; });
    teselas.on('tileerror', () => { if (++fallos > 4 && ok === 0) aviso.hidden = false; });

    // El plan descartado, de fondo y a trazos: se ve de un vistazo cuánto se sube al Véneto.
    capas.set('plan', capaRuta(L, datos.VIAJE.ruta_polilinea.map(([la, lo]) => [la, lo, '']), COLOR_PLAN, true));
    for (const o of opciones) capas.set(o.id, capaRuta(L, o.trazado, COLOR_RUTA[o.id], false));

    pintar();
    setTimeout(() => mapa.invalidateSize(), 60);
  }).catch(e => {
    raiz.querySelector('#mapa').innerHTML = `<div class="vacio">No se pudo cargar el mapa.<br><small>${esc(e.message)}</small></div>`;
  });

  /** Una capa por ruta: funda blanca, trazo de color y un punto por parada. */
  function capaRuta(L, puntos, color, discontinua) {
    const grupo = L.layerGroup();
    const coords = puntos.map(p => [p[0], p[1]]);
    if (!discontinua) L.polyline(coords, { color: '#fff', weight: 8, opacity: .7, interactive: false }).addTo(grupo);
    L.polyline(coords, {
      color, weight: discontinua ? 3 : 4.5, opacity: .95, lineCap: 'round', lineJoin: 'round',
      dashArray: discontinua ? '2 8' : null, interactive: false
    }).addTo(grupo);
    for (const [la, lo, nombre] of puntos) {
      if (!nombre) continue;
      const clave = /SATURNIA/.test(nombre);
      L.circleMarker([la, lo], {
        radius: clave ? 8 : 5.5, color: '#fff', weight: 2,
        fillColor: clave ? '#a63a28' : color, fillOpacity: 1
      }).bindTooltip(nombre, { direction: 'top' }).addTo(grupo);
    }
    return grupo;
  }

  function pintar() {
    if (!mapa) return;
    const L = window.L;
    for (const [id, capa] of capas) {
      const visible = sel === 'todas' ? id !== 'plan' : sel === id;
      if (visible) capa.addTo(mapa); else capa.remove();
    }
    raiz.querySelectorAll('#f-rutas .chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.ruta === sel)));

    const activas = [...capas.entries()].filter(([id]) => sel === 'todas' ? id !== 'plan' : sel === id);
    const puntos = activas.flatMap(([, capa]) => capa.getLayers().flatMap(l => l.getLatLngs?.() ?? [l.getLatLng()]));
    if (puntos.length) mapa.fitBounds(L.latLngBounds(puntos), { padding: [24, 24] });

    fichas.innerHTML = ficha();
  }

  function ficha() {
    if (sel === 'todas') {
      return `<div class="tarjeta">
        <div class="seccion-tit" style="margin:0 0 8px">Las tres, encima del mapa</div>
        ${opciones.map(o => `
          <div class="ruta-fila">
            <span class="ruta-color" style="background:${COLOR_RUTA[o.id]}"></span>
            <span class="crece">
              <b>${esc(o.letra)} · ${esc(o.nombre)}</b>
              <span class="suave">${esc(o.apodo)}</span>
            </span>
            <span class="mono">${num(o.km)} km</span>
          </div>`).join('')}
        <div class="ruta-fila">
          <span class="ruta-color" style="background:${COLOR_PLAN}"></span>
          <span class="crece"><b style="text-decoration:line-through">Con Venecia</b><span class="suave">descartada · sube 300 km al noreste</span></span>
          <span class="mono">${num(plan.km)} km</span>
        </div>
        <p class="suave" style="font-size:13.5px;margin-top:10px">
          Toca una ruta arriba para verla sola, con sus paradas.
        </p>
      </div>`;
    }
    const o = sel === 'plan' ? plan : opciones.find(x => x.id === sel);
    return `<div class="tarjeta" style="border-color:${sel === 'plan' ? COLOR_PLAN : COLOR_RUTA[o.id]}">
      <div class="fila fila-sep" style="align-items:flex-start">
        <div class="crece">
          <div style="font-weight:800;font-size:18px">${esc(o.letra)} · ${esc(o.nombre)}</div>
          <div class="suave" style="font-size:14.5px">${esc(o.apodo)}</div>
        </div>
        <div class="ruta-cifras"><b>${num(o.km)}</b><span>km</span><em>${esc(o.coste)}</em></div>
      </div>
      <div class="envuelve" style="margin-top:10px">
        <span class="etiq">${esc(o.volante)} de volante</span>
        ${o.recomendada ? '<span class="etiq etiq-ok">recomendada</span>' : ''}
        ${o.descartada ? '<span class="etiq etiq-peligro">descartada</span>' : ''}
      </div>
      ${o.trazado ? `<p class="suave" style="font-size:14.5px;margin-top:10px">
        ${o.trazado.filter(p => p[2]).map(p => esc(p[2])).join(' → ')}
      </p>` : ''}
      <a class="btn btn-pri btn-blq" href="#/alternativas" style="margin-top:11px">Ver esta ruta día a día</a>
    </div>`;
  }

  raiz.querySelector('#f-rutas').addEventListener('click', ev => {
    const b = ev.target.closest('[data-ruta]');
    if (!b) return;
    sel = b.dataset.ruta;
    pintar();
  });

  return () => { mapa?.remove(); mapa = null; };
}

// ============================================================
//  Modo Trayecto — el resumen del viaje entero
// ============================================================

function modoTrayecto(raiz) {
  const dias = datos.dias();
  const t = datos.totalesRuta();
  const meta = datos.VIAJE.meta;
  const maxKm = Math.max(...dias.map(d => d.km));
  let acumulado = 0;

  raiz.innerHTML = `
    <div class="tarjeta">
      <div class="hito">
        <span class="hito-punto hito-salida"></span>
        <div class="crece">
          <div class="hito-rot">Salida</div>
          <div class="hito-sitio">${esc(meta.llegada.puerto)}</div>
          <div class="suave" style="font-size:14.5px">${esc(fechaLarga(meta.llegada.fecha))} · ${esc(meta.llegada.hora)} · ${esc(meta.llegada.medio)}</div>
        </div>
      </div>

      <div class="hito-tramo">
        <div class="hito-cifras">
          <div><b>${num(meta.km_totales)}</b><span>km</span></div>
          <div><b>${meta.horas_conduccion}</b><span>h de volante</span></div>
          <div><b>${dias.length}</b><span>días</span></div>
          <div><b>${meta.noches}</b><span>noches</span></div>
        </div>
      </div>

      <div class="hito">
        <span class="hito-punto hito-llegada"></span>
        <div class="crece">
          <div class="hito-rot">Llegada</div>
          <div class="hito-sitio">${esc(meta.salida.puerto)}</div>
          <div class="suave" style="font-size:14.5px">${esc(fechaLarga(meta.salida.fecha))} · ferri a las ${esc(meta.salida.hora)}</div>
          <div class="etiq etiq-alerta" style="margin-top:5px">En el puerto a las ${esc(meta.salida.estar_en_puerto)}</div>
        </div>
      </div>
      <p class="suave" style="font-size:13.5px;margin-top:12px">
        Anillo cerrado: se sale y se vuelve a ${esc(meta.llegada.puerto)} sin repetir tramo.
      </p>
    </div>

    <div class="mapa-caja">
      <div id="mapa"></div>
      <div class="sin-tiles" id="sin-tiles" hidden>
        Sin mapa de fondo (no hay cobertura ni teselas guardadas). La ruta y las etapas siguen aquí.
      </div>
    </div>
    <div class="envuelve" style="margin-top:10px">
      <button class="btn btn-peq" id="b-todo">Ver el anillo entero</button>
      <span class="etiq" id="sel">Toca una etapa para verla</span>
    </div>

    <div class="seccion-tit">Las 12 etapas</div>
    <div class="tarjeta">
      ${dias.map(d => {
        acumulado += d.km;
        const peor = datos.tramoMasLargo(d.dia);
        const duro = peor && peor.minutos > datos.LIMITE_SEGUIDO;
        return `<button class="etapa" data-etapa="${d.dia}">
          <span class="etapa-color" style="background:${colorDia(d.dia)}"></span>
          <span class="crece">
            <span class="etapa-cab">
              <b>${esc(d.etiqueta)}</b>
              <span class="suave">${esc(d.fecha.slice(8))} ago</span>
            </span>
            <span class="etapa-ruta">${esc(d.etapa)}</span>
            <span class="etapa-barra"><i style="width:${d.km / maxKm * 100}%;background:${colorDia(d.dia)}"></i></span>
            ${peor ? `<span class="etapa-tiron ${duro ? 'largo' : ''}">
              tirón más largo ${esc(duracion(peor.minutos))}${duro ? ' — pártelo' : ''}
            </span>` : ''}
          </span>
          <span class="etapa-cifras">
            <b class="mono">${num(d.km)} km</b>
            <span class="mono suave">${duracion(d.minutos_conduccion)}</span>
            <span class="mono suave" style="font-size:12px">${num(acumulado)} acum.</span>
          </span>
        </button>`;
      }).join('')}
      <div class="etapa-total">
        <span class="crece">Suma de las 12 etapas</span>
        <b class="mono">${num(t.km)} km</b>
        <b class="mono">${duracion(t.minutos)}</b>
      </div>
      <p class="suave" style="font-size:13px;margin-top:9px">
        El viaje se cuenta como <b>${num(meta.km_totales)} km</b>: las etapas suman ${num(t.km)} y el resto
        es el trajín dentro de las ciudades y el margen de desvíos.
      </p>
    </div>`;

  const aviso = raiz.querySelector('#sin-tiles');
  let mapa = null, lineas = new Map(), etiquetas = new Map(), seleccionado = null;

  cargarLeaflet().then(L => {
    if (!raiz.isConnected) return;
    mapa = L.map('mapa', { zoomControl: true, tap: false }).setView([43.4, 11.6], 7);

    const teselas = L.tileLayer(URL_TILE, {
      maxZoom: 17, minZoom: 5, crossOrigin: true, attribution: '&copy; OpenStreetMap'
    }).addTo(mapa);
    let ok = 0, fallos = 0;
    teselas.on('tileload', () => { ok++; aviso.hidden = true; });
    teselas.on('tileerror', () => { if (++fallos > 4 && ok === 0) aviso.hidden = false; });

    // Un trazo por día, con funda blanca para que se lea sobre el mapa.
    for (const tramo of datos.tramosPorDia()) {
      if (tramo.puntos.length < 2) continue;
      L.polyline(tramo.puntos, { color: '#fff', weight: 8, opacity: .75, lineCap: 'round', interactive: false }).addTo(mapa);
      const linea = L.polyline(tramo.puntos, {
        color: colorDia(tramo.dia), weight: 4.5, opacity: .95, lineCap: 'round', lineJoin: 'round'
      }).addTo(mapa);
      linea.on('click', () => seleccionar(tramo.dia));
      lineas.set(tramo.dia, linea);

      // Etiqueta del día al final de su tramo: donde se duerme.
      const fin = tramo.puntos[tramo.puntos.length - 1];
      const marca = L.marker(fin, {
        icon: L.divIcon({
          className: '',
          html: `<div class="pin-caja"><span class="marca-dia" style="background:${colorDia(tramo.dia)}">${esc(datos.dia(tramo.dia).etiqueta)}</span></div>`,
          iconSize: [44, 44], iconAnchor: [22, 22]
        }),
        title: datos.dia(tramo.dia).titulo,
        zIndexOffset: 200
      }).addTo(mapa);
      marca.on('click', () => seleccionar(tramo.dia));
      etiquetas.set(tramo.dia, marca);
    }

    // Salida y llegada son el mismo puerto: un solo hito, marcado como tal.
    const puerto = datos.VIAJE.ruta_polilinea[0];
    L.marker(puerto, {
      icon: L.divIcon({
        className: '',
        html: '<div class="pin-caja"><span class="marca-puerto">⇄</span></div>',
        iconSize: [46, 46], iconAnchor: [23, 23]
      }),
      title: 'Civitavecchia · salida y llegada',
      zIndexOffset: 400
    }).addTo(mapa).on('click', () => {
      abrirHoja('Civitavecchia', `
        <p><b>Salida.</b> ${esc(fechaLarga(datos.VIAJE.meta.llegada.fecha))} a las ${esc(datos.VIAJE.meta.llegada.hora)}, llegada del ferri con el coche.</p>
        <p><b>Llegada.</b> ${esc(fechaLarga(datos.VIAJE.meta.salida.fecha))}, ferri a las ${esc(datos.VIAJE.meta.salida.hora)};
        hay que estar en el puerto a las <b>${esc(datos.VIAJE.meta.salida.estar_en_puerto)}</b>.</p>
        <button class="btn btn-pri btn-blq" id="ir-puerto" style="margin-top:12px">Navegar al puerto</button>`)
        .querySelector('#ir-puerto').addEventListener('click', () => hojaNavegar(puerto[0], puerto[1], 'Puerto de Civitavecchia'));
    });

    todoElAnillo();
    setTimeout(() => mapa.invalidateSize(), 60);
  }).catch(e => {
    raiz.querySelector('#mapa').innerHTML = `<div class="vacio">No se pudo cargar el mapa.<br><small>${esc(e.message)}</small></div>`;
  });

  function todoElAnillo() {
    seleccionado = null;
    for (const [dia, l] of lineas) l.setStyle({ opacity: .95, weight: 4.5, color: colorDia(dia) });
    raiz.querySelectorAll('[data-etapa]').forEach(b => b.setAttribute('aria-pressed', 'false'));
    raiz.querySelector('#sel').textContent = 'Toca una etapa para verla';
    const todos = [...lineas.values()].flatMap(l => l.getLatLngs());
    if (mapa && todos.length) mapa.fitBounds(window.L.latLngBounds(todos), { padding: [24, 24] });
  }

  function seleccionar(n) {
    if (!mapa) return;
    if (seleccionado === n) return todoElAnillo();
    seleccionado = n;
    for (const [dia, l] of lineas) {
      const activo = dia === n;
      l.setStyle({ opacity: activo ? 1 : .28, weight: activo ? 7 : 3, color: colorDia(dia) });
      if (activo) l.bringToFront();
    }
    const d = datos.dia(n);
    raiz.querySelectorAll('[data-etapa]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.etapa) === n)));
    raiz.querySelector('#sel').textContent = `${d.etiqueta}: ${num(d.km)} km · ${duracion(d.minutos_conduccion)}`;
    mapa.fitBounds(lineas.get(n).getBounds(), { padding: [34, 34] });
    raiz.querySelector('.mapa-caja').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  raiz.querySelector('#b-todo').addEventListener('click', todoElAnillo);
  raiz.addEventListener('click', ev => {
    const b = ev.target.closest('[data-etapa]');
    if (b) seleccionar(Number(b.dataset.etapa));
  });
  raiz.addEventListener('dblclick', ev => {
    const b = ev.target.closest('[data-etapa]');
    if (b) ir(`#/ruta?dia=${b.dataset.etapa}`);
  });

  return () => { mapa?.remove(); mapa = null; };
}

// ============================================================
//  Modo Puntos — los 77 lugares
// ============================================================

function modoPuntos(raiz, params) {
  const filtros = { dia: params.get('dia') ?? 'todos', cats: new Set(Object.keys(datos.VIAJE.categorias)) };
  const lugarPedido = params.get('lugar') !== null ? Number(params.get('lugar')) : null;
  let colorearPor = params.get('color') === 'prioridad' ? 'prioridad' : 'categoria';

  raiz.innerHTML = `
    <div class="filtros" id="f-color">
      <span class="suave" style="align-self:center;font-size:13px;font-weight:700;white-space:nowrap">Color:</span>
      <button class="chip" data-color="categoria" aria-pressed="${colorearPor === 'categoria'}">Categoría</button>
      <button class="chip" data-color="prioridad" aria-pressed="${colorearPor === 'prioridad'}">Prioridad</button>
    </div>
    <div class="filtros" id="f-dias">
      <button class="chip" data-dia="todos" aria-pressed="true">Todo el viaje</button>
      ${datos.dias().map(d => `<button class="chip" data-dia="${d.dia}" aria-pressed="false">${esc(d.etiqueta)}</button>`).join('')}
    </div>
    <div class="filtros" id="f-cats">
      ${Object.entries(datos.VIAJE.categorias).map(([k, v]) => `
        <button class="chip" data-cat="${k}" aria-pressed="true">
          <span class="bolita" style="background:${v.color}"></span>${esc(v.nombre)}
        </button>`).join('')}
    </div>
    <div class="mapa-caja" style="margin-top:10px">
      <div id="mapa"></div>
      <div class="sin-tiles" id="sin-tiles" hidden>
        Sin mapa de fondo (no hay cobertura ni teselas guardadas). Los puntos y la ruta siguen aquí.
        Puedes descargar los mapas desde <b>Ajustes</b>.
      </div>
    </div>
    <div class="envuelve" style="margin-top:10px">
      <button class="btn btn-peq" id="b-cerca">Qué tengo cerca</button>
      <button class="btn btn-peq" id="b-ruta">Ver toda la ruta</button>
      <span class="etiq" id="cuenta"></span>
    </div>
    <div class="envuelve" id="leyenda" style="margin-top:10px"></div>
    <p class="suave" style="font-size:13.5px;margin-top:10px">
      Los puntos con borde discontinuo tienen <b>coordenadas aproximadas</b> (aparcamientos):
      guíate por la dirección escrita, no por el pin.
    </p>`;

  const aviso = raiz.querySelector('#sin-tiles');
  let mapa = null, capaPuntos = null, capaRuta = null, marcadorYo = null;

  cargarLeaflet().then(L => {
    if (!raiz.isConnected) return;

    mapa = L.map('mapa', { zoomControl: true, attributionControl: true, tap: false })
            .setView([43.4, 11.6], 7);

    const teselas = L.tileLayer(URL_TILE, {
      maxZoom: 17, minZoom: 5, crossOrigin: true,
      attribution: '&copy; OpenStreetMap'
    }).addTo(mapa);

    // Sin fondo no se deja la pantalla en blanco: se avisa y se siguen viendo los puntos.
    let ok = 0, fallos = 0;
    teselas.on('tileload', () => { ok++; aviso.hidden = true; });
    teselas.on('tileerror', () => { if (++fallos > 4 && ok === 0) aviso.hidden = false; });

    capaRuta = L.polyline(datos.VIAJE.ruta_polilinea, {
      color: '#8c2f22', weight: 3.5, opacity: .65, dashArray: '1 7', lineCap: 'round'
    }).addTo(mapa);

    capaPuntos = L.layerGroup().addTo(mapa);
    pintarPuntos();

    if (lugarPedido !== null) {
      const l = datos.LUGAR.get(lugarPedido);
      if (l) { mapa.setView([l.lat, l.lon], 15); fichaLugar(l); }
    } else {
      mapa.fitBounds(capaRuta.getBounds(), { padding: [22, 22] });
    }

    setTimeout(() => mapa.invalidateSize(), 60);
  }).catch(e => {
    raiz.querySelector('#mapa').innerHTML =
      `<div class="vacio">No se pudo cargar el mapa.<br><small>${esc(e.message)}</small></div>`;
  });

  function visibles() {
    const extra = estado.obtener().lugares_extra;
    return [...datos.VIAJE.lugares, ...extra].filter(l =>
      (filtros.dia === 'todos' || Number(l.dia) === Number(filtros.dia)) &&
      filtros.cats.has(l.categoria) &&
      Number.isFinite(l.lat)
    );
  }

  function pintarPuntos() {
    if (!capaPuntos) return;
    const L = window.L;
    capaPuntos.clearLayers();
    const lista = visibles();
    raiz.querySelector('#cuenta').textContent = `${lista.length} punto${lista.length === 1 ? '' : 's'}`;

    for (const l of lista) {
      const color = colorearPor === 'prioridad' ? datos.colorPrioridad(l) : datos.categoria(l.categoria).color;
      // El pin se ve de 26 px, pero la zona pulsable es de 44: con el móvil al
      // sol y una sola mano, acertar en 26 px es imposible.
      const icono = L.divIcon({
        className: '',
        html: `<div class="pin-caja"><div class="pin ${l.coords_aproximadas ? 'aprox' : ''}" style="background:${color}"><b>${l.dia}</b></div></div>`,
        iconSize: [44, 44], iconAnchor: [22, 35], popupAnchor: [0, -32]
      });
      L.marker([l.lat, l.lon], { icon: icono, title: l.nombre })
        .on('click', () => fichaLugar(l))
        .addTo(capaPuntos);
    }
    pintarLeyenda(lista);
  }

  function pintarLeyenda(lista) {
    const caja = raiz.querySelector('#leyenda');
    if (colorearPor !== 'prioridad') { caja.innerHTML = ''; return; }
    caja.innerHTML = datos.CICLO_PRIORIDAD.map(k => {
      const n = lista.filter(l => datos.prioridadDe(l) === k).length;
      return n ? `<span class="etiq" style="background:${datos.PRIORIDADES[k].color};color:#fff">${esc(datos.PRIORIDADES[k].corto)} · ${n}</span>` : '';
    }).join('');
  }

  raiz.querySelector('#f-color').addEventListener('click', ev => {
    const b = ev.target.closest('[data-color]');
    if (!b) return;
    colorearPor = b.dataset.color;
    raiz.querySelectorAll('#f-color .chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    pintarPuntos();
  });

  raiz.querySelector('#f-dias').addEventListener('click', ev => {
    const b = ev.target.closest('[data-dia]');
    if (!b) return;
    filtros.dia = b.dataset.dia;
    raiz.querySelectorAll('#f-dias .chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    pintarPuntos();
    if (filtros.dia !== 'todos' && mapa) {
      const pts = visibles().map(l => [l.lat, l.lon]);
      if (pts.length) mapa.fitBounds(window.L.latLngBounds(pts), { padding: [34, 34], maxZoom: 14 });
    }
  });

  raiz.querySelector('#f-cats').addEventListener('click', ev => {
    const b = ev.target.closest('[data-cat]');
    if (!b) return;
    const k = b.dataset.cat;
    if (filtros.cats.has(k)) filtros.cats.delete(k); else filtros.cats.add(k);
    b.setAttribute('aria-pressed', String(filtros.cats.has(k)));
    pintarPuntos();
  });

  raiz.querySelector('#b-ruta').addEventListener('click', () => {
    if (mapa && capaRuta) mapa.fitBounds(capaRuta.getBounds(), { padding: [22, 22] });
  });

  // Cerca de mí: una sola lectura de GPS, nunca continua (la batería es escasa).
  raiz.querySelector('#b-cerca').addEventListener('click', (ev) => {
    if (!navigator.geolocation) return avisar('Este móvil no da la posición');
    const boton = ev.currentTarget;
    boton.disabled = true;
    boton.textContent = 'Buscando…';
    navigator.geolocation.getCurrentPosition(
      pos => {
        boton.disabled = false;
        boton.textContent = 'Qué tengo cerca';
        const { latitude: la, longitude: lo } = pos.coords;
        if (mapa) {
          const L = window.L;
          marcadorYo?.remove();
          marcadorYo = L.circleMarker([la, lo], { radius: 8, color: '#fff', weight: 3, fillColor: '#24507f', fillOpacity: 1 }).addTo(mapa);
          mapa.setView([la, lo], 12);
        }
        listaCercanos(la, lo);
      },
      err => {
        boton.disabled = false;
        boton.textContent = 'Qué tengo cerca';
        avisar(err.code === 1 ? 'Permiso de ubicación denegado' : 'No se pudo obtener la posición');
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 120000 }
    );
  });

  function listaCercanos(la, lo) {
    const cerca = datos.cercaDe(la, lo, 14);
    abrirHoja('Lo que tienes cerca', `
      <p class="suave">Distancia en línea recta desde donde estás.</p>
      ${cerca.map(({ lugar, dist }) => {
        const c = datos.categoria(lugar.categoria);
        return `<div class="item-lista">
          <span class="parada-punto" style="background:${c.color};margin-top:6px"></span>
          <div class="crece">
            <div style="font-weight:700">${esc(lugar.nombre)}</div>
            <div class="suave" style="font-size:14px">Día ${lugar.dia} · ${esc(c.nombre)}</div>
          </div>
          <b class="mono">${dist < 1 ? Math.round(dist * 1000) + ' m' : num(dist, 1) + ' km'}</b>
        </div>`;
      }).join('')}`);
  }

  function fichaLugar(l) {
    const c = datos.categoria(l.categoria);
    const s = estado.obtener();
    const hecha = !!s.paradas_hechas[l.id];
    const cuerpo = abrirHoja(l.nombre, `
      <div class="envuelve" style="margin-bottom:10px">
        <span class="etiq" style="background:${c.color};color:#fff">${esc(c.nombre)}</span>
        <span class="etiq">Día ${l.dia}</span>
        ${l.precio ? `<span class="etiq ${/gratis/i.test(l.precio) ? 'etiq-ok' : 'etiq-acento'}">${esc(l.precio)}</span>` : ''}
        ${hecha ? '<span class="etiq etiq-ok">Hecha</span>' : ''}
      </div>
      ${l.descripcion ? `<p>${esc(l.descripcion)}</p>` : ''}
      ${l.nota ? `<p><i>${esc(l.nota)}</i></p>` : ''}
      ${l.coords_aproximadas ? `<p class="etiq etiq-alerta" style="white-space:normal;line-height:1.45;padding:8px 11px">
        Coordenadas aproximadas. La buena es la dirección del texto: no metas el pin en el GPS sin comprobarlo.
      </p>` : ''}
      <p class="mono suave" style="margin-top:10px">${l.lat}, ${l.lon}</p>
      <button class="btn btn-pri btn-blq" data-ir style="margin-top:6px">Navegar</button>
      <button class="btn btn-blq" data-hecha style="margin-top:8px">${hecha ? 'Desmarcar' : 'Marcar como hecha'}</button>`);

    cuerpo.querySelector('[data-ir]').addEventListener('click', () => hojaNavegar(l.lat, l.lon, l.nombre));
    cuerpo.querySelector('[data-hecha]').addEventListener('click', (e) => {
      estado.alternar('paradas_hechas', l.id);
      e.currentTarget.textContent = estado.obtener().paradas_hechas[l.id] ? 'Desmarcar' : 'Marcar como hecha';
      avisar(estado.obtener().paradas_hechas[l.id] ? 'Marcada como hecha' : 'Desmarcada');
    });
  }

  return () => { mapa?.remove(); mapa = null; };
}
