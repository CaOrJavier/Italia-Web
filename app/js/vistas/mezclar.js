// El árbol de decisiones, día a día: mezclar las rutas 1 y 2.
//
// Antes esto iba por tramos de dos días, y era mentira: si el domingo te apetecía
// otra cosa, tenías que cambiar también el lunes. Ahora hay un nodo por día, los
// doce, y cada día se elige por separado.
//
// Lo único que ata un día con el siguiente es dónde duermes. Cada opción de día
// declara de qué base sale y en cuál acaba, así que un día solo ofrece los caminos
// que arrancan donde dormiste anoche. Cambiar una noche recalcula el día siguiente
// y para de propagarse en cuanto vuelve a coincidir la base: por eso se puede tocar
// el D2 sin que se caiga el viaje entero.
//
// Hay días de un solo nodo: no es pereza, es que no hay alternativa que cuadre con
// el ferri, con los cierres del Vaticano o con la geografía. Cada uno dice por qué.
//
// Los días salen de rutas.json cuando la opción es de una de las dos rutas
// («usa»), y van escritos dentro de arbol.json cuando es un día nuevo que no está
// en ninguna de las dos. Un día es un día: mismo formato, mismos campos, así que
// el itinerario no distingue de dónde viene.

import * as datos from '../datos.js';
import { esc, fechaCorta, fechaLarga, minutosAHoras, numero, euros, comoArray } from '../util.js';
import { figura } from '../fotos.js';
import { cadena, nivelDeHora, holgura, NIVELES } from '../cadena.js';
import { ir } from '../app.js';

// ── Lo que sobrevive al repintado ──────────────────────────────────────────
//
// Cada clic cambia la URL y la vista se dibuja entera de nuevo, así que sin esto
// se perdían dos cosas: los días que tenías abiertos y el sitio donde estabas
// mirando. Lo segundo era lo gordo: al cerrarse las doce jornadas la página
// pasaba de 25.000 píxeles a 6.000, el navegador no tenía adónde scrollar y te
// devolvía arriba del todo.
//
// El ancla no es un número de scroll, que no serviría porque la página cambia de
// alto: es «este día estaba a tantos píxeles del borde de la pantalla». Después
// de repintar se vuelve a poner ahí, y el nodo que acabas de pulsar no se mueve.

const abiertos = new Set();
let ancla = null;

/** Apunta dónde está ahora mismo el bloque que contiene lo que se acaba de pulsar. */
function anclar(el) {
  const caja = el.closest('[data-ancla]');
  if (!caja) { ancla = null; return; }
  ancla = { clave: caja.dataset.ancla, top: caja.getBoundingClientRect().top };
}

/** Y lo devuelve a su sitio, ya con el contenido nuevo puesto. */
function desanclar(main) {
  if (!ancla) return;
  const caja = main.querySelector(`[data-ancla="${CSS.escape(ancla.clave)}"]`);
  if (caja) scrollBy(0, Math.round(caja.getBoundingClientRect().top - ancla.top));
  ancla = null;
}

const DIAS = () => datos.ARBOL.dias;
const baseNombre = id => (datos.ARBOL.bases.find(b => b.id === id) || {}).nombre || null;

/** El día de una opción: o el de una ruta, o el que lleva escrito encima. */
const diaDe = o => (o.dia ? o.dia : datos.RUTA.get(o.ruta).dias.find(d => d.n === o.usa));

/** El color de una opción: el de su ruta, o el de «esto no es de ninguna de las dos».
 *  Un día de un solo camino va en gris aunque sus datos salgan de la ruta 1: es
 *  idéntico en las dos, y pintarlo de verde diría que estás yendo por una. */
const colorDe = o => (o.ruta ? datos.RUTA.get(o.ruta).color : datos.ARBOL.color_propio);
const colorDia = (d, o) => (d.opciones.length === 1 ? 'var(--linea-2)' : colorDe(o));

