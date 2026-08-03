// El árbol de habilidades: mezclar las rutas 1 y 2.
//
// Las dos rutas no son dos viajes distintos, son el mismo que se abre y se vuelve
// a cerrar tres veces: comprobado día a día, solo duermen en sitio distinto las
// noches del D2 y del D5. En cada bifurcación las dos ramas salen del mismo sitio
// y acaban en el mismo sitio, así que cualquier combinación cuadra sin tocar nada.
// Son 2×2×2 = 8 viajes posibles, más los desvíos.
//
// Se dibuja como un árbol de habilidades de videojuego: nodos en una columna, la
// línea que se parte en dos donde hay que elegir, el camino tomado encendido del
// color de su ruta y el otro apagado, y los desvíos como nodos menores colgando
// del que has elegido.
//
// Nada duplica datos: los días salen de rutas.json y arbol.json solo dice qué días
// forman cada rama.

import * as datos from '../datos.js';
import { esc, fechaCorta, fechaLarga, minutosAHoras, numero, euros } from '../util.js';
import { figura } from '../fotos.js';
import { ir } from '../app.js';

/** Día n de una ruta. Por su número, no por su posición. */
const dia = (idRuta, n) => datos.RUTA.get(idRuta).dias.find(d => d.n === n);
const bifurcaciones = () => datos.ARBOL.tramos.filter(t => t.tipo === 'bifurcacion');

function eleccion(params) {
  const sel = {};
  for (const b of bifurcaciones()) {
    const pedido = params.get(b.id);
    sel[b.id] = b.opciones.some(o => o.id === pedido) ? pedido : b.opciones[0].id;
  }
  return { sel, desvios: new Set((params.get('d') || '').split(',').filter(Boolean)) };
}

function componer(sel) {
  const dias = [];
  for (const t of datos.ARBOL.tramos) {
    const idRuta = t.tipo === 'tronco' ? t.ruta : t.opciones.find(o => o.id === sel[t.id]).ruta;
    for (const n of t.dias) dias.push({ ...dia(idRuta, n), _ruta: idRuta });
  }
  return dias.sort((a, b) => a.n - b.n);
}

const desviosPosibles = sel => datos.ARBOL.desvios.filter(d => sel[d.tramo] === d.opcion);

function total(dias, cogidos) {
  const t = dias.reduce((a, d) => ({ km: a.km + d.km, min: a.min + d.minutos, eur: a.eur + d.coste_dia }),
    { km: 0, min: 0, eur: 0 });
  for (const d of cogidos) { t.km += d.km; t.min += d.minutos; t.eur += d.coste || 0; }
  return t;
}

// ── Pintado ────────────────────────────────────────────────────────────────

export function pintar(main, params) {
  const { sel, desvios } = eleccion(params);
  const dias = componer(sel);
  const cogidos = desviosPosibles(sel).filter(d => desvios.has(d.id));
  const t = total(dias, cogidos);

  main.innerHTML = `
    <p class="intro">${esc(datos.ARBOL.intro)}</p>
    ${panel(t, sel, cogidos)}
    <p class="intro">${esc(datos.ARBOL.explica)}</p>

    <div class="arbol">
      ${datos.ARBOL.tramos.map((tr, i) =>
        (i ? enlace(tr, datos.ARBOL.tramos[i - 1], sel) : '') +
        (tr.tipo === 'tronco' ? nodoTronco(tr) : nodosRama(tr, sel, desvios))
      ).join('')}
    </div>

    ${detalles(sel, desvios)}
    ${sobras(dias, cogidos)}

    <h2 class="seccion">Tu viaje, día a día</h2>
    ${itinerario(dias, cogidos, t)}
  `;

  main.querySelectorAll('[data-elige]').forEach(b => b.addEventListener('click', () =>
    ir('mezclar', nuevaURL(sel, desvios, { rama: b.dataset.elige, opcion: b.dataset.opcion }))));
  main.querySelectorAll('[data-desvio]').forEach(b => b.addEventListener('click', () =>
    ir('mezclar', nuevaURL(sel, desvios, { desvio: b.dataset.desvio }))));
  const reset = main.querySelector('#reiniciar');
  if (reset) reset.addEventListener('click', () => ir('mezclar', new URLSearchParams()));
}

