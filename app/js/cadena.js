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

const enMinutos = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };

/** Cuánto del día se te va solo en llegar a los sitios.
 *
 *  Es lo que decide si un día se disfruta o se sufre, y no se ve en los
 *  kilómetros: 200 km de autopista de una sentada molestan menos que 100 con
 *  tres paradas y dos aparcamientos lejos del centro. Así que se cuenta la
 *  jornada entera, de la primera hora del plan a la última, y de ahí se separa
 *  lo que es moverse —volante más el ir y volver del transporte urbano, que ya
 *  está medido puerta a puerta en aparcar.json— de lo que queda para ver cosas.
 *
 *  Todo lo que entra aquí son datos duros: horas del plan, minutos de carretera
 *  y minutos de transporte. Nada de estimar cuánto se tarda en ver una iglesia. */
export function holgura(dia) {
  const horas = (dia.plan || []).map(p => p.hora).filter(h => /^\d/.test(h));
  if (horas.length < 2) return null;

  let ventana = enMinutos(horas[horas.length - 1]) - enMinutos(horas[0]);
  if (ventana < 0) ventana += 1440;                       // el día que acaba pasada la medianoche
  if (ventana < 60) return null;                          // el desembarco no es una jornada

  const transporte = datos.minutosTransporte(dia);
  const moverse = (dia.minutos || 0) + transporte;
  const parte = moverse / ventana;

  // Un tercio del día metido en el coche es el punto en el que la jornada deja
  // de ser una visita y pasa a ser un traslado con paradas.
  const nivel = parte > 0.34 ? 'justo' : parte > 0.22 ? 'ajustado' : 'holgado';

  return { ventana, moverse, transporte, ver: ventana - moverse, parte, nivel };
}

const RESPIRO = {
  justo: { clase: 'ho-justo', texto: 'Más de un tercio del día se va en carretera y transporte' },
  ajustado: { clase: 'ho-ajustado', texto: 'Un cuarto del día se va en llegar a los sitios' },
  holgado: { clase: 'ho-holgado', texto: 'Casi todo el día es para ver cosas' }
};

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
  const g = holgura(dia);

  return `
  <div class="cadena">
    <b class="jor-tit">La ruta del día, en orden</b>
    ${g ? `<div class="holgura ${RESPIRO[g.nivel].clase}">
      <b>${esc(RESPIRO[g.nivel].texto)}</b>
      <span><i>Jornada</i>${minutosAHoras(g.ventana)}</span>
      <span><i>Moviéndote</i>${minutosAHoras(g.moverse)} <small>${Math.round(g.parte * 100)} %</small></span>
      <span><i>Para ver cosas</i>${minutosAHoras(g.ver)}</span>
    </div>` : ''}
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