/** Los caminos que arrancan donde dormiste anoche. El primer día sale de null. */
const caminos = (d, base) => d.opciones.filter(o => o.sale === base);

// ── Estado ─────────────────────────────────────────────────────────────────
//
// En la URL: una clave por día con elección (d2, d3…) y la lista de desvíos en x.
// Se guardan los días tal cual los pediste, aunque ahora mismo no encajen: así
// cambiar el D2 y volver atrás te devuelve el D3 que tenías, en vez de perderlo.

function estado(params) {
  const sel = {};
  const abanico = {};
  let base = null;
  for (const d of DIAS()) {
    const posibles = caminos(d, base);
    const pedido = params.get('d' + d.n);
    const o = posibles.find(x => x.id === pedido) || posibles[0];
    sel[d.n] = o.id;
    abanico[d.n] = posibles;
    base = o.duerme;
  }
  const vsel = {};
  for (const v of datos.ARBOL.variantes) {
    const pedido = params.get(v.id);
    vsel[v.id] = v.opciones.some(o => o.id === pedido) ? pedido : v.opciones[0].id;
  }
  const pedidos = new Set((params.get('x') || '').split(',').filter(Boolean));
  return { sel, abanico, vsel, pedidos, params };
}

const opcionDe = (d, sel) => d.opciones.find(o => o.id === sel[d.n]);
const componer = sel => DIAS().map(d => {
  const o = opcionDe(d, sel);
  return { ...diaDe(o), _opcion: o, _color: colorDia(d, o), _nodo: d };
});

/** ¿Este colgante está disponible con lo que llevas elegido? Cuelga de un día, a
 *  veces solo de algunos caminos de ese día, y a veces depende de una variante. */
function disponible(x, sel, vsel) {
  const dias = comoArray(x.dia);
  if (!dias.some(n => sel[n] !== undefined)) return false;
  const opciones = comoArray(x.opcion);
  if (opciones.length && !dias.some(n => opciones.includes(sel[n]))) return false;
  const r = x.requiere;
  if (r && r.dia !== undefined) return sel[r.dia] === r.opcion;
  if (r && r.variante) return vsel[r.variante] === r.opcion;
  return true;
}

/** Lo que se puede tocar ahora mismo. La regla que se lleva casi todo el trabajo:
 *  un desvío a un sitio que ya pisas ese viaje no se ofrece. Antes había que
 *  acordarse de anclar cada desvío a la rama correcta y se colaban duplicados
 *  (Bolgheri se ofrecía en un día que ya pasa por Bolgheri). Así no se cuela. */
function abierto({ sel, vsel, pedidos }, dias) {
  const visitados = new Set(dias.flatMap(d => d.lugares || []));
  const variantes = datos.ARBOL.variantes.filter(v => disponible(v, sel, vsel));
  const vivas = new Set(variantes.map(v => v.id));
  const desvios = datos.ARBOL.desvios.filter(d =>
    disponible(d, sel, vsel) &&
    !(d.lugar && visitados.has(d.lugar)) &&
    (!d.requiere || !d.requiere.variante || vivas.has(d.requiere.variante)));
  return { variantes, desvios, cogidos: desvios.filter(d => pedidos.has(d.id)) };
}

const deDia = (lista, n, idOpcion) =>
  lista.filter(x => comoArray(x.dia).includes(n) &&
    (!x.opcion || comoArray(x.opcion).includes(idOpcion)));

const elegida = (v, vsel) => v.opciones.find(o => o.id === vsel[v.id]);

/** El total: los días de la combinación, más lo que suman variantes y desvíos.
 *  Las variantes pueden restar (una tarjeta más barata, una entrada que no sacas). */
function total(dias, cogidos, variantes, vsel) {
  const t = dias.reduce((a, d) => ({ km: a.km + d.km, min: a.min + d.minutos, eur: a.eur + d.coste_dia }),
    { km: 0, min: 0, eur: 0 });
  const suma = x => { t.km += x.km || 0; t.min += x.minutos || 0; t.eur += x.coste || 0; };
  cogidos.forEach(suma);
  variantes.map(v => elegida(v, vsel)).forEach(suma);
  return t;
}

