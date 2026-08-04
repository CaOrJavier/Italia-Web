// El árbol de habilidades: mezclar las rutas 1 y 2.
//
// Las dos rutas no son dos viajes distintos, son el mismo que se abre y se vuelve
// a cerrar tres veces: comprobado día a día, solo duermen en sitio distinto las
// noches del D2 y del D5. En cada bifurcación las dos ramas salen del mismo sitio
// y acaban en el mismo sitio, así que cualquier combinación cuadra sin tocar nada.
// Son 2×2×2 = 8 viajes posibles, y encima van las variantes y los desvíos.
//
// Hay cuatro tipos de nodo, y cada uno decide una cosa distinta:
//   · tronco       días iguales en las dos rutas: no se elige, pero se le cuelgan cosas
//   · bifurcación  cambia la ruta de la que salen esos días
//   · variante     dentro de un mismo día: cambia lo que pagas o lo que haces
//   · desvío       un sitio de más, con sus kilómetros aparte
// Las variantes y los desvíos no tocan los días: solo suman (o restan) al total, y
// por eso pueden colgar también de un tronco, que es donde antes no había nada.
//
// Se dibuja como un árbol de habilidades de videojuego: nodos en una columna, la
// línea que se parte en dos donde hay que elegir, el camino tomado encendido del
// color de su ruta y el otro apagado, y lo menor colgando del que has elegido.
//
// Nada duplica datos: los días salen de rutas.json y arbol.json solo dice qué días
// forman cada rama y qué se le puede añadir.

import * as datos from '../datos.js';
import { esc, fechaCorta, fechaLarga, minutosAHoras, numero, euros } from '../util.js';
import { figura } from '../fotos.js';
import { ir } from '../app.js';

/** Día n de una ruta. Por su número, no por su posición. */
const dia = (idRuta, n) => datos.RUTA.get(idRuta).dias.find(d => d.n === n);
const bifurcaciones = () => datos.ARBOL.tramos.filter(t => t.tipo === 'bifurcacion');
const tramo = id => datos.ARBOL.tramos.find(t => t.id === id);

// ── Estado ─────────────────────────────────────────────────────────────────
//
// Todo el estado cabe en la URL: una clave por bifurcación, una por variante y
// una lista de desvíos. Las claves de bifurcación y de variante no se pisan
// porque los identificadores del JSON son únicos entre las dos listas.

function estado(params) {
  const sel = {};
  for (const b of bifurcaciones()) {
    const pedido = params.get(b.id);
    sel[b.id] = b.opciones.some(o => o.id === pedido) ? pedido : b.opciones[0].id;
  }
  const vsel = {};
  for (const v of datos.ARBOL.variantes) {
    const pedido = params.get(v.id);
    vsel[v.id] = v.opciones.some(o => o.id === pedido) ? pedido : v.opciones[0].id;
  }
  const pedidos = new Set((params.get('d') || '').split(',').filter(Boolean));
  return { sel, vsel, pedidos };
}

/** ¿Este colgante (variante o desvío) está disponible con lo que llevas elegido?
 *  Cuelga de un tramo, a veces de una rama concreta de ese tramo, y a veces
 *  además exige que otra decisión haya salido de una manera. */
function disponible(x, sel, vsel) {
  const t = tramo(x.tramo);
  if (!t) return false;
  if (t.tipo === 'bifurcacion' && x.opcion && sel[t.id] !== x.opcion) return false;
  const r = x.requiere;
  if (!r) return true;
  if (r.tramo) return sel[r.tramo] === r.opcion;
  if (r.variante) return vsel[r.variante] === r.opcion;
  return true;
}

/** Lo que se puede tocar ahora mismo, ya resuelto: variantes vivas, desvíos
 *  posibles y desvíos realmente puestos. */