function nuevaURL(sel, desvios, cambio) {
  const s = { ...sel };
  const d = new Set(desvios);
  if (cambio.rama) {
    s[cambio.rama] = cambio.opcion;
    // Los desvíos cuelgan de una opción concreta: al cambiar de rama se caen solos.
    for (const x of datos.ARBOL.desvios)
      if (x.tramo === cambio.rama && x.opcion !== cambio.opcion) d.delete(x.id);
  }
  if (cambio.desvio) d.has(cambio.desvio) ? d.delete(cambio.desvio) : d.add(cambio.desvio);
  const q = new URLSearchParams(s);
  if (d.size) q.set('d', [...d].join(','));
  return q;
}

/** La barra de estado de arriba, estilo ficha de personaje. */
function panel(t, sel, cogidos) {
  const rutas = datos.ARBOL.rutas.map(id => datos.RUTA.get(id));
  const pura = cogidos.length ? null : rutas.find(r =>
    bifurcaciones().every(b => b.opciones.find(o => o.id === sel[b.id]).ruta === r.id));

  return `
  <div class="ficha-arbol">
    <div class="ficha-stats">
      <div><b>${numero(t.km)}</b><span>km</span></div>
      <div><b>${minutosAHoras(t.min)}</b><span>volante</span></div>
      <div><b>${euros(t.eur)}</b><span>coste</span></div>
      <div><b>${cogidos.length}<small>/${datos.ARBOL.desvios.length}</small></b><span>desvíos</span></div>
    </div>
    <div class="ficha-pie">
      ${pura
        ? `<span class="etiq etiq-verde">Esto es la ruta ${pura.numero} tal cual</span>`
        : '<span class="etiq etiq-ambar">Mezcla propia</span>'}
      <button type="button" id="reiniciar" class="etiq etiq-gris"
              style="cursor:pointer;min-height:32px;padding:7px 12px">Reiniciar</button>
    </div>
  </div>`;
}

/** El trozo de línea entre dos tramos: recta, que se abre, o que se cierra. */
function enlace(tr, anterior, sel) {
  const cerrar = anterior.tipo === 'bifurcacion';
  const abrir = tr.tipo === 'bifurcacion';
  const col = t => datos.RUTA.get(t.opciones.find(o => o.id === sel[t.id]).ruta).color;

  if (cerrar && abrir) {
    return linea('cierra', col(anterior), sel[anterior.id] === anterior.opciones[0].id)
         + linea('abre', col(tr), sel[tr.id] === tr.opciones[0].id);
  }
  if (cerrar) return linea('cierra', col(anterior), sel[anterior.id] === anterior.opciones[0].id);
  if (abrir) return linea('abre', col(tr), sel[tr.id] === tr.opciones[0].id);
  return linea('recta', 'var(--linea-2)', true);
}

/** Los tramos de línea van en SVG para que la Y se dibuje limpia y escale sola.
 *  vector-effect mantiene el grosor aunque el viewBox se estire. */
function linea(tipo, color, izquierda) {
  const g = 'vector-effect="non-scaling-stroke" fill="none" stroke-linecap="round"';
  if (tipo === 'recta') {
    return `<svg class="sk-linea" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
      <path ${g} class="sk-viva" style="stroke:${esc(color)}" d="M50 0 V26"/></svg>`;
  }
  // El 25 y el 75 no son a ojo: la rejilla de dos columnas sin hueco deja el centro
  // de cada nodo justo ahí, así que la Y cae exactamente sobre ellos a cualquier
  // ancho de pantalla.
  const d = tipo === 'abre'
    ? { tronco: 'M50 0 V9', izq: 'M50 9 H25 V26', der: 'M50 9 H75 V26' }
    : { tronco: 'M50 17 V26', izq: 'M25 0 V17 H50', der: 'M75 0 V17 H50' };
  return `<svg class="sk-linea" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
    <path ${g} class="sk-viva" style="stroke:${esc(color)}" d="${d.tronco}"/>
    <path ${g} class="${izquierda ? 'sk-viva' : 'sk-muerta'}" style="stroke:${izquierda ? esc(color) : ''}" d="${d.izq}"/>
    <path ${g} class="${izquierda ? 'sk-muerta' : 'sk-viva'}" style="stroke:${izquierda ? '' : esc(color)}" d="${d.der}"/>
  </svg>`;
}