// ── Números con signo ──────────────────────────────────────────────────────

const conSigno = (n, sufijo) => `${n > 0 ? '+' : '−'}${numero(Math.abs(n))} ${sufijo}`;

/** Lo que cuesta meter algo, con las tres monedas separadas: «+35 km · +50 min de
 *  coche · 2 h 30 allí · +5 €». Los kilómetros y el volante son una cosa y el rato
 *  que te come el sitio es otra, y mezclarlos hacía mentir al reloj del día:
 *  Fiesole son tres horas y ni un kilómetro. */
function coste(x) {
  const partes = [];
  if (x.km) partes.push(conSigno(x.km, 'km'));
  if (x.minutos) partes.push(`${x.minutos > 0 ? '+' : '−'}${minutosAHoras(Math.abs(x.minutos))} de coche`);
  if (x.rato) partes.push(`${minutosAHoras(x.rato)} allí`);
  if (x.coste) partes.push(conSigno(x.coste, '€'));
  return partes.length ? partes.join(' · ') : null;
}

/** La versión que cabe en una pastilla del árbol: solo lo que decide. */
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
  const dias = componer(est.sel);
  const { variantes, desvios, cogidos } = abierto(est, dias);
  const t = total(dias, cogidos, variantes, est.vsel);

  main.innerHTML = `
    <p class="intro">${esc(datos.ARBOL.intro)}</p>
    ${panel(t, dias, cogidos, desvios, variantes, est.vsel)}
    <p class="intro">${esc(datos.ARBOL.explica)}</p>

    <div class="arbol">
      ${DIAS().map((d, i) =>
        (i ? enlace(DIAS()[i - 1], d, est) : '') + parada(d, est, variantes, desvios)
      ).join('')}
    </div>
    ${leyenda()}

    ${sobras(dias, cogidos, desvios)}

    <div class="cab-seccion">
      <h2 class="seccion">Tu viaje, día a día</h2>
      <button type="button" id="abrir-todo" class="etiq etiq-gris"
              style="cursor:pointer;min-height:32px;padding:7px 12px">Abrir los 12 días</button>
    </div>
    ${itinerario(dias, est, cogidos, variantes, desvios, t)}
  `;

  // Se reabren antes de tocar el scroll: si no, se mediría la página encogida.
  const jornadas = [...main.querySelectorAll('.jornada')];
  jornadas.forEach(j => {
    j.open = abiertos.has(j.dataset.n);
    j.addEventListener('toggle', () => {
      j.open ? abiertos.add(j.dataset.n) : abiertos.delete(j.dataset.n);
      etiquetaAbrir();
    });
  });

  const abrir = main.querySelector('#abrir-todo');
  const etiquetaAbrir = () => {
    abrir.textContent = jornadas.every(j => j.open) ? 'Cerrar los 12 días' : 'Abrir los 12 días';
  };
  etiquetaAbrir();
  abrir.addEventListener('click', () => {
    const cerrar = jornadas.every(j => j.open);
    jornadas.forEach(j => { j.open = !cerrar; });
  });

  const navegar = (b, cambio) => b.addEventListener('click', () => {
    anclar(b);
    ir('mezclar', nuevaURL(est, dias, cambio));
  });
  main.querySelectorAll('[data-dia]').forEach(b =>
    navegar(b, { dia: b.dataset.dia, opcion: b.dataset.opcion }));
  main.querySelectorAll('[data-variante]').forEach(b =>
    navegar(b, { variante: b.dataset.variante, opcion: b.dataset.opcion }));
  main.querySelectorAll('[data-desvio]').forEach(b =>
    navegar(b, { desvio: b.dataset.desvio }));

  const reset = main.querySelector('#reiniciar');
  if (reset) reset.addEventListener('click', () => { ancla = null; ir('mezclar', new URLSearchParams()); });

  desanclar(main);
}