function abierto({ sel, vsel, pedidos }) {
  const variantes = datos.ARBOL.variantes.filter(v => disponible(v, sel, vsel));
  // Un desvío puede depender de una variante, así que se mira contra las vivas.
  const vivas = new Set(variantes.map(v => v.id));
  const activa = (id, op) => vivas.has(id) && vsel[id] === op;
  const desvios = datos.ARBOL.desvios.filter(d =>
    disponible(d, sel, vsel) && (!d.requiere || !d.requiere.variante || activa(d.requiere.variante, d.requiere.opcion)));
  return { variantes, desvios, cogidos: desvios.filter(d => pedidos.has(d.id)) };
}

const opcionDe = (v, vsel) => v.opciones.find(o => o.id === vsel[v.id]);
const variantesDe = (lista, idTramo, idOpcion) =>
  lista.filter(v => v.tramo === idTramo && (!v.opcion || v.opcion === idOpcion));
const desviosDe = (lista, idTramo, idOpcion) =>
  lista.filter(d => d.tramo === idTramo && (!d.opcion || d.opcion === idOpcion));

function componer(sel) {
  const dias = [];
  for (const t of datos.ARBOL.tramos) {
    const idRuta = t.tipo === 'tronco' ? t.ruta : t.opciones.find(o => o.id === sel[t.id]).ruta;
    for (const n of t.dias) dias.push({ ...dia(idRuta, n), _ruta: idRuta });
  }
  return dias.sort((a, b) => a.n - b.n);
}

/** El total: los días de la combinación, más lo que suman variantes y desvíos.
 *  Las variantes pueden restar (una tarjeta más barata, una entrada que no sacas). */
function total(dias, cogidos, variantes, vsel) {
  const t = dias.reduce((a, d) => ({ km: a.km + d.km, min: a.min + d.minutos, eur: a.eur + d.coste_dia }),
    { km: 0, min: 0, eur: 0 });
  const suma = x => { t.km += x.km || 0; t.min += x.minutos || 0; t.eur += x.coste || 0; };
  cogidos.forEach(suma);
  variantes.map(v => opcionDe(v, vsel)).forEach(suma);
  return t;
}

/** Cuántas decisiones hay tomadas y cuántas hay en total, para la ficha de arriba. */
const cambiadas = (variantes, vsel) =>
  variantes.filter(v => vsel[v.id] !== v.opciones[0].id).length;

// ── Números con signo ──────────────────────────────────────────────────────

const conSigno = (n, sufijo) => `${n > 0 ? '+' : '−'}${numero(Math.abs(n))} ${sufijo}`;

/** Lo que cuesta meter algo, con las tres monedas separadas: «+35 km · +50 min de
 *  coche · 2 h 30 allí · +5 €». Los kilómetros y el volante son una cosa y el rato
 *  que te come el sitio es otra, y mezclarlos era lo que hacía mentir al reloj del
 *  día: Fiesole son tres horas y ni un kilómetro. */
function coste(x) {
  const partes = [];
  if (x.km) partes.push(conSigno(x.km, 'km'));
  if (x.minutos) partes.push(`${x.minutos > 0 ? '+' : '−'}${minutosAHoras(Math.abs(x.minutos))} de coche`);
  if (x.rato) partes.push(`${minutosAHoras(x.rato)} allí`);
  if (x.coste) partes.push(conSigno(x.coste, '€'));
  return partes.length ? partes.join(' · ') : null;
}

/** La versión que cabe en una pastilla del árbol: solo lo que decide, kilómetros y dinero. */
function costeMini(x) {
  const partes = [];
  if (x.km) partes.push(conSigno(x.km, 'km'));
  if (x.rato && !x.km) partes.push(minutosAHoras(x.rato));
  if (x.coste) partes.push(conSigno(x.coste, '€'));
  return partes.length ? partes.join(' · ') : null;
}

const costeCorto = x => coste(x) || 'sin coste';

// ── Pintado ────────────────────────────────────────────────────────────────