function nodoTronco(tr) {
  const dias = tr.dias.map(n => dia(tr.ruta, n));
  const km = dias.reduce((a, d) => a + d.km, 0);
  return `
  <div class="sk-fila sk-fila-1">
    <div class="sk-nodo sk-tronco" title="${esc(tr.nota)}">
      <span class="sk-ico">${esc(tr.icono)}</span>
      <b>${esc(tr.corto)}</b>
      <span class="sk-dias">D${dias[0].n}${dias.length > 1 ? '-D' + dias[dias.length - 1].n : ''} · ${km} km</span>
      <span class="sk-fijo">fijo</span>
    </div>
  </div>`;
}

function nodosRama(tr, sel, desvios) {
  return `
  <div class="sk-fila sk-fila-2">
    ${tr.opciones.map(o => {
      const elegida = sel[tr.id] === o.id;
      const r = datos.RUTA.get(o.ruta);
      const dias = tr.dias.map(n => dia(o.ruta, n));
      const km = dias.reduce((a, d) => a + d.km, 0);
      const mis = datos.ARBOL.desvios.filter(d => d.tramo === tr.id && d.opcion === o.id);
      return `<div class="sk-col">
        <button type="button" class="sk-nodo sk-elige ${elegida ? 'sk-on' : 'sk-off'}"
                style="--barra:${esc(r.color)}" aria-pressed="${elegida}"
                data-elige="${esc(tr.id)}" data-opcion="${esc(o.id)}">
          <span class="sk-ico">${esc(o.icono)}</span>
          <b>${esc(o.corto)}</b>
          <span class="sk-dias">D${tr.dias[0]}-D${tr.dias[tr.dias.length - 1]} · ${km} km</span>
          <span class="sk-ruta">ruta ${r.numero}</span>
        </button>
        ${elegida && mis.length ? menores(mis, desvios, r.color) : ''}
      </div>`;
    }).join('')}
  </div>`;
}

/** Los desvíos, como nodos menores colgando del elegido. */
function menores(lista, desvios, color) {
  return `<div class="sk-menores" style="--barra:${esc(color)}">
    ${lista.map(d => {
      const puesto = desvios.has(d.id);
      return `<button type="button" class="sk-menor ${puesto ? 'sk-on' : ''}"
        data-desvio="${esc(d.id)}" aria-pressed="${puesto}"
        title="${esc(d.nombre)}: +${d.km} km, +${minutosAHoras(d.minutos)}">
        <span class="sk-ico">${esc(d.icono)}</span>
        <span class="sk-menor-t"><b>${esc(d.nombre)}</b><span>+${d.km} km</span></span>
      </button>`;
    }).join('')}
  </div>`;
}