/** La URL nueva después de tocar algo. Se parte de lo que había pedido el usuario,
 *  no de lo que se acabó pintando: así los días que hoy no encajan se quedan
 *  apuntados y vuelven solos si rehaces la noche anterior. Lo único que se limpia
 *  son los desvíos, que sí dejarían de existir. */
function nuevaURL(est, dias, cambio) {
  const q = new URLSearchParams(est.params);
  if (cambio.dia) q.set('d' + cambio.dia, cambio.opcion);
  if (cambio.variante) q.set(cambio.variante, cambio.opcion);

  const pedidos = new Set(est.pedidos);
  if (cambio.desvio) pedidos.has(cambio.desvio) ? pedidos.delete(cambio.desvio) : pedidos.add(cambio.desvio);

  const nuevo = estado(q);
  const { cogidos } = abierto({ ...nuevo, pedidos }, componer(nuevo.sel));
  q.delete('x');
  if (cogidos.length) q.set('x', cogidos.map(d => d.id).join(','));
  return q;
}

/** La barra de estado de arriba, estilo ficha de personaje. */
function panel(t, dias, cogidos, desvios, variantes, vsel) {
  const tocadas = variantes.filter(v => vsel[v.id] !== v.opciones[0].id).length;
  const propios = dias.filter(d => !d._opcion.ruta).length;
  // Los días de un solo camino no delatan ruta: son iguales en las dos, así que
  // no impiden que la combinación siga siendo la 1 o la 2 tal cual.
  const pura = cogidos.length || tocadas || propios ? null
    : datos.ARBOL.rutas.map(id => datos.RUTA.get(id))
        .find(r => dias.every(d => d._nodo.opciones.length === 1 || d._opcion.ruta === r.id));

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
        : `<span class="etiq etiq-ambar">Mezcla propia${propios ? ` · ${propios} día${propios > 1 ? 's' : ''} que no está${propios > 1 ? 'n' : ''} en ninguna` : ''}${tocadas ? ` · ${tocadas} variante${tocadas > 1 ? 's' : ''}` : ''}</span>`}
      <button type="button" id="reiniciar" class="etiq etiq-gris"
              style="cursor:pointer;min-height:32px;padding:7px 12px">Reiniciar</button>
    </div>
  </div>`;
}

function leyenda() {
  return `<ul class="sk-leyenda">${datos.ARBOL.leyenda.map(l => `
    <li><i>${esc(l.icono)}</i><span><b>${esc(l.nombre)}</b> ${esc(l.que)}</span></li>`).join('')}</ul>`;
}

// ── El árbol ───────────────────────────────────────────────────────────────

/** El trozo de línea entre dos días: se cierra el abanico del día que acaba y se
 *  abre el del que empieza, en una sola pieza. Con un solo camino sale una recta
 *  sin necesidad de un caso aparte: el centro de una columna única es el 50 %. */
function enlace(anterior, siguiente, est) {
  const arriba = est.abanico[anterior.n];
  const abajo = est.abanico[siguiente.n];
  const iA = arriba.findIndex(o => o.id === est.sel[anterior.n]);
  const iB = abajo.findIndex(o => o.id === est.sel[siguiente.n]);
  const g = 'vector-effect="non-scaling-stroke" fill="none" stroke-linecap="round"';
  const centro = (i, n) => ((i + 0.5) / n) * 100;
  const via = (paths, n, i, color, hacer) => paths.concat(
    Array.from({ length: n }, (_, k) => {
      const viva = k === i;
      return `<path ${g} class="${viva ? 'sk-viva' : 'sk-muerta'}"
        style="stroke:${viva ? esc(color) : ''}" d="${hacer(centro(k, n))}"/>`;
    }));

  const cA = colorDia(anterior, arriba[iA]);
  const cB = colorDia(siguiente, abajo[iB]);
  let paths = [];
  paths = via(paths, arriba.length, iA, cA, c => `M${c} 0 V6 H50`);
  paths.push(`<path ${g} class="sk-viva" style="stroke:${esc(cA)}" d="M50 6 V13"/>`);
  paths.push(`<path ${g} class="sk-viva" style="stroke:${esc(cB)}" d="M50 13 V20"/>`);
  paths = via(paths, abajo.length, iB, cB, c => `M50 20 H${c} V26`);

  const abanico = `<svg class="sk-linea sk-linea-abanico" viewBox="0 0 100 26"
    preserveAspectRatio="none" aria-hidden="true">${paths.join('')}</svg>`;

  // Con más de dos caminos, en un móvil los nodos se apilan en dos columnas y el
  // abanico apuntaría a donde ya no hay nada. Para eso va esta recta de repuesto,
  // que el CSS enciende y apaga con el mismo ancho que reordena la rejilla.
  if (arriba.length <= 2 && abajo.length <= 2) return abanico;
  return abanico + `<svg class="sk-linea sk-linea-recta" viewBox="0 0 100 26"
    preserveAspectRatio="none" aria-hidden="true">
    <path ${g} class="sk-viva" style="stroke:${esc(cA)}" d="M50 0 V13"/>
    <path ${g} class="sk-viva" style="stroke:${esc(cB)}" d="M50 13 V26"/></svg>`;
}

/** Una parada del camino: la cabecera del día y sus caminos posibles. */
function parada(d, est, variantes, desvios) {
  const posibles = est.abanico[d.n];
  const elige = posibles.length > 1;
  const o = posibles.find(x => x.id === est.sel[d.n]);
  const dd = diaDe(o);
  const desde = baseNombre(o.sale);

  return `
  <section class="sk-parada${elige ? '' : ' sk-parada-fija'}" data-ancla="parada-${d.n}">
    <header class="sk-parada-cab">
      <b>D${d.n}</b>
      <span>${esc(fechaCorta(dd.fecha))}</span>
      <i>${desde ? 'sales de ' + esc(desde) : 'desembarcas'}</i>
      ${elige ? `<em>${posibles.length} caminos</em>` : '<em class="sk-fijo-et">día fijo</em>'}
    </header>
    <div class="sk-fila sk-fila-n${posibles.length}">
      ${posibles.map(x => nodo(d, x, x.id === o.id)).join('')}
    </div>
    ${menores(deDia(variantes, d.n, o.id), deDia(desvios, d.n, o.id), est, colorDia(d, o))}
  </section>`;
}

function nodo(d, o, puesta) {
  const dd = diaDe(o);
  const solo = d.opciones.length === 1;
  const color = colorDia(d, o);
  const r = o.ruta ? datos.RUTA.get(o.ruta) : null;
  const cama = o.duerme ? baseNombre(o.duerme) : 'el ferri';
  return `<div class="sk-col">
    <button type="button" class="sk-nodo sk-elige ${puesta ? 'sk-on' : 'sk-off'}${solo ? ' sk-tronco' : ''}"
            style="--barra:${esc(color)}" aria-pressed="${puesta}"
            data-dia="${d.n}" data-opcion="${esc(o.id)}"${solo ? ' disabled' : ''}>
      <span class="sk-ico">${esc(o.icono)}</span>
      <b>${esc(o.corto)}</b>
      <span class="sk-dias">${dd.km} km · ${minutosAHoras(dd.minutos)}</span>
      <span class="sk-ruta">${solo ? 'igual en las 2' : r ? 'ruta ' + r.numero : 'ni la 1 ni la 2'}</span>
      <span class="sk-cama">☾ ${esc(cama)}</span>
    </button>
  </div>`;
}

/** Lo que cuelga del camino elegido: las variantes, que son decisiones dentro del
 *  día, y los desvíos, que son sitios de más. */
function menores(variantes, desvios, est, color) {
  if (!variantes.length && !desvios.length) return '';
  return `<div class="sk-menores" style="--barra:${esc(color)}">
    ${variantes.map(v => `
      <div class="sk-var">
        <span class="sk-var-t">${esc(v.icono)} ${esc(v.titulo.split(':')[0])}</span>
        <div class="sk-var-ops" role="group" aria-label="${esc(v.titulo)}">
          ${v.opciones.map(o => {
            const puesta = est.vsel[v.id] === o.id;
            const mini = costeMini(o);
            return `<button type="button" class="sk-op ${puesta ? 'sk-on' : ''}"
              data-variante="${esc(v.id)}" data-opcion="${esc(o.id)}" aria-pressed="${puesta}"
              title="${esc(o.nombre)}: ${esc(costeCorto(o))}">
              <b>${esc(o.corto)}</b>${mini ? `<em>${esc(mini)}</em>` : ''}</button>`;
          }).join('')}
        </div>
      </div>`).join('')}
    ${desvios.map(d => {
      const puesto = est.pedidos.has(d.id);
      return `<button type="button" class="sk-menor ${puesto ? 'sk-on' : ''}"
        data-desvio="${esc(d.id)}" aria-pressed="${puesto}"
        title="${esc(d.nombre)}: ${esc(costeCorto(d))}">
        <span class="sk-ico">${esc(d.icono)}</span>
        <span class="sk-menor-t"><b>${esc(d.nombre)}</b><span>${esc(costeMini(d) || 'sin coste')}</span></span>
      </button>`;
    }).join('')}
  </div>`;
}

// ── Los bloques de detalle, dentro de cada jornada ─────────────────────────

/** Los otros caminos posibles de ese día, con lo que ganas y lo que pierdes.
 *  Se puede cambiar desde aquí sin subir al árbol. */
function alternativas(d, est) {
  const posibles = est.abanico[d.n];
  if (posibles.length < 2) return '';
  return `
  <b class="jor-tit">Este día podría ser otro</b>
  <div class="var-ops">
    ${posibles.map(o => {
      const puesta = est.sel[d.n] === o.id;
      const dd = diaDe(o);
      const r = o.ruta ? datos.RUTA.get(o.ruta) : null;
      return `<button type="button" class="var-op ${puesta ? 'var-on' : ''}"
        style="border-left-color:${esc(colorDe(o))}"
        data-dia="${d.n}" data-opcion="${esc(o.id)}" aria-pressed="${puesta}">
        <span class="var-cab">
          <b>${esc(o.icono)} ${esc(o.nombre)}</b>
          <span class="etiq ${puesta ? 'etiq-azul' : 'etiq-gris'}">${puesta ? 'el que llevas' : 'cambiar a este'}</span>
          <span class="etiq etiq-gris">${r ? 'ruta ' + r.numero : 'día nuevo'} · ${dd.km} km · duermes en ${esc(baseNombre(o.duerme) || 'el ferri')}</span>
        </span>
        <span class="var-que">${esc(o.resumen)}</span>
        ${o.gana || o.pierde ? `<span class="op-listas">
          ${(o.gana || []).map(x => `<span class="op-mas">${esc(x)}</span>`).join('')}
          ${(o.pierde || []).map(x => `<span class="op-menos">${esc(x)}</span>`).join('')}
        </span>` : ''}
      </button>`;
    }).join('')}
  </div>`;
}

function bloqueVariante(v, vsel) {
  return `
  <div class="caja caja-var">
    <b class="caja-t">${esc(v.icono)} ${esc(v.titulo)}</b>
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

