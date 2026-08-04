// La ruta a medida: los doce días, y encima lo que se le puede añadir o cambiar.
//
// Esto fue un árbol de decisiones mientras hubo dos rutas que mezclar. Ya no las
// hay: el itinerario está cerrado y lo que queda son dos maneras de tocarlo sin
// mover ni una noche.
//
//   variantes  decisiones dentro de un día que ya está. En qué te gastas la
//              entrada de Florencia, qué tarjeta compras en Cinque Terre, si
//              entras al Coliseo. No cambian adónde vas, solo el bolsillo y el
//              reloj. Siempre hay una puesta.
//   desvíos    un sitio de más, con sus kilómetros y su rato aparte. Se encienden
//              y se apagan, y los que llevan un lugar que ya pisas ese viaje no
//              se ofrecen: así no se puede pagar un desvío por algo que ya tienes.
//
// Todo el estado cabe en la URL, así que un plan concreto se comparte con un
// enlace. Y como cada clic repinta la vista entera, se guarda qué días tenías
// abiertos y por dónde ibas mirando, que si no la página pega un salto.

import * as datos from '../datos.js';
import { esc, fechaLarga, minutosAHoras, numero, euros, comoArray } from '../util.js';
import { figura } from '../fotos.js';
import { cadena, nivelDeHora, holgura, NIVELES } from '../cadena.js';
import { ir } from '../app.js';

const RUTA = () => datos.RUTAS.rutas[0];

// ── Lo que sobrevive al repintado ──────────────────────────────────────────

const abiertos = new Set();
let ancla = null;

/** Apunta dónde está ahora mismo el bloque que contiene lo que se acaba de pulsar. */
function anclar(el) {
  const caja = el.closest('[data-ancla]');
  ancla = caja ? { clave: caja.dataset.ancla, top: caja.getBoundingClientRect().top } : null;
}

/** Y lo devuelve a su sitio, ya con el contenido nuevo puesto. */
function desanclar(main) {
  if (!ancla) return;
  const caja = main.querySelector(`[data-ancla="${CSS.escape(ancla.clave)}"]`);
  if (caja) scrollBy(0, Math.round(caja.getBoundingClientRect().top - ancla.top));
  ancla = null;
}

// ── Estado ─────────────────────────────────────────────────────────────────

function estado(params) {
  const vsel = {};
  for (const v of datos.EXTRAS.variantes) {
    const pedido = params.get(v.id);
    vsel[v.id] = v.opciones.some(o => o.id === pedido) ? pedido : v.opciones[0].id;
  }
  const pedidos = new Set((params.get('x') || '').split(',').filter(Boolean));
  return { vsel, pedidos, params };
}

const elegida = (v, vsel) => v.opciones.find(o => o.id === vsel[v.id]);

/** Qué se puede tocar ahora mismo. La regla que se lleva casi todo el trabajo de
 *  mantenimiento: un desvío a un sitio que ya pisas ese viaje no se ofrece. */
function abierto({ vsel, pedidos }) {
  const visitados = new Set(RUTA().dias.flatMap(d => d.lugares || []));
  const variantes = datos.EXTRAS.variantes;
  const vivas = new Set(variantes.map(v => v.id));
  const desvios = datos.EXTRAS.desvios.filter(d =>
    !(d.lugar && visitados.has(d.lugar)) &&
    (!d.requiere || !d.requiere.variante ||
      (vivas.has(d.requiere.variante) && vsel[d.requiere.variante] === d.requiere.opcion)));
  return { variantes, desvios, cogidos: desvios.filter(d => pedidos.has(d.id)) };
}

const deDia = (lista, n) => lista.filter(x => comoArray(x.dia).includes(n));

/** El total: la ruta, más lo que suman variantes y desvíos. Las variantes pueden
 *  restar: una tarjeta más barata, una entrada que al final no sacas. */
function total(cogidos, variantes, vsel) {
  const r = RUTA();
  const t = { km: r.km, min: r.minutos_volante, eur: r.coste_estimado, rato: 0 };
  const suma = x => {
    t.km += x.km || 0; t.min += x.minutos || 0;
    t.eur += x.coste || 0; t.rato += x.rato || 0;
  };
  cogidos.forEach(suma);
  variantes.map(v => elegida(v, vsel)).forEach(suma);
  return t;
}

// ── Números con signo ──────────────────────────────────────────────────────

const conSigno = (n, sufijo) => `${n > 0 ? '+' : '−'}${numero(Math.abs(n))} ${sufijo}`;