/** Debajo del árbol, la letra pequeña de lo que has elegido. */
function detalles(sel, desvios) {
  return `
  <h2 class="seccion">Lo que has elegido</h2>
  ${bifurcaciones().map(tr => {
    const o = tr.opciones.find(x => x.id === sel[tr.id]);
    const otra = tr.opciones.find(x => x.id !== sel[tr.id]);
    const r = datos.RUTA.get(o.ruta);
    const dias = tr.dias.map(n => dia(o.ruta, n));
    const mis = datos.ARBOL.desvios.filter(d => d.tramo === tr.id && d.opcion === o.id);
    return `
    <div class="tarjeta" style="--barra:${esc(r.color)}">
      <div class="cab-tarjeta">
        <h3>${esc(o.icono)} ${esc(o.nombre)}</h3>
        <span class="etiq etiq-gris">en vez de «${esc(otra.corto)}»</span>
      </div>
      <div class="tarjeta-c">
        <p class="peq">${esc(tr.desde)}. <b>${esc(tr.hasta)}.</b></p>
        <p>${esc(o.resumen)}</p>
        <ul class="tronco-dias">${dias.map(d => `
          <li><b>D${d.n}</b> <span>${esc(fechaCorta(d.fecha))}</span> ${esc(d.etapa)}
            <em>${d.km} km</em></li>`).join('')}</ul>
        <div class="listas" style="margin-top:10px">
          <div><ul class="gana">${o.gana.map(x => `<li><span>${esc(x)}</span></li>`).join('')}</ul></div>
          <div><ul class="pierde">${o.pierde.map(x => `<li><span>${esc(x)}</span></li>`).join('')}</ul></div>
        </div>
      </div>
      ${mis.map(d => `<div class="plato">
        <div class="plato-t">
          <b>${esc(d.icono)} ${esc(d.nombre)}</b>
          <span class="etiq ${desvios.has(d.id) ? 'etiq-azul' : 'etiq-gris'}">
            ${desvios.has(d.id) ? 'añadido' : 'desvío'} · +${d.km} km · +${minutosAHoras(d.minutos)}${d.coste ? ' · +' + euros(d.coste) : ''}</span>
        </div>
        <p>${esc(d.que)}</p>
        ${figura(d.lugar, { alto: 120, pie: false }) || ''}
      </div>`).join('')}
    </div>`;
  }).join('')}`;
}

/** Lo que la combinación deja fuera y lo que repite, calculado y no escrito. */
function sobras(dias, cogidos) {
  const visitados = new Set(dias.flatMap(d => d.lugares || []));
  cogidos.forEach(d => visitados.add(d.lugar));

  const todo = new Set(datos.ARBOL.rutas.flatMap(id =>
    datos.RUTA.get(id).dias.flatMap(d => d.lugares || [])));
  datos.ARBOL.desvios.forEach(d => todo.add(d.lugar));

  const fuera = [...todo].filter(id => !visitados.has(id))
    .map(id => datos.lugar(id)).filter(l => l && l.tipo !== 'aparcar');

  const cuenta = {};
  dias.forEach(d => (d.lugares || []).forEach(id => { cuenta[id] = (cuenta[id] || 0) + 1; }));
  cogidos.forEach(d => { cuenta[d.lugar] = (cuenta[d.lugar] || 0) + 1; });
  const repes = Object.entries(cuenta).filter(([id, n]) => n > 1 && datos.lugar(id)).map(([id]) => datos.lugar(id))
    .filter(l => !['bracciano', 'la-spezia', 'villa-costanza', 'civitavecchia', 'saturnia'].includes(l.id));

  if (!fuera.length && !repes.length) return '';
  const corto = l => esc(l.nombre.split('·')[0].trim());
  return `
    <div class="caja caja-ojo" style="margin-top:14px">
      <b class="caja-t">Con esta combinación…</b>
      ${fuera.length ? `<p><b>Te dejas fuera:</b> ${fuera.map(corto).join(', ')}.
        Mira si alguno lo recuperas con un desvío.</p>` : ''}
      ${repes.length ? `<p><b>Repites:</b> ${repes.map(corto).join(', ')} en más de un día.
        No es un error, pero cuéntalo.</p>` : ''}
    </div>`;
}

/** La primera y la última hora del plan del día: a qué hora arrancas y a qué hora
 *  se acaba la jornada. Están en el propio plan, no hacen falta datos nuevos. */
function horas(d) {
  const validas = (d.plan || []).map(p => p.hora).filter(h => /^\d/.test(h));
  if (!validas.length) return null;
  return { salida: validas[0], llegada: validas[validas.length - 1] };
}

/** Todos los sitios del día, los de la ruta y los del desvío, con su tipo. */
function sitiosDelDia(d, extras) {
  const propios = datos.lugaresDeDia(d).map(l => ({ l, desvio: false }));
  const puestos = extras.map(x => datos.lugar(x.lugar)).filter(Boolean).map(l => ({ l, desvio: true }));
  const vistos = new Set();
  return [...propios, ...puestos].filter(({ l }) => !vistos.has(l.id) && vistos.add(l.id));
}

