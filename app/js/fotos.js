// Una foto real por día, de Wikimedia Commons.
//
// Conviven con las ilustraciones de ilustraciones.js, que NO se sustituyen:
// el SVG sirve a tamaño icono (listas, cabeceras, la tira de días) porque
// pesa 1 KB y toma el color del tema. La foto es el banner grande, y sólo
// aparece una vez por pantalla.
//
// Las fotos van al SHELL del service worker, no bajo demanda: una foto que
// no está descargada no sirve de nada en los Apeninos sin cobertura. A
// cambio hay que mantenerlas pequeñas — 760 px de ancho, JPEG al 72, unos
// 70 KB de media. Si añades o cambias alguna, sube VERSION en sw.js.
//
// Todas son CC BY o CC BY-SA, que obligan a citar autor y licencia: el pie
// lleva el crédito corto y Ajustes la lista completa con enlaces al origen.

import { esc } from './util.js';
import { IMAGENES } from './datos.js';

const de = (n) => IMAGENES.find(i => i.dia === Number(n));

/**
 * Banner del día. Devuelve '' si ese día no tiene foto, para que el que
 * llama pueda concatenar sin comprobar nada.
 */
export function fotoDia(n) {
  const f = de(n);
  if (!f) return '';
  return `<figure class="foto-dia">
    <img src="imagenes/${esc(f.archivo)}" alt="${esc(f.pie)}" loading="lazy" decoding="async">
    <figcaption>
      <b>${esc(f.pie)}</b>
      <span class="credito">${esc(f.autor)} · ${esc(f.licencia)}</span>
    </figcaption>
  </figure>`;
}

/** Lista de créditos para Ajustes: obligación de las licencias CC BY / BY-SA. */
export function creditosHtml() {
  if (!IMAGENES.length) return '';
  return `<div class="apilar" style="gap:9px">${IMAGENES.map(f => `
    <div class="credito-foto">
      <img src="imagenes/${esc(f.archivo)}" alt="" loading="lazy" decoding="async">
      <div class="crece">
        <b>${esc(f.pie)}</b>
        <span class="suave">${esc(f.autor)} · <a href="${esc(f.licencia_url)}" target="_blank" rel="noopener">${esc(f.licencia)}</a></span>
      </div>
      <a class="btn btn-peq" href="${esc(f.origen)}" target="_blank" rel="noopener">Origen</a>
    </div>`).join('')}</div>`;
}