/** Lo que cuesta meter algo, con las tres monedas separadas. Los kilómetros y el
 *  volante son una cosa y el rato que te come el sitio es otra: mezclarlos hacía
 *  mentir al reloj del día, que Fiesole son tres horas y ni un kilómetro. */
function coste(x) {
  const partes = [];
  if (x.km) partes.push(conSigno(x.km, 'km'));
  if (x.minutos) partes.push(`${x.minutos > 0 ? '+' : '−'}${minutosAHoras(Math.abs(x.minutos))} de coche`);
  if (x.rato) partes.push(`${minutosAHoras(x.rato)} allí`);
  if (x.coste) partes.push(conSigno(x.coste, '€'));
  return partes.length ? partes.join(' · ') : null;
}

const costeCorto = x => coste(x) || 'sin coste';

// ── Pintado ────────────────────────────────────────────────────────────────

export function pintar(main, params) {
  const est = estado(params);
  const { variantes, desvios, cogidos } = abierto(est);
  const t = total(cogidos, variantes, est.vsel);

  main.innerHTML = `
    <p class="intro">${esc(datos.EXTRAS.intro)}</p>
    ${panel(t, cogidos, desvios, variantes, est.vsel)}
    <p class="intro">${esc(datos.EXTRAS.explica)}</p>
    ${leyenda()}

    ${sobras(cogidos, desvios)}

    <div class="cab-seccion">
      <h2 class="seccion">Los doce días</h2>
      <button type="button" id="abrir-todo" class="etiq etiq-gris"
              style="cursor:pointer;min-height:32px;padding:7px 12px">Abrir los 12 días</button>
    </div>
    ${itinerario(est, cogidos, variantes, desvios, t)}
  `;

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
    ir('medida', nuevaURL(est, cambio));
  });
  main.querySelectorAll('[data-variante]').forEach(b =>
    navegar(b, { variante: b.dataset.variante, opcion: b.dataset.opcion }));
  main.querySelectorAll('[data-desvio]').forEach(b =>
    navegar(b, { desvio: b.dataset.desvio }));

  const reset = main.querySelector('#reiniciar');
  if (reset) reset.addEventListener('click', () => { ancla = null; ir('medida', new URLSearchParams()); });

  desanclar(main);
}

/** La URL nueva después de tocar algo. Los desvíos se recalculan: si al cambiar
 *  una variante alguno deja de estar disponible, se cae solo. */
function nuevaURL(est, cambio) {
  const q = new URLSearchParams(est.params);
  if (cambio.variante) q.set(cambio.variante, cambio.opcion);

  const pedidos = new Set(est.pedidos);
  if (cambio.desvio) pedidos.has(cambio.desvio) ? pedidos.delete(cambio.desvio) : pedidos.add(cambio.desvio);

  const nuevo = estado(q);
  const { cogidos } = abierto({ ...nuevo, pedidos });
  q.delete('x');
  if (cogidos.length) q.set('x', cogidos.map(d => d.id).join(','));
  return q;
}

/** La barra de arriba: los totales de la ruta con lo que le hayas añadido. */
function panel(t, cogidos, desvios, variantes, vsel) {
  const r = RUTA();
  const tocadas = variantes.filter(v => vsel[v.id] !== v.opciones[0].id).length;
  const limpia = !cogidos.length && !tocadas;
  const extra = t.km - r.km;

  return `
  <div class="ficha-arbol">
    <div class="ficha-stats">
      <div><b>${numero(t.km)}</b><span>km</span></div>
      <div><b>${minutosAHoras(t.min)}</b><span>volante</span></div>
      <div><b>${euros(t.eur)}</b><span>coste</span></div>
      <div><b>${cogidos.length}<small>/${desvios.length}</small></b><span>desvíos</span></div>
    </div>
    <div class="ficha-pie">
      ${limpia
        ? '<span class="etiq etiq-verde">La ruta tal cual, sin añadidos</span>'
        : `<span class="etiq etiq-ambar">${[
            cogidos.length ? `${cogidos.length} desvío${cogidos.length > 1 ? 's' : ''}` : '',
            tocadas ? `${tocadas} variante${tocadas > 1 ? 's' : ''} cambiada${tocadas > 1 ? 's' : ''}` : ''
          ].filter(Boolean).join(' · ')}</span>`}
      ${extra ? `<span class="etiq etiq-gris">+${numero(extra)} km sobre el plan</span>` : ''}
      ${t.rato ? `<span class="etiq etiq-gris">+${minutosAHoras(t.rato)} de paradas</span>` : ''}
      <button type="button" id="reiniciar" class="etiq etiq-gris"
              style="cursor:pointer;min-height:32px;padding:7px 12px">Reiniciar</button>
    </div>
  </div>`;
}