function itinerario(dias, cogidos, t) {
  const porDia = {};
  cogidos.forEach(d => (porDia[d.dia] = porDia[d.dia] || []).push(d));
  const noches = dias.filter(d => d.dormir).length;

  return `
  <div class="tarjeta">
    ${dias.map(d => {
      const cama = datos.camaDe(d);
      const extras = porDia[d.n] || [];
      const r = datos.RUTA.get(d._ruta);
      const km = d.km + extras.reduce((a, x) => a + x.km, 0);
      const min = d.minutos + extras.reduce((a, x) => a + x.minutos, 0);
      const h = horas(d);
      const sitios = sitiosDelDia(d, extras);
      const parkings = datos.parkingsDe(d);
      const tpt = datos.minutosTransporte(d);

      return `<details class="jornada" style="--barra:${esc(r.color)}">
        <summary>
          <span class="jor-n"><b>D${d.n}</b><span>de 11</span></span>
          <span class="jor-t">
            <b>${esc(d.titulo)}</b>
            <span class="jor-fecha">${esc(fechaLarga(d.fecha))}</span>
            <span class="jor-etapa">${esc(d.etapa)}${extras.length ? ' <b>+ ' + extras.map(x => esc(x.nombre)).join(' + ') + '</b>' : ''}</span>
          </span>
          <span class="jor-km">
            <b>${km} km</b>
            <small>${minutosAHoras(min)}</small>
            ${extras.length ? `<small class="jor-extra">+${extras.reduce((a, x) => a + x.km, 0)} desvío</small>` : ''}
          </span>
        </summary>

        <div class="jor-c">
          <div class="jor-reloj">
            ${h ? `<span><i>Salida</i><b>${esc(h.salida)}</b></span>
                   <span><i>Fin del día</i><b>${esc(h.llegada)}</b></span>` : ''}
            <span><i>Al volante</i><b>${minutosAHoras(min)}</b></span>
            ${tpt ? `<span><i>Transporte</i><b>${minutosAHoras(tpt)}</b></span>` : ''}
            <span><i>Duermes en</i><b>${cama ? esc(cama.nombre.split('·')[0].trim()) : 'el ferri'}</b></span>
          </div>

          ${sitios.length ? `<div class="jor-sitios">
            <b class="jor-tit">Los ${sitios.length} sitios de este día</b>
            <ul>${sitios.map(({ l, desvio }) => {
              const tp = datos.LUGARES.tipos[l.tipo];
              return `<li style="--c:${esc(tp.color)}">
                <i>${esc(tp.icono)}</i>
                <span>${esc(l.nombre)}${desvio ? ' <em>desvío</em>' : ''}</span>
                <small>${esc(tp.nombre)}${l.precio ? ' · ' + esc(l.precio) : ''}</small>
              </li>`;
            }).join('')}</ul>
          </div>` : ''}

          ${parkings.length ? `<p class="peq"><b>Dejas el coche en</b> ${parkings.map(p =>
            `${esc(p.parking)} (${esc(p.ciudad)}, ${esc(p.precio)}, ${p.minutos_centro} min al centro)`).join(' · ')}</p>` : ''}

          <b class="jor-tit">Hora a hora</b>
          <ul class="horas">${(d.plan || []).map(p =>
            `<li><time>${esc(p.hora)}</time><span>${esc(p.que)}</span></li>`).join('')}</ul>

          ${extras.map(x => `<div class="caja caja-info">
            <b class="caja-t">Desvío · ${esc(x.nombre)}</b>${esc(x.que)}
            <p class="peq" style="margin-top:6px">+${x.km} km · +${minutosAHoras(x.minutos)}${x.coste ? ' · +' + euros(x.coste) : ''}</p>
          </div>`).join('')}

          ${d.aviso ? `<div class="caja caja-ojo"><b class="caja-t">Ojo</b>${esc(d.aviso)}</div>` : ''}
          <p class="peq"><b>Comer ·</b> ${esc(d.comer)}</p>
        </div>
      </details>`;
    }).join('')}
    <div class="mez-total">
      <b>Total</b>
      <span>${numero(t.km)} km · ${minutosAHoras(t.min)} al volante · ${euros(t.eur)} estimados ·
        ${dias.length} días y ${noches} noches</span>
    </div>
  </div>`;
}