function bloqueDesvio(d, est) {
  const puesto = est.pedidos.has(d.id);
  return `
  <div class="plato">
    <div class="plato-t">
      <b>${esc(d.icono)} ${esc(d.nombre)}</b>
      <span class="etiq ${puesto ? 'etiq-azul' : 'etiq-gris'}">
        ${puesto ? 'añadido' : 'desvío'} · ${esc(costeCorto(d))}</span>
      <button type="button" class="etiq ${puesto ? 'etiq-rojo' : 'etiq-verde'}"
              style="cursor:pointer" data-desvio="${esc(d.id)}">${puesto ? 'Quitar' : 'Añadir'}</button>
    </div>
    ${d.cuando ? `<p class="peq"><b>Cuándo cae ·</b> ${esc(d.cuando)}</p>` : ''}
    <p>${esc(d.que)}</p>
    ${d.lugar ? figura(d.lugar, { alto: 120, pie: false }) || '' : ''}
  </div>`;
}

// ── El aviso de abajo ──────────────────────────────────────────────────────

/** Lo que la combinación deja fuera y a dónde vuelves, calculado y no escrito. */
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
  cogidos.forEach(x => { if (x.lugar) (cuando[x.lugar] = cuando[x.lugar] || []).push(comoArray(x.dia)[0]); });
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
        Mira si alguno lo recuperas cambiando un día o metiendo un desvío.</p>` : ''}
      ${sinCoger.length ? `<p><b>Te dejas sin coger</b> ${sinCoger.length} desvío${sinCoger.length > 1 ? 's' : ''}
        que cuelga${sinCoger.length > 1 ? 'n' : ''} de los días que llevas, empezando por
        ${sinCoger.slice(0, 3).map(d => esc(d.nombre.split(' y ')[0])).join(', ')}.</p>` : ''}
      ${vuelves.length ? `<p><b>Vuelves a:</b> ${vuelves.map(corto).join(', ')}, después de haber estado y haberte ido.
        No es un error, pero cuéntalo.</p>` : ''}
    </div>`;
}