function leyenda() {
  return `<ul class="sk-leyenda">${datos.EXTRAS.leyenda.map(l => `
    <li><i>${esc(l.icono)}</i><span><b>${esc(l.nombre)}</b> ${esc(l.que)}</span></li>`).join('')}</ul>`;
}

// ── Los bloques de una jornada ─────────────────────────────────────────────

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

// ── El aviso de arriba ─────────────────────────────────────────────────────

function sobras(cogidos, desvios) {
  const sinCoger = desvios.filter(d => !cogidos.includes(d));
  const km = cogidos.reduce((t, d) => t + (d.km || 0), 0);
  if (!sinCoger.length && !cogidos.length) return '';
  return `
    <div class="caja caja-ojo">
      <b class="caja-t">Sobre la ruta de serie…</b>
      ${cogidos.length ? `<p><b>Llevas añadido:</b> ${cogidos.map(d => esc(d.nombre)).join(', ')}.
        Son ${numero(km)} km de más, y el rato sale de las horas de ese día y no de ningún sitio mágico:
        mira la ruta de la jornada para ver qué sueltas a cambio.</p>` : ''}
      ${sinCoger.length ? `<p><b>Tienes a mano</b> ${sinCoger.length} desvío${sinCoger.length > 1 ? 's' : ''} sin coger,
        empezando por ${sinCoger.slice(0, 3).map(d => esc(d.nombre.split(' y ')[0])).join(', ')}.
        Cada uno está dentro de su día.</p>` : ''}
    </div>`;
}

// ── El itinerario ──────────────────────────────────────────────────────────

function horas(d) {
  const validas = (d.plan || []).map(p => p.hora).filter(h => /^\d/.test(h));
  if (!validas.length) return null;
  return { salida: validas[0], llegada: validas[validas.length - 1] };
}

/** El hora a hora, con la marca de nivel en las líneas que son una parada. */
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

/** Todos los sitios del día, los del plan y los del desvío, con su letra pequeña.
 *  La descripción sale de lugares.json y no se escribe dos veces. */
function sitiosDelDia(d, extras) {
  const propios = datos.lugaresDeDia(d).map(l => ({ l, desvio: false }));
  const puestos = extras.map(x => datos.lugar(x.lugar)).filter(Boolean).map(l => ({ l, desvio: true }));
  const vistos = new Set();
  return [...propios, ...puestos].filter(({ l }) => !vistos.has(l.id) && vistos.add(l.id));
}

function itinerario(est, cogidos, variantes, desvios, t) {
  const r = RUTA();
  const porDia = {};
  cogidos.forEach(d => comoArray(d.dia).forEach(n => (porDia[n] = porDia[n] || []).push(d)));
  const noches = r.dias.filter(d => d.dormir).length;

  return `
  <div class="tarjeta">
    ${r.dias.map(d => {
      const cama = datos.camaDe(d);
      const extras = porDia[d.n] || [];
      const vars = deDia(variantes, d.n);
      const puestos = [...extras, ...vars.map(v => elegida(v, est.vsel))];
      const sumar = campo => puestos.reduce((a, x) => a + (x[campo] || 0), 0);
      const km = d.km + sumar('km');
      const min = d.minutos + sumar('minutos');
      const rato = sumar('rato');
      const h = horas(d);
      const sitios = sitiosDelDia(d, extras);
      const parkings = datos.parkingsDe(d);
      const tpt = datos.minutosTransporte(d);
      const g = holgura(d);
      const desviosDia = deDia(desvios, d.n);

      return `<details class="jornada" style="--barra:${esc(r.color)}"
               data-n="${d.n}" data-ancla="jornada-${d.n}">
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
            ${g && g.nivel !== 'holgado'
              ? `<small class="jor-aprieto jor-${g.nivel}">${Math.round(g.parte * 100)} % moviéndote</small>` : ''}
            ${desviosDia.length ? `<small class="jor-extra">${extras.length}/${desviosDia.length} desvío${desviosDia.length > 1 ? 's' : ''}</small>` : ''}
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

          ${cadena(d)}

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

          <b class="jor-tit">Hora a hora</b>
          <ul class="horas">${horasDelDia(d)}</ul>

          ${vars.map(v => bloqueVariante(v, est.vsel)).join('')}

          ${desviosDia.length ? `<b class="jor-tit">Desvíos de este día</b>
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
        ${r.dias.length} días y ${noches} noches${t.rato ? ` · ${minutosAHoras(t.rato)} de paradas añadidas` : ''}</span>
    </div>
  </div>`;
}
