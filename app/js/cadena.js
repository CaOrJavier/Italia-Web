// La cadena de paradas de un día: el orden en que se hacen las cosas y, en cada
// una, si se puede soltar.
//
// La idea es la de una ruta de navegador: una lista ordenada de puntos. Lo que se
// le añade es el nivel, que responde a la pregunta que de verdad te haces a las
// dos de la tarde cuando ves que vas tarde: ¿qué quito?
//
//   ◉  no lo sueltes    es el motivo del día; si te lo saltas, el día pierde el sentido
//   ◐  recórtalo        se puede ver en la mitad de tiempo, o cambiarlo por algo más corto
//   ✂  suéltalo         lo primero que se cae; ahí está el colchón del día
//
// Los tres símbolos no se pisan con los de los tipos de lugar (★ ☾ P ▲ ≈ ◡), que van
// pegados al nombre: si el mismo dibujo significara dos cosas en la misma línea, no
// se leería ninguna de las dos.
//
// Los minutos de cada parada no son un cronómetro, son el reparto previsto: sirven
// para saber cuánto ganas soltando algo. Y las horas no se inventan, son las del
// plan del día: cada parada apunta a la suya, así que la descripción larga vive en
// un solo sitio y esto es solo la capa de encima.

import * as datos from './datos.js';
import { esc, minutosAHoras } from './util.js';

export const NIVELES = {
  1: { simbolo: '◉', nombre: 'No lo sueltes', clase: 'pa-1' },
  2: { simbolo: '◐', nombre: 'Recortable', clase: 'pa-2' },
  3: { simbolo: '✂', nombre: 'Suéltalo si vas tarde', clase: 'pa-3' }
};

/** El nombre de una parada: el del lugar si lo tiene, y si no el suyo propio.
 *  Va entero, sin recortar por el «·»: en un mismo día pueden caer tres paradas
 *  de la misma ciudad y «Florencia, Florencia y Florencia» no dice nada. */
function nombreDe(p) {
  const l = p.lugar ? datos.lugar(p.lugar) : null;
  return l ? l.nombre : p.nombre;
}

/** Lo que ganas soltando lo soltable de un día, para el que va tarde. */
export function colchon(dia) {
  const sueltas = (dia.paradas || []).filter(p => p.nivel === 3);
  return { sueltas, minutos: sueltas.reduce((t, p) => t + (p.dura || 0), 0) };
}

/** El nivel de una hora del plan, para marcar la línea que le toca. */
export function nivelDeHora(dia) {
  const m = new Map();
  (dia.paradas || []).forEach(p => m.set(p.hora, p.nivel));
  return m;
}

/** La cadena entera: las paradas en orden, con su hora, su rato y su símbolo. */
export function cadena(dia) {
  const paradas = dia.paradas || [];
  if (!paradas.length) return '';
  const c = colchon(dia);

  return `
  <div class="cadena">
    <b class="jor-tit">La ruta del día, en orden</b>
    <ol class="cadena-l">
      ${paradas.map(p => {
        const n = NIVELES[p.nivel];
        const l = p.lugar ? datos.lugar(p.lugar) : null;
        const tp = l ? datos.LUGARES.tipos[l.tipo] : null;
        return `<li class="${n.clase}">
          <span class="pa-hora">${esc(p.hora)}</span>
          <span class="pa-marca" title="${esc(n.nombre)}">${n.simbolo}</span>
          <span class="pa-n">
            ${tp ? `<i style="color:${esc(tp.color)}">${esc(tp.icono)}</i>` : ''}
            <b>${esc(nombreDe(p))}</b>
            ${p.dura ? `<em>${minutosAHoras(p.dura)}</em>` : ''}
            ${p.salta ? `<span class="pa-salta">${esc(p.salta)}</span>` : ''}
          </span>
        </li>`;
      }).join('')}
    </ol>
    ${c.sueltas.length ? `<p class="cadena-pie">
      <b>¿Vas tarde?</b> Suelta ${c.sueltas.map(p => esc(nombreDe(p))).join(' y ')}
      y recuperas <b>${minutosAHoras(c.minutos)}</b>. Lo de arriba está en orden de
      llegada, así que si sales antes de una parada, la siguiente se adelanta sola.</p>`
      : `<p class="cadena-pie"><b>Este día no tiene colchón:</b> todas las paradas son
      del día, así que si vas tarde lo que se recorta es el rato de cada una.</p>`}
  </div>`;
}