// ── El itinerario ──────────────────────────────────────────────────────────

/** El hora a hora, con la marca de nivel en las líneas que son una parada de la
 *  cadena. Así se lee de corrido y se sigue viendo qué es lo que se puede soltar. */
function horasDelDia(d) {
  const niveles = nivelDeHora(d);
  return (d.plan || []).map(p => {
    const n = niveles.get(p.hora);
    return `<li${n ? ` class="${NIVELES[n].clase}"` : ''}>
      <time>${esc(p.hora)}</time>
      <span>${n ? `<i class="pa-marca" title="${esc(NIVELES[n].nombre)}">${NIVELES[n].simbolo}</i> ` : ''}${esc(p.que)}</span>
    </li>`;
  }).join('');
}

/** La primera y la última hora del plan del día: a qué hora arrancas y a qué hora
 *  se acaba la jornada. Están en el propio plan, no hacen falta datos nuevos. */
function horas(d) {
  const validas = (d.plan || []).map(p => p.hora).filter(h => /^\d/.test(h));
  if (!validas.length) return null;
  return { salida: validas[0], llegada: validas[validas.length - 1] };
}

/** Todos los sitios del día, los del camino y los del desvío, con su tipo y su
 *  letra pequeña. La descripción sale de lugares.json y no se escribe dos veces. */
