// Idioma: pronunciación, el catalán como atajo, falsos amigos, frases y números.
//
// Vivía dentro de Guía como una sección más. Tiene pestaña propia en la
// cabecera porque es lo que se abre de pie, delante de un mostrador, y llegar
// hasta ella eran tres toques y un scroll horizontal.
//
// El contenido está en js/idioma.js: lo aporta la app, no la guía verificada.

import { esc } from '../util.js';
import * as idioma from '../idioma.js';
import { plegable, recordarPliegues } from '../ui.js';

export function vistaIdioma(caja) {
  caja.innerHTML = `
    <div class="tarjeta">
      <h2>Del español (y el catalán) al italiano</h2>
      <p style="margin-top:6px">Con español y catalán ya entiendes buena parte del italiano escrito.
      Lo que falla es la <b>pronunciación</b>, y ahí hay seis o siete reglas que lo arreglan casi todo.</p>
    </div>

    ${plegable('idi-pron', 'Cómo se pronuncia', 'Ocho reglas y ya lees cualquier cartel',
      idioma.PRONUNCIACION.map(p => `
        <div class="pron">
          <div class="pron-regla">${esc(p.regla)}</div>
          <div class="pron-como">${esc(p.como)}</div>
          <div class="pron-ej">${p.ejemplos.map(([it, son]) =>
            `<span><b>${esc(it)}</b> → <i>${esc(son)}</i></span>`).join('')}</div>
          ${p.truco ? `<div class="pron-truco">${esc(p.truco)}</div>` : ''}
        </div>`).join(''), { abierto: true })}

    ${plegable('idi-cat', 'Tu catalán es una ventaja', `${idioma.CATALAN.palabras.length} palabras y tres atajos de gramática`,
      `<p style="font-size:15.5px">${esc(idioma.CATALAN.intro)}</p>
       <div class="tabla-envoltorio" style="margin-top:10px"><table class="tabla">
         <thead><tr><th>Catalán</th><th>Italiano</th><th>Castellano</th></tr></thead>
         <tbody>${idioma.CATALAN.palabras.map(([c, i, e]) =>
           `<tr><td>${esc(c)}</td><td><b>${esc(i)}</b></td><td class="suave">${esc(e)}</td></tr>`).join('')}</tbody>
       </table></div>
       ${idioma.CATALAN.gramatica.map(g => `
         <div style="margin-top:14px;padding:11px 13px;border-radius:11px;background:var(--ok-sua)">
           <b style="color:var(--ok)">${esc(g.titulo)}</b>
           <p style="margin:5px 0 0;font-size:15px">${esc(g.texto)}</p>
         </div>`).join('')}`)}

    ${plegable('idi-falsos', 'Falsos amigos', 'Once que te meten en un lío',
      `<div class="tabla-envoltorio"><table class="tabla">
        <thead><tr><th>Parece…</th><th>Pero es</th></tr></thead>
        <tbody>${idioma.FALSOS_AMIGOS.map(([it, sig, nota]) =>
          `<tr><td><b>${esc(it)}</b></td><td>${esc(sig)}<br><small class="suave">${esc(nota)}</small></td></tr>`).join('')}</tbody>
      </table></div>`)}

    <div class="seccion-tit">Frases por situación</div>
    ${idioma.FRASES.map((g, i) => plegable(`idi-fr-${i}`, g.grupo, `${g.items.length} frases`,
      g.items.map(([it, es, nota, deLaGuia]) => `
        <div class="frase">
          <div class="frase-it">${esc(it)}</div>
          <div class="frase-es">${esc(es)}</div>
          ${nota ? `<div class="frase-nota">${esc(nota)}${deLaGuia ? ' · <b>de la guía</b>' : ''}</div>` : ''}
        </div>`).join(''), { abierto: i === 0 })).join('')}

    ${plegable('idi-num', 'Números', 'Del 1 al 1000',
      idioma.NUMEROS.map(fila =>
        `<div class="envuelve" style="margin-bottom:8px">${fila.map(n => `<span class="etiq">${esc(n)}</span>`).join('')}</div>`).join(''))}

    <p class="suave" style="font-size:13px;margin-top:18px">
      Esta sección la aporta la app: son reglas de idioma, no datos del viaje. Las cuatro frases
      marcadas «de la guía» sí salen de ella.
    </p>`;

  recordarPliegues(caja);
}
