// La tira de sitios de un día.
//
// Cuando había dos rutas, cada sitio llevaba una marca que decía en cuántas
// salía, y esa era la información importante: qué perdías eligiendo. Con una
// sola ruta eso desaparece —lo que está en el plan, está— y lo único que queda
// por distinguir es el tipo de sitio: visitar, comer, termas, playa, dormir o
// aparcar. Eso ya lo dicen el icono y el color de lugares.json.

import * as datos from './datos.js';
import { esc } from './util.js';

/** La tira de sitios de un día. Es el menú del día de un vistazo. */
export function tiraLugares(dia) {
  const lugares = datos.lugaresDeDia(dia);
  if (!lugares.length) return '';
  return `<ul class="tira">${lugares.map(l => {
    const t = datos.LUGARES.tipos[l.tipo];
    return `<li class="tira-i" style="--m:${esc(t.color)};--c:${esc(t.color)}">
      <span class="marca-s" aria-hidden="true">${esc(t.icono)}</span>
      <span class="tira-n">${esc(l.nombre)}</span>
      <span class="tira-t">${esc(t.nombre)}</span>
    </li>`;
  }).join('')}</ul>`;
}