function sitiosDelDia(d, extras) {
  const propios = datos.lugaresDeDia(d).map(l => ({ l, desvio: false }));
  const puestos = extras.map(x => datos.lugar(x.lugar)).filter(Boolean).map(l => ({ l, desvio: true }));
  const vistos = new Set();
  return [...propios, ...puestos].filter(({ l }) => !vistos.has(l.id) && vistos.add(l.id));
}

function itinerario(dias, est, cogidos, variantes, desvios, t) {
  const porDia = {};
  cogidos.forEach(d => comoArray(d.dia).forEach(n => (porDia[n] = porDia[n] || []).push(d)));
  const noches = dias.filter(d => d.dormir).length;
  const ratoTotal = [...cogidos, ...variantes.map(v => elegida(v, est.vsel))]
    .reduce((a, x) => a + (x.rato || 0), 0);

  return `
  <div class="tarjeta">
    ${dias.map((d, i) => {
      const nodoDia = DIAS()[i];
      const o = d._opcion;
      const cama = datos.camaDe(d);
      const extras = porDia[nodoDia.n] || [];
      const vars = deDia(variantes, nodoDia.n, o.id);
      const puestos = [...extras, ...vars.map(v => elegida(v, est.vsel))];
      const sumar = campo => puestos.reduce((a, x) => a + (x[campo] || 0), 0);
      const km = d.km + sumar('km');
      const min = d.minutos + sumar('minutos');
      const rato = sumar('rato');
      const h = horas(d);
      const sitios = sitiosDelDia(d, extras);
      const parkings = datos.parkingsDe(d);
      const tpt = datos.minutosTransporte(d);
      const otros = est.abanico[nodoDia.n].length - 1;
      const desviosDia = deDia(desvios, nodoDia.n, o.id);

      return `<details class="jornada" style="--barra:${esc(d._color)}"
               data-n="${nodoDia.n}" data-ancla="jornada-${nodoDia.n}">
        <summary>
          <span class="jor-n"><b>D${nodoDia.n}</b><span>de 11</span></span>
          <span class="jor-t">
            <b>${esc(d.titulo)}</b>
            <span class="jor-fecha">${esc(fechaLarga(d.fecha))}</span>
            <span class="jor-etapa">${esc(d.etapa)}${extras.length ? ' <b>+ ' + extras.map(x => esc(x.nombre)).join(' + ') + '</b>' : ''}</span>
          </span>
          <span class="jor-km">
            <b>${km} km</b>
            <small>${minutosAHoras(min)}</small>
            ${(() => {
              // El aviso de «este día va justo» tiene que verse con la jornada
              // cerrada: si hay que abrir los doce para descubrirlo, no sirve.
              const g = holgura(d);
              return g && g.nivel !== 'holgado'
                ? `<small class="jor-aprieto jor-${g.nivel}">${Math.round(g.parte * 100)} % moviéndote</small>` : '';
            })()}
            ${otros ? `<small class="jor-extra">${otros} camino${otros > 1 ? 's' : ''} más</small>` : ''}
            ${extras.length ? `<small class="jor-extra">+${extras.reduce((a, x) => a + x.km, 0)} desvío</small>` : ''}
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

          ${otros ? alternativas(nodoDia, est) : `<p class="peq jor-porque"><b>Día fijo ·</b> ${esc(nodoDia.porque)}</p>`}

          ${sitios.length ? `<div class="jor-sitios">
            <b class="jor-tit">Los ${sitios.length} sitios de este día</b>
            <ul>${sitios.map(({ l, desvio }) => {
              const tp = datos.LUGARES.tipos[l.tipo];
              return `<li style="--c:${esc(tp.color)}">
                <i>${esc(tp.icono)}</i>
                <span>${esc(l.nombre)}${desvio ? ' <em>desvío</em>' : ''}</span>
                <small>${esc(tp.nombre)}${l.precio ? ' · ' + esc(l.precio) : ''}</small>
                ${l.nota ? `<p>${esc(l.nota)}</p>` : ''}
              </li>`;
            }).join('')}</ul>
          </div>` : ''}

          ${parkings.length ? `<p class="peq"><b>Dejas el coche en</b> ${parkings.map(p =>
            `${esc(p.parking)} (${esc(p.ciudad)}, ${esc(p.precio)}, ${p.minutos_centro} min al centro)`).join(' · ')}</p>` : ''}

          ${cadena(d)}

          <b class="jor-tit">Hora a hora</b>
          <ul class="horas">${horasDelDia(d)}</ul>

          ${vars.map(v => bloqueVariante(v, est.vsel)).join('')}

          ${desviosDia.length ? `<b class="jor-tit">Desvíos posibles este día</b>
            <div class="jor-desvios">${desviosDia.map(x => bloqueDesvio(x, est)).join('')}</div>` : ''}

          ${d.aviso ? `<div class="caja caja-ojo"><b class="caja-t">Ojo</b>${esc(d.aviso)}</div>` : ''}
          ${d.apretado ? `<div class="caja caja-ojo"><b class="caja-t">Día apretado</b>${esc(d.apretado)}</div>` : ''}
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