export function pintar(main, params) {
  const est = estado(params);
  const { sel, vsel } = est;
  const { variantes, desvios, cogidos } = abierto(est);
  const dias = componer(sel);
  const t = total(dias, cogidos, variantes, vsel);

  main.innerHTML = `
    <p class="intro">${esc(datos.ARBOL.intro)}</p>
    ${panel(t, sel, cogidos, desvios, variantes, vsel)}
    <p class="intro">${esc(datos.ARBOL.explica)}</p>

    <div class="arbol">
      ${datos.ARBOL.tramos.map((tr, i) =>
        (i ? enlace(tr, datos.ARBOL.tramos[i - 1], sel) : '') +
        (tr.tipo === 'tronco'
          ? nodoTronco(tr, variantes, desvios, vsel, est.pedidos)
          : nodosRama(tr, sel, variantes, desvios, vsel, est.pedidos))
      ).join('')}
    </div>
    ${leyenda()}

    ${detalles(sel, variantes, desvios, vsel, est.pedidos)}
    ${sobras(dias, cogidos, desvios)}

    <h2 class="seccion">Tu viaje, día a día</h2>
    ${itinerario(dias, cogidos, variantes, vsel, t)}
  `;

  main.querySelectorAll('[data-elige]').forEach(b => b.addEventListener('click', () =>
    ir('mezclar', nuevaURL(est, { rama: b.dataset.elige, opcion: b.dataset.opcion }))));
  main.querySelectorAll('[data-variante]').forEach(b => b.addEventListener('click', () =>
    ir('mezclar', nuevaURL(est, { variante: b.dataset.variante, opcion: b.dataset.opcion }))));
  main.querySelectorAll('[data-desvio]').forEach(b => b.addEventListener('click', () =>
    ir('mezclar', nuevaURL(est, { desvio: b.dataset.desvio }))));
  const reset = main.querySelector('#reiniciar');
  if (reset) reset.addEventListener('click', () => ir('mezclar', new URLSearchParams()));
}

/** La URL nueva después de tocar algo. En vez de ir borrando a mano lo que deja
 *  de tener sentido, se recalcula qué está disponible con el estado nuevo y se
 *  escribe solo eso: lo que ya no cuelga de ningún sitio se cae solo. */
function nuevaURL(est, cambio) {
  const sel = { ...est.sel };
  const vsel = { ...est.vsel };
  const pedidos = new Set(est.pedidos);

  if (cambio.rama) sel[cambio.rama] = cambio.opcion;
  if (cambio.variante) vsel[cambio.variante] = cambio.opcion;
  if (cambio.desvio) pedidos.has(cambio.desvio) ? pedidos.delete(cambio.desvio) : pedidos.add(cambio.desvio);

  const { variantes, cogidos } = abierto({ sel, vsel, pedidos });
  const q = new URLSearchParams(sel);
  // Solo se escriben las variantes que están vivas y que no llevan lo de serie:
  // la URL se queda corta y compartible.
  for (const v of variantes) if (vsel[v.id] !== v.opciones[0].id) q.set(v.id, vsel[v.id]);
  if (cogidos.length) q.set('d', cogidos.map(d => d.id).join(','));
  return q;
}

/** La barra de estado de arriba, estilo ficha de personaje. */
function panel(t, sel, cogidos, desvios, variantes, vsel) {
  const rutas = datos.ARBOL.rutas.map(id => datos.RUTA.get(id));
  const tocadas = cambiadas(variantes, vsel);
  const pura = cogidos.length || tocadas ? null : rutas.find(r =>
    bifurcaciones().every(b => b.opciones.find(o => o.id === sel[b.id]).ruta === r.id));

  return `
  <div class="ficha-arbol">
    <div class="ficha-stats">
      <div><b>${numero(t.km)}</b><span>km</span></div>
      <div><b>${minutosAHoras(t.min)}</b><span>volante</span></div>
      <div><b>${euros(t.eur)}</b><span>coste</span></div>
      <div><b>${cogidos.length}<small>/${desvios.length}</small></b><span>desvíos</span></div>
    </div>
    <div class="ficha-pie">
      ${pura
        ? `<span class="etiq etiq-verde">Esto es la ruta ${pura.numero} tal cual</span>`
        : `<span class="etiq etiq-ambar">Mezcla propia${tocadas ? ` · ${tocadas} variante${tocadas > 1 ? 's' : ''}` : ''}</span>`}
      <button type="button" id="reiniciar" class="etiq etiq-gris"
              style="cursor:pointer;min-height:32px;padding:7px 12px">Reiniciar</button>
    </div>
  </div>`;
}

