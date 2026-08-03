// El árbol de decisiones: mezclar las rutas 1 y 2.
//
// Las dos rutas no son dos viajes distintos, son el mismo que se abre y se vuelve
// a cerrar tres veces: comprobado día a día, solo duermen en sitio distinto las
// noches del D2 y del D5. En cada bifurcación las dos ramas salen del mismo sitio
// y acaban en el mismo sitio, así que cualquier combinación cuadra sin tocar nada.
// Son 2×2×2 = 8 viajes posibles, más los desvíos.
//
// Nada de esto duplica datos: los días se sacan de rutas.json, y arbol.json solo
// dice qué días forman cada rama. Si mañana cambia un día, cambia aquí solo.

import * as datos from '../datos.js';
import { esc, fechaCorta, minutosAHoras, numero, euros } from '../util.js';
import { figura } from '../fotos.js';
import { ir } from '../app.js';

/** Día n de una ruta. Por posición no, por su número: es lo que dice el dato. */
const dia = (idRuta, n) => datos.RUTA.get(idRuta).dias.find(d => d.n === n);

/** Las bifurcaciones, en orden. */
const bifurcaciones = () => datos.ARBOL.tramos.filter(t => t.tipo === 'bifurcacion');

/** Lee la elección de la URL, con la primera opción de cada rama por defecto. */
function eleccion(params) {
  const sel = {};
  for (const b of bifurcaciones()) {
    const pedido = params.get(b.id);
    sel[b.id] = b.opciones.some(o => o.id === pedido) ? pedido : b.opciones[0].id;
  }
  const desvios = new Set((params.get('d') || '').split(',').filter(Boolean));
  return { sel, desvios };
}

/** Compone el viaje entero: los doce días, ya elegidos, en orden. */
function componer(sel) {
  const dias = [];
  for (const t of datos.ARBOL.tramos) {
    const idRuta = t.tipo === 'tronco' ? t.ruta : t.opciones.find(o => o.id === sel[t.id]).ruta;
    for (const n of t.dias) dias.push({ ...dia(idRuta, n), _ruta: idRuta, _tramo: t.id });
  }
  return dias.sort((a, b) => a.n - b.n);
}

/** Los desvíos que se pueden coger con la elección actual. */
function desviosPosibles(sel) {
  return datos.ARBOL.desvios.filter(d => sel[d.tramo] === d.opcion);
}

function total(dias, desviosElegidos) {
  const t = dias.reduce((a, d) => ({
    km: a.km + d.km, min: a.min + d.minutos, eur: a.eur + d.coste_dia
  }), { km: 0, min: 0, eur: 0 });
  for (const d of desviosElegidos) { t.km += d.km; t.min += d.minutos; t.eur += d.coste || 0; }
  return t;
}

export function pintar(main, params) {
  const { sel, desvios } = eleccion(params);
  const dias = componer(sel);
  const posibles = desviosPosibles(sel);
  const cogidos = posibles.filter(d => desvios.has(d.id));
  const t = total(dias, cogidos);
  const rutas = datos.ARBOL.rutas.map(id => datos.RUTA.get(id));

  main.innerHTML = `
    <p class="intro">${esc(datos.ARBOL.intro)}</p>
    <div class="caja caja-info">${esc(datos.ARBOL.explica)}</div>

    ${cifras(t, sel, cogidos, rutas)}

    <h2 class="seccion">El árbol</h2>
    <div class="arbol">
      ${datos.ARBOL.tramos.map(tr => tr.tipo === 'tronco'
        ? tronco(tr)
        : bifurcacion(tr, sel, desvios)).join('')}
    </div>

    ${sobras(dias, cogidos)}

    <h2 class="seccion">Tu viaje, día a día</h2>
    ${itinerario(dias, cogidos, t)}
  `;

  main.querySelectorAll('[data-elige]').forEach(b => {
    b.addEventListener('click', () => {
      const q = nuevaURL(sel, desvios, { rama: b.dataset.elige, opcion: b.dataset.opcion });
      ir('mezclar', q);
    });
  });
  main.querySelectorAll('[data-desvio]').forEach(b => {
    b.addEventListener('click', () => {
      const q = nuevaURL(sel, desvios, { desvio: b.dataset.desvio });
      ir('mezclar', q);
    });
  });
}

