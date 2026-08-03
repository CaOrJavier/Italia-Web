// Las marcas de diferencia: un símbolo y un color por sitio según en cuántas
// rutas sale.
//
//   ●  verde    en las dos      → esto lo ves elijas lo que elijas
//   ◐  ámbar    solo desvío     → no está en ninguna ruta de serie
//   ★  color de la ruta   solo en una  → aquí es donde se decide
//
// El símbolo va siempre acompañado de texto, porque un color solo no vale: hay
// gente que no distingue el rojo del verde, y a pleno sol el móvil tampoco.

import * as datos from './datos.js';
import { esc } from './util.js';

/** La marca de un lugar. `largo` añade el texto completo; si no, solo el símbolo. */
export function marca(l, { largo = false } = {}) {
  const e = datos.exclusividadDe(l);
  const titulo = e.clave === 'solo' && e.ruta
    ? `Solo en la ruta ${e.ruta.numero}: ${e.ruta.nombre}`
    : `${e.nombre} (${e.cuantas} de ${e.total})`;
  return `<span class="marca marca-${e.clave}" style="--m:${esc(e.color)}" title="${esc(titulo)}">
    <span class="marca-s" aria-hidden="true">${esc(e.simbolo)}</span>
    <span class="${largo ? '' : 'oculto'}">${esc(largo ? titulo : e.corto)}</span>
  </span>`;
}

/** Resumen de un día: cuántos de sus sitios son exclusivos de esa ruta. */
export function marcaDia(dia) {
  const lugares = datos.lugaresDeDia(dia);
  if (!lugares.length) return '';
  const solos = lugares.filter(l => datos.exclusividadDe(l).clave === 'solo');
  if (!solos.length) return '';
  const e = datos.exclusividadDe(solos[0]);
  return `<span class="marca marca-solo" style="--m:${esc(e.color)}"
    title="${esc(solos.length)} ${solos.length === 1 ? 'sitio que no ves' : 'sitios que no ves'} en ninguna otra ruta: ${esc(solos.map(l => l.nombre).join(', '))}">
    <span class="marca-s" aria-hidden="true">★</span><span>${solos.length}</span></span>`;
}

/** La tira de sitios de un día, con su marca. Es el menú del día. */
export function tiraLugares(dia) {
  const lugares = datos.lugaresDeDia(dia);
  if (!lugares.length) return '';
  return `<ul class="tira">${lugares.map(l => {
    const e = datos.exclusividadDe(l);
    const t = datos.LUGARES.tipos[l.tipo];
    return `<li class="tira-i marca-${e.clave}" style="--m:${esc(e.color)};--c:${esc(t.color)}">
      <span class="marca-s" aria-hidden="true">${esc(e.simbolo)}</span>
      <span class="tira-n">${esc(l.nombre)}</span>
      <span class="tira-t">${esc(t.nombre)}</span>
    </li>`;
  }).join('')}</ul>`;
}

/** La leyenda. Sin esto las marcas son adivinanzas. */
export function leyenda() {
  const ex = datos.LUGARES.exclusividad;
  return `<div class="leyenda">
    <b>Cómo leer las marcas</b>
    <ul>${['todas', 'algunas', 'solo'].map(k => `
      <li class="marca-${k}" style="--m:${esc(ex[k].color)}">
        <span class="marca-s" aria-hidden="true">${esc(ex[k].simbolo)}</span>
        <span><b>${esc(ex[k].nombre)}.</b> ${esc(ex[k].explica)}</span>
      </li>`).join('')}</ul>
    <p class="peq">Las estrellas van del color de la ruta a la que pertenecen.</p>
  </div>`;
}