function leyenda() {
  return `<ul class="sk-leyenda">${datos.ARBOL.leyenda.map(l => `
    <li><i>${esc(l.icono)}</i><span><b>${esc(l.nombre)}</b> ${esc(l.que)}</span></li>`).join('')}</ul>`;
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

function nodoTronco(tr, variantes, desvios, vsel, pedidos) {
  const dias = tr.dias.map(n => dia(tr.ruta, n));
  const km = dias.reduce((a, d) => a + d.km, 0);
  const mias = variantesDe(variantes, tr.id);
  const misD = desviosDe(desvios, tr.id);
  return `
  <div class="sk-fila sk-fila-1">
    <div class="sk-col">
      <div class="sk-nodo sk-tronco" title="${esc(tr.nota)}">
        <span class="sk-ico">${esc(tr.icono)}</span>
        <b>${esc(tr.corto)}</b>
        <span class="sk-dias">D${dias[0].n}${dias.length > 1 ? '-D' + dias[dias.length - 1].n : ''} · ${km} km</span>
        <span class="sk-fijo">fijo en las 2</span>
      </div>
      ${/* Lo que cuelga del tronco no es de ninguna de las dos rutas, así que va en
            tinta y no en color: pintarlo de verde o de azul diría que es de una. */
        menores(mias, misD, vsel, pedidos, 'var(--tinta-2)')}
    </div>
  </div>`;
}

function nodosRama(tr, sel, variantes, desvios, vsel, pedidos) {
  return `
  <div class="sk-fila sk-fila-2">
    ${tr.opciones.map(o => {
      const elegida = sel[tr.id] === o.id;
      const r = datos.RUTA.get(o.ruta);
      const dias = tr.dias.map(n => dia(o.ruta, n));
      const km = dias.reduce((a, d) => a + d.km, 0);
      return `<div class="sk-col">
        <button type="button" class="sk-nodo sk-elige ${elegida ? 'sk-on' : 'sk-off'}"
                style="--barra:${esc(r.color)}" aria-pressed="${elegida}"
                data-elige="${esc(tr.id)}" data-opcion="${esc(o.id)}">
          <span class="sk-ico">${esc(o.icono)}</span>
          <b>${esc(o.corto)}</b>
          <span class="sk-dias">D${tr.dias[0]}-D${tr.dias[tr.dias.length - 1]} · ${km} km</span>
          <span class="sk-ruta">ruta ${r.numero}</span>
        </button>
        ${elegida
          ? menores(variantesDe(variantes, tr.id, o.id), desviosDe(desvios, tr.id, o.id), vsel, pedidos, r.color)
          : ''}
      </div>`;
    }).join('')}
  </div>`;
}

/** Lo que cuelga de un nodo elegido: primero las variantes, que son decisiones
 *  dentro del día, y luego los desvíos, que son sitios de más. */
function menores(variantes, desvios, vsel, pedidos, color) {
  if (!variantes.length && !desvios.length) return '';
  return `<div class="sk-menores" style="--barra:${esc(color)}">
    ${variantes.map(v => `
      <div class="sk-var">
        <span class="sk-var-t">${esc(v.icono)} ${esc(v.titulo.split(':')[0])}</span>
        <div class="sk-var-ops" role="group" aria-label="${esc(v.titulo)}">
          ${v.opciones.map(o => {
            const puesta = vsel[v.id] === o.id;
            const mini = costeMini(o);
            return `<button type="button" class="sk-op ${puesta ? 'sk-on' : ''}"
              data-variante="${esc(v.id)}" data-opcion="${esc(o.id)}" aria-pressed="${puesta}"
              title="${esc(o.nombre)}: ${esc(costeCorto(o))}">
              <b>${esc(o.corto)}</b>${mini ? `<em>${esc(mini)}</em>` : ''}</button>`;
          }).join('')}
        </div>
      </div>`).join('')}
    ${desvios.map(d => {
      const puesto = pedidos.has(d.id);
      return `<button type="button" class="sk-menor ${puesto ? 'sk-on' : ''}"
        data-desvio="${esc(d.id)}" aria-pressed="${puesto}"
        title="${esc(d.nombre)}: ${esc(costeCorto(d))}">
        <span class="sk-ico">${esc(d.icono)}</span>
        <span class="sk-menor-t"><b>${esc(d.nombre)}</b><span>+${d.km} km</span></span>
      </button>`;
    }).join('')}
  </div>`;
}

// ── La letra pequeña, tramo a tramo ────────────────────────────────────────

/** Los sitios de un tramo, cada uno con lo que es y lo que cuesta. Van plegados
 *  porque son muchos: el árbol de arriba es para decidir y esto es para leer. */
function hitos(lista) {
  if (!lista || !lista.length) return '';
  return `
  <details class="hitos">
    <summary>Los ${lista.length} sitios de este tramo, uno a uno</summary>
    <ul>${lista.map(h => {
      const l = datos.lugar(h.lugar);
      if (!l) return '';
      const tp = datos.LUGARES.tipos[l.tipo];
      return `<li style="--c:${esc(tp.color)}">
        <i>${esc(tp.icono)}</i>
        <div>
          <b>${esc(l.nombre)}</b>
          ${l.precio ? `<span class="hito-precio">${esc(l.precio)}</span>` : ''}
          <p>${esc(h.que)}</p>
        </div>
      </li>`;
    }).join('')}</ul>
  </details>`;
}

/** El bloque de una variante dentro de la tarjeta del tramo: la pregunta, la
 *  letra pequeña y todas las opciones con lo que cambia cada una. */
function bloqueVariante(v, vsel) {
  return `
  <div class="plato plato-var">
    <div class="plato-t">
      <b>${esc(v.icono)} ${esc(v.titulo)}</b>
      <span class="etiq etiq-gris">variante · no cambia el itinerario</span>
    </div>
    ${v.nota ? `<p class="peq">${esc(v.nota)}</p>` : ''}
    <div class="var-ops">
      ${v.opciones.map(o => {
        const puesta = vsel[v.id] === o.id;
        const c = coste(o);
        return `<button type="button" class="var-op ${puesta ? 'var-on' : ''}"
          data-variante="${esc(v.id)}" data-opcion="${esc(o.id)}" aria-pressed="${puesta}">
          <span class="var-cab">
            <b>${esc(o.icono)} ${esc(o.nombre)}</b>
            <span class="etiq ${puesta ? 'etiq-azul' : 'etiq-gris'}">${puesta ? 'la que llevas' : 'cambiar a esta'}${c ? ' · ' + esc(c) : ''}</span>
          </span>
          <span class="var-que">${esc(o.que)}</span>
        </button>`;
      }).join('')}
    </div>
  </div>`;
}

/** El bloque de un desvío: qué es, cuándo cae y lo que cuesta meterlo. */
function bloqueDesvio(d, pedidos) {
  return `
  <div class="plato">
    <div class="plato-t">
      <b>${esc(d.icono)} ${esc(d.nombre)}</b>
      <span class="etiq ${pedidos.has(d.id) ? 'etiq-azul' : 'etiq-gris'}">
        ${pedidos.has(d.id) ? 'añadido' : 'desvío'} · ${esc(costeCorto(d))}</span>
    </div>
    ${d.cuando ? `<p class="peq"><b>Cuándo cae ·</b> ${esc(d.cuando)}</p>` : ''}
    <p>${esc(d.que)}</p>
    ${d.requiere && d.requiere.tramo
      ? `<p class="peq">Solo aparece si eliges «${esc(tramo(d.requiere.tramo).opciones.find(o => o.id === d.requiere.opcion).corto)}» más arriba.</p>`
      : ''}
    ${d.lugar ? figura(d.lugar, { alto: 120, pie: false }) || '' : ''}
  </div>`;
}

/** Una tarjeta por tramo, en el orden del viaje: la fija dice por qué es fija y
 *  la que se elige dice qué ganas y qué pierdes. Debajo, lo que se le puede colgar. */
function detalles(sel, variantes, desvios, vsel, pedidos) {
  return `
  <h2 class="seccion">Tramo a tramo, qué llevas</h2>
  ${datos.ARBOL.tramos.map(tr => tr.tipo === 'tronco'
    ? tarjetaTronco(tr, variantes, desvios, vsel, pedidos)
    : tarjetaRama(tr, sel, variantes, desvios, vsel, pedidos)).join('')}`;
}

function tarjetaTronco(tr, variantes, desvios, vsel, pedidos) {
  const dias = tr.dias.map(n => dia(tr.ruta, n));
  const mias = variantesDe(variantes, tr.id);
  const misD = desviosDe(desvios, tr.id);
  return `
  <div class="tarjeta tarjeta-fija">
    <div class="cab-tarjeta">
      <h3>${esc(tr.icono)} ${esc(tr.titulo)}</h3>
      <span class="etiq etiq-verde">igual en las dos rutas</span>
    </div>
    <div class="tarjeta-c">
      <p>${esc(tr.porque)}</p>
      <ul class="tronco-dias">${dias.map(d => `
        <li><b>D${d.n}</b> <span>${esc(fechaCorta(d.fecha))}</span> ${esc(d.etapa)}
          <em>${d.km} km</em></li>`).join('')}</ul>
      ${tr.duermes ? `<p class="peq" style="margin-top:10px"><b>Duermes ·</b> ${esc(tr.duermes)}</p>` : ''}
      ${hitos(tr.hitos)}
      ${mias.length || misD.length
        ? `<p class="peq" style="margin-top:10px">Aquí no se elige ruta, pero sí
           ${mias.length ? `${mias.length} variante${mias.length > 1 ? 's' : ''}` : ''}${mias.length && misD.length ? ' y ' : ''}${misD.length ? `${misD.length} desvío${misD.length > 1 ? 's' : ''}` : ''}.</p>`
        : ''}
    </div>
    ${mias.map(v => bloqueVariante(v, vsel)).join('')}
    ${misD.map(d => bloqueDesvio(d, pedidos)).join('')}
  </div>`;
}

function tarjetaRama(tr, sel, variantes, desvios, vsel, pedidos) {
  const o = tr.opciones.find(x => x.id === sel[tr.id]);
  const otra = tr.opciones.find(x => x.id !== sel[tr.id]);
  const r = datos.RUTA.get(o.ruta);
  const dias = tr.dias.map(n => dia(o.ruta, n));
  const km = dias.reduce((a, d) => a + d.km, 0);
  const mias = variantesDe(variantes, tr.id, o.id);
  const misD = desviosDe(desvios, tr.id, o.id);

  return `
  <div class="tarjeta" style="--barra:${esc(r.color)}">
    <div class="cab-tarjeta">
      <h3>${esc(o.icono)} ${esc(o.nombre)}</h3>
      <span class="etiq etiq-gris">en vez de «${esc(otra.corto)}»</span>
      <p class="peq">${esc(tr.desde)}. <b>${esc(tr.hasta)}.</b></p>
    </div>
    <div class="tarjeta-c">
      <p>${esc(o.resumen)}</p>
      <ul class="tronco-dias">${dias.map(d => `
        <li><b>D${d.n}</b> <span>${esc(fechaCorta(d.fecha))}</span> ${esc(d.etapa)}
          <em>${d.km} km</em></li>`).join('')}</ul>
      <div class="rama-datos">
        <span><i>Ritmo</i>${esc(o.ritmo || '—')}</span>
        <span><i>Duermes</i>${esc(o.duermes || '—')}</span>
        <span><i>De esta rama</i>${km} km de los ${numero(r.km)} de la ruta ${r.numero}</span>
      </div>
      ${hitos(o.hitos)}
      <div class="listas" style="margin-top:10px">
        <div><ul class="gana">${o.gana.map(x => `<li><span>${esc(x)}</span></li>`).join('')}</ul></div>
        <div><ul class="pierde">${o.pierde.map(x => `<li><span>${esc(x)}</span></li>`).join('')}</ul></div>
      </div>
    </div>
    ${mias.map(v => bloqueVariante(v, vsel)).join('')}
    ${misD.map(d => bloqueDesvio(d, pedidos)).join('')}
  </div>`;
}

/** Lo que la combinación deja fuera y a dónde vuelves, calculado y no escrito.
 *
 *  Se separan dos cosas que no son la misma: lo que pierdes por la rama que has
 *  elegido, que ya no lo ves salvo que lo rescates, y lo que tienes a mano en
 *  desvíos y todavía no has cogido, que solo cuesta decidirlo. */
function sobras(dias, cogidos, desvios) {
  const visitados = new Set(dias.flatMap(d => d.lugares || []));
  cogidos.forEach(d => d.lugar && visitados.add(d.lugar));

  // Solo cuentan como pérdida los sitios que están en alguna de las dos rutas:
  // los que solo existen como desvío no se «pierden», se cogen o no se cogen.
  const deRuta = [...new Set(datos.ARBOL.rutas.flatMap(id =>
    datos.RUTA.get(id).dias.flatMap(d => d.lugares || [])))]
    .filter(id => !visitados.has(id))
    .map(id => datos.lugar(id)).filter(l => l && l.tipo !== 'aparcar');

  const sinCoger = desvios.filter(d => !cogidos.includes(d));

  // Repetir un sitio dos días seguidos es el plan (duermes ahí, o lo ves en dos
  // tandas). Lo que merece contarse es volver después de haberte ido.
  const cuando = {};
  dias.forEach(d => (d.lugares || []).forEach(id => (cuando[id] = cuando[id] || []).push(d.n)));
  cogidos.forEach(x => { if (x.lugar) (cuando[x.lugar] = cuando[x.lugar] || []).push(x.dia); });
  const vuelves = Object.entries(cuando)
    .filter(([, ns]) => [...ns].sort((a, b) => a - b).some((n, i, o) => i && n - o[i - 1] > 1))
    .map(([id]) => datos.lugar(id))
    .filter(l => l && l.id !== 'civitavecchia');

  if (!deRuta.length && !sinCoger.length && !vuelves.length) return '';
  const corto = l => esc(l.nombre.split('·')[0].trim());
  return `
    <div class="caja caja-ojo" style="margin-top:14px">
      <b class="caja-t">Con esta combinación…</b>
      ${deRuta.length ? `<p><b>Pierdes de la otra ruta:</b> ${deRuta.map(corto).join(', ')}.
        Mira arriba si alguno lo recuperas con un desvío.</p>` : ''}
      ${sinCoger.length ? `<p><b>Te dejas sin coger</b> ${sinCoger.length} desvío${sinCoger.length > 1 ? 's' : ''}
        que cuelga${sinCoger.length > 1 ? 'n' : ''} de las ramas que llevas, empezando por
        ${sinCoger.slice(0, 3).map(d => esc(d.nombre.split(' y ')[0])).join(', ')}. Están todos contados aquí arriba.</p>` : ''}
      ${vuelves.length ? `<p><b>Vuelves a:</b> ${vuelves.map(corto).join(', ')}, después de haber estado y haberte ido.
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

function itinerario(dias, cogidos, variantes, vsel, t) {
  const porDia = {};
  cogidos.forEach(d => (porDia[d.dia] = porDia[d.dia] || []).push(d));
  const varDia = {};
  variantes.forEach(v => (varDia[v.dia] = varDia[v.dia] || []).push(v));
  const noches = dias.filter(d => d.dormir).length;
  // El rato que se van las paradas añadidas no es tiempo de volante, así que no
  // entra en el total de arriba: se cuenta aparte al final, que es donde se ve
  // si el día sigue cabiendo en un día.
  const ratoTotal = [...cogidos, ...variantes.map(v => opcionDe(v, vsel))]
    .reduce((a, x) => a + (x.rato || 0), 0);

  return `
  <div class="tarjeta">
    ${dias.map(d => {
      const cama = datos.camaDe(d);
      const extras = porDia[d.n] || [];
      const vars = varDia[d.n] || [];
      const r = datos.RUTA.get(d._ruta);
      const puestos = [...extras, ...vars.map(v => opcionDe(v, vsel))];
      const sumar = campo => puestos.reduce((a, x) => a + (x[campo] || 0), 0);
      const km = d.km + sumar('km');
      const min = d.minutos + sumar('minutos');
      const rato = sumar('rato');
      const h = horas(d);
      const sitios = sitiosDelDia(d, extras);
      const parkings = datos.parkingsDe(d);
      const tpt = datos.minutosTransporte(d);
      const cambiada = vars.filter(v => vsel[v.id] !== v.opciones[0].id);

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
            ${cambiada.length ? `<small class="jor-extra">${cambiada.length} variante${cambiada.length > 1 ? 's' : ''}</small>` : ''}
          </span>
        </summary>

        <div class="jor-c">
          <div class="jor-reloj">
            ${h ? `<span><i>Salida</i><b>${esc(h.salida)}</b></span>
                   <span><i>Fin del día</i><b>${esc(h.llegada)}</b></span>` : ''}
            <span><i>Al volante</i><b>${minutosAHoras(min)}</b></span>
            ${tpt ? `<span><i>Transporte</i><b>${minutosAHoras(tpt)}</b></span>` : ''}
            ${rato ? `<span><i>Paradas de más</i><b>${minutosAHoras(rato)}</b></span>` : ''}
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

          ${vars.map(v => {
            const o = opcionDe(v, vsel);
            const c = coste(o);
            return `<div class="caja caja-info">
              <b class="caja-t">Variante · ${esc(v.titulo)}</b>
              <b>${esc(o.icono)} ${esc(o.nombre)}${c ? ` (${esc(c)})` : ''}.</b> ${esc(o.que)}
            </div>`;
          }).join('')}

          ${extras.map(x => `<div class="caja caja-info">
            <b class="caja-t">Desvío · ${esc(x.nombre)}</b>${esc(x.que)}
            <p class="peq" style="margin-top:6px">${esc(costeCorto(x))}</p>
          </div>`).join('')}

          ${d.aviso ? `<div class="caja caja-ojo"><b class="caja-t">Ojo</b>${esc(d.aviso)}</div>` : ''}
          <p class="peq"><b>Comer ·</b> ${esc(d.comer)}</p>
        </div>
      </details>`;
    }).join('')}
    <div class="mez-total">
      <b>Total</b>
      <span>${numero(t.km)} km · ${minutosAHoras(t.min)} al volante · ${euros(t.eur)} estimados ·
        ${dias.length} días y ${noches} noches${ratoTotal ? ` · ${minutosAHoras(ratoTotal)} de paradas añadidas` : ''}</span>
    </div>
  </div>`;
}