/** Construye la URL nueva a partir de la actual y de lo que se acaba de tocar. */
function nuevaURL(sel, desvios, cambio) {
  const s = { ...sel };
  const d = new Set(desvios);
  if (cambio.rama) {
    s[cambio.rama] = cambio.opcion;
    // Los desvíos cuelgan de una opción concreta: al cambiar de rama, los que
    // ya no existen se caen solos.
    for (const x of datos.ARBOL.desvios) if (x.tramo === cambio.rama && x.opcion !== cambio.opcion) d.delete(x.id);
  }
  if (cambio.desvio) d.has(cambio.desvio) ? d.delete(cambio.desvio) : d.add(cambio.desvio);

  const q = new URLSearchParams(s);
  if (d.size) q.set('d', [...d].join(','));
  return q;
}

function cifras(t, sel, cogidos, rutas) {
  // ¿Coincide con una de las dos rutas de serie, o es una mezcla?
  const puras = rutas.filter(r => bifurcaciones().every(b =>
    b.opciones.find(o => o.id === sel[b.id]).ruta === r.id));
  const cual = cogidos.length ? null : puras[0];

  return `
  <div class="tarjeta">
    <div class="cab-tarjeta">
      <h3>Tu combinación</h3>
      ${cual
        ? `<span class="etiq etiq-verde" style="--barra:${esc(cual.color)}">Es la ruta ${cual.numero} tal cual</span>`
        : '<span class="etiq etiq-ambar">Mezcla propia</span>'}
      ${cogidos.length ? `<span class="etiq etiq-azul">${cogidos.length} ${cogidos.length === 1 ? 'desvío' : 'desvíos'}</span>` : ''}
    </div>
    <div class="cifras">
      <div><b>${numero(t.km)}</b><span>kilómetros</span></div>
      <div><b>${minutosAHoras(t.min)}</b><span>al volante</span></div>
      <div><b>${euros(t.eur)}</b><span>estimado</span></div>
      <div><b>${bifurcaciones().length}</b><span>bifurcaciones</span></div>
    </div>
  </div>`;
}

function tronco(tr) {
  const dias = tr.dias.map(n => dia(tr.ruta, n));
  return `
  <div class="rama-tronco">
    <div class="tronco-c">
      <h3>${esc(tr.titulo)}</h3>
      <p class="peq">${esc(tr.nota)}</p>
      <ul class="tronco-dias">${dias.map(d => `
        <li><b>D${d.n}</b> <span>${esc(fechaCorta(d.fecha))}</span> ${esc(d.etapa)}
          <em>${d.km} km</em></li>`).join('')}</ul>
    </div>
  </div>`;
}

function bifurcacion(tr, sel, desvios) {
  return `
  <div class="rama-corte">
    <div class="corte-c">
      <h3>${esc(tr.titulo)}</h3>
      <p class="peq">${esc(tr.desde)}. <b>${esc(tr.hasta)}.</b></p>
      <div class="ramas">${tr.opciones.map(o => opcion(tr, o, sel, desvios)).join('')}</div>
    </div>
  </div>`;
}

function opcion(tr, o, sel, desvios) {
  const elegida = sel[tr.id] === o.id;
  const r = datos.RUTA.get(o.ruta);
  const dias = tr.dias.map(n => dia(o.ruta, n));
  const km = dias.reduce((a, d) => a + d.km, 0);
  const min = dias.reduce((a, d) => a + d.minutos, 0);
  const misDesvios = datos.ARBOL.desvios.filter(d => d.tramo === tr.id && d.opcion === o.id);

  return `
  <div class="rama ${elegida ? 'rama-on' : ''}" style="--barra:${esc(r.color)}">
    <button type="button" class="rama-b" data-elige="${esc(tr.id)}" data-opcion="${esc(o.id)}"
            aria-pressed="${elegida}">
      <span class="rama-t">
        <b>${esc(o.nombre)}</b>
        <span class="peq">De la ruta ${r.numero}</span>
      </span>
      <span class="rama-km">${km} km<br><small>${minutosAHoras(min)}</small></span>
    </button>
    <div class="rama-c">
      <p>${esc(o.resumen)}</p>
      <ul class="tronco-dias">${dias.map(d => `
        <li><b>D${d.n}</b> <span>${esc(fechaCorta(d.fecha))}</span> ${esc(d.etapa)}
          <em>${d.km} km</em></li>`).join('')}</ul>
      <div class="listas" style="margin-top:10px">
        <div><ul class="gana">${o.gana.map(x => `<li><span>${esc(x)}</span></li>`).join('')}</ul></div>
        <div><ul class="pierde">${o.pierde.map(x => `<li><span>${esc(x)}</span></li>`).join('')}</ul></div>
      </div>
      ${elegida && misDesvios.length ? `
        <div class="desvios">
          <b class="desvios-t">Desvíos que puedes añadir por aquí</b>
          ${misDesvios.map(d => desvio(d, desvios.has(d.id))).join('')}
        </div>` : ''}
    </div>
  </div>`;
}

