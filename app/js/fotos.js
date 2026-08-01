// Fotos de Wikimedia Commons, con el crédito pegado a cada una.
//
// Todas son de licencia libre, pero libre no es gratis de condiciones: las CC BY
// y CC BY-SA obligan a nombrar al autor y la licencia. Por eso el crédito no es
// un extra que se pueda quitar, va dentro de la propia pieza.

import * as datos from './datos.js';
import { esc } from './util.js';

/** Una foto con su pie y su crédito. Devuelve '' si ese lugar no tiene foto. */
export function figura(idLugar, { alto = 150, pie = null } = {}) {
  const f = datos.fotoDe(idLugar);
  if (!f) return '';
  return `<figure class="foto" style="--alto:${alto}px">
    <img src="imagenes/${esc(f.archivo)}" alt="${esc(f.pie)}" loading="lazy" decoding="async">
    ${pie === false ? '' : `<figcaption>${esc(pie || f.pie)}</figcaption>`}
    <small class="credito">${credito(f)}</small>
  </figure>`;
}

/** Solo la imagen, sin marco: para los globos del mapa, que ya llevan su título. */
export function imagenSuelta(idLugar) {
  const f = datos.fotoDe(idLugar);
  if (!f) return '';
  return `<img class="foto-globo" src="imagenes/${esc(f.archivo)}" alt="${esc(f.pie)}"
    loading="lazy" decoding="async">
    <small class="credito">${credito(f)}</small>`;
}

function credito(f) {
  const autor = esc(f.autor);
  const lic = f.licencia_url
    ? `<a href="${esc(f.licencia_url)}" target="_blank" rel="noopener">${esc(f.licencia)}</a>`
    : esc(f.licencia);
  return `<a href="${esc(f.origen)}" target="_blank" rel="noopener">${autor}</a> · ${lic}`;
}

/** ¿Hay fotos cargadas? Si el JSON no está, las vistas se dibujan sin ellas. */
export const hayFotos = () => datos.FOTO.size > 0;

/** La lista completa de créditos, para el pie de la galería. */
export function creditos() {
  if (!hayFotos()) return '';
  const fotos = [...datos.FOTO.values()];
  return `<details class="tarjeta">
    <summary class="cab-tarjeta" style="cursor:pointer">
      <h3>Créditos de las ${fotos.length} fotos</h3>
      <span class="etiq etiq-verde">Todas de licencia libre</span>
    </summary>
    <div class="tarjeta-c">
      <p class="peq">Todas salen de Wikimedia Commons y todas tienen licencia libre
      (Creative Commons o dominio público). Se han bajado con
      <code>app/herramientas/fotos.mjs</code>, que trae de la propia Wikipedia el autor,
      la licencia y el enlace al original, para que el crédito no dependa de mi memoria.</p>
      <ul class="creditos">${fotos.map(f =>
        `<li><b>${esc(f.pie)}</b> — ${credito(f)}</li>`).join('')}</ul>
    </div>
  </details>`;
}