function desvio(d, puesto) {
  return `
  <button type="button" class="desvio ${puesto ? 'desvio-on' : ''}"
          data-desvio="${esc(d.id)}" aria-pressed="${puesto}">
    <span class="desvio-v" aria-hidden="true">${puesto ? '✓' : '+'}</span>
    <span class="desvio-t">
      <b>${esc(d.nombre)}</b>
      <span class="peq">D${d.dia} · +${d.km} km · +${minutosAHoras(d.minutos)}${d.coste ? ' · +' + euros(d.coste) : ''}</span>
      <span class="desvio-q">${esc(d.que)}</span>
    </span>
    ${figura(d.lugar, { alto: 74, pie: false }) || ''}
  </button>`;
}

/** Lo que la combinación deja fuera y lo que repite. Se calcula comparando con
 *  todo lo que tienen entre las dos rutas: así el aviso no hay que mantenerlo. */
function sobras(dias, cogidos) {
  const visitados = new Set(dias.flatMap(d => d.lugares || []));
  cogidos.forEach(d => visitados.add(d.lugar));

  const todo = new Set(datos.ARBOL.rutas.flatMap(id =>
    datos.RUTA.get(id).dias.flatMap(d => d.lugares || [])));
  datos.ARBOL.desvios.forEach(d => todo.add(d.lugar));

  const fuera = [...todo].filter(id => !visitados.has(id))
    .map(id => datos.lugar(id)).filter(l => l && l.tipo !== 'aparcar');

  // Repetidos: un sitio que sale en dos días distintos del viaje compuesto.
  const cuenta = {};
  dias.forEach(d => (d.lugares || []).forEach(id => { cuenta[id] = (cuenta[id] || 0) + 1; }));
  cogidos.forEach(d => { cuenta[d.lugar] = (cuenta[d.lugar] || 0) + 1; });
  const repes = Object.entries(cuenta).filter(([id, n]) => n > 1 && datos.lugar(id))
    .map(([id]) => datos.lugar(id))
    .filter(l => !['bracciano', 'la-spezia', 'villa-costanza', 'civitavecchia', 'saturnia'].includes(l.id));

  if (!fuera.length && !repes.length) return '';
  return `
    <div class="caja caja-ojo" style="margin-top:14px">
      <b class="caja-t">Con esta combinación…</b>
      ${fuera.length ? `<p><b>Te dejas fuera:</b> ${fuera.map(l => esc(l.nombre.split('·')[0].trim())).join(', ')}.
        Mira si alguno lo puedes recuperar con un desvío de los de arriba.</p>` : ''}
      ${repes.length ? `<p><b>Repites:</b> ${repes.map(l => esc(l.nombre.split('·')[0].trim())).join(', ')}
        en más de un día. No es un error, pero cuéntalo.</p>` : ''}
    </div>`;
}

function itinerario(dias, cogidos, t) {
  const porDia = {};
  cogidos.forEach(d => (porDia[d.dia] = porDia[d.dia] || []).push(d));

  return `
  <div class="tarjeta">
    ${dias.map(d => {
      const cama = datos.camaDe(d);
      const extras = porDia[d.n] || [];
      const r = datos.RUTA.get(d._ruta);
      const km = d.km + extras.reduce((a, x) => a + x.km, 0);
      return `<div class="mez-dia" style="--barra:${esc(r.color)}">
        <span class="mez-n"><b>D${d.n}</b>${esc(fechaCorta(d.fecha))}</span>
        <span class="mez-t">
          <b>${esc(d.titulo)}</b>
          <span class="peq">${esc(d.etapa)}${extras.length ? ' + ' + extras.map(x => esc(x.nombre)).join(' + ') : ''}</span>
          <span class="peq">Duermes en ${cama ? esc(cama.nombre.split('·')[0].trim()) : 'el ferri'}</span>
        </span>
        <span class="mez-km"><b>${km} km</b>${extras.length ? `<small>+${extras.reduce((a,x)=>a+x.km,0)} de desvío</small>` : ''}</span>
      </div>`;
    }).join('')}
    <div class="mez-total">
      <b>Total</b>
      <span>${numero(t.km)} km · ${minutosAHoras(t.min)} al volante · ${euros(t.eur)} estimados</span>
    </div>
  </div>`;
}
