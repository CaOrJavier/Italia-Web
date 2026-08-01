// Piezas de interfaz compartidas por todas las vistas.
// No importa ninguna vista: así no hay ciclos de dependencias.

import { $, nodo, esc } from './util.js';

// ---------- Hoja inferior ----------

let alCerrarHoja = null;

export function abrirHoja(titulo, contenido, { alCerrar } = {}) {
  const cuerpo = $('#hoja-cuerpo');
  $('#hoja-tit').textContent = titulo;
  cuerpo.innerHTML = '';
  cuerpo.append(typeof contenido === 'string' ? nodo(`<div>${contenido}</div>`) : contenido);
  $('#hoja').hidden = false;
  $('#hoja-fondo').hidden = false;
  alCerrarHoja = alCerrar || null;
  cuerpo.scrollTop = 0;
  $('#hoja-cerrar').focus();
  return cuerpo;
}

export function cerrarHoja() {
  if ($('#hoja').hidden) return;
  $('#hoja').hidden = true;
  $('#hoja-fondo').hidden = true;
  $('#hoja-cuerpo').innerHTML = '';
  const f = alCerrarHoja;
  alCerrarHoja = null;
  f?.();
}

export const hojaAbierta = () => !$('#hoja').hidden;

// ---------- Bloques plegables ----------

// Qué bloques ha dejado abiertos el usuario, para que un repintado no se los
// cierre. Vive en memoria: es preferencia de un rato, no algo que guardar.
const abiertos = new Set();

/**
 * Bloque plegado por defecto. Baja mucho la densidad de las pantallas largas
 * sin esconder nada: el titular y el resumen se ven siempre.
 */
export function plegable(id, titulo, resumen, contenido, { abierto = false } = {}) {
  const visible = abiertos.has(id) || (abierto && !abiertos.has('!' + id));
  return `<details class="acordeon" data-pliegue="${esc(id)}" ${visible ? 'open' : ''}>
    <summary>
      <span class="crece">
        ${esc(titulo)}
        ${resumen ? `<span class="acordeon-sub">${resumen}</span>` : ''}
      </span>
    </summary>
    <div>${contenido}</div>
  </details>`;
}

/** Recuerda qué bloques quedan abiertos dentro de un contenedor. */
export function recordarPliegues(raiz) {
  for (const d of raiz.querySelectorAll('[data-pliegue]')) {
    d.addEventListener('toggle', () => {
      const id = d.dataset.pliegue;
      if (d.open) { abiertos.add(id); abiertos.delete('!' + id); }
      else { abiertos.delete(id); abiertos.add('!' + id); }
    });
  }
}

// ---------- Enrutado ----------

let pintor = () => {};
export const registrarPintor = (fn) => { pintor = fn; };
export const repintar = () => pintor();

export function ir(ruta) {
  if (location.hash === ruta) pintor();
  else location.hash = ruta;
}

// ---------- Navegación externa ----------

import { enlacesNavegacion } from './util.js';

/** Hoja con las apps de navegación disponibles para unas coordenadas. */
export function hojaNavegar(lat, lon, nombre = '') {
  const e = enlacesNavegacion(lat, lon, nombre);
  const html = `
    <p class="suave">Se abrirá la app de mapas del móvil con estas coordenadas.</p>
    <p class="mono" style="font-size:19px;font-weight:700">${esc(e.texto)}</p>
    <div class="apilar" style="margin-top:14px">
      <a class="btn btn-pri btn-blq" href="${e.google}" target="_blank" rel="noopener">Google Maps</a>
      <a class="btn btn-blq" href="${e.waze}" target="_blank" rel="noopener">Waze</a>
      <a class="btn btn-blq" href="${e.apple}" target="_blank" rel="noopener">Apple Maps</a>
      <a class="btn btn-blq" href="${e.geo}">App de mapas por defecto</a>
      <button class="btn btn-blq" data-copiar="${esc(e.texto)}">Copiar coordenadas</button>
    </div>`;
  const cuerpo = abrirHoja(nombre || 'Navegar hasta aquí', html);
  cuerpo.querySelector('[data-copiar]').addEventListener('click', async (ev) => {
    const txt = ev.currentTarget.dataset.copiar;
    try {
      await navigator.clipboard.writeText(txt);
      ev.currentTarget.textContent = 'Copiado ✓';
    } catch {
      ev.currentTarget.textContent = txt;
    }
  });
}

// ---------- Confirmación ----------

export function confirmar(titulo, mensaje, textoBoton, alAceptar, { peligro = false } = {}) {
  const cuerpo = abrirHoja(titulo, `
    <p>${mensaje}</p>
    <div class="apilar" style="margin-top:16px">
      <button class="btn btn-blq ${peligro ? 'btn-peligro' : 'btn-pri'}" data-si>${esc(textoBoton)}</button>
      <button class="btn btn-blq" data-no>Cancelar</button>
    </div>`);
  cuerpo.querySelector('[data-si]').addEventListener('click', () => { cerrarHoja(); alAceptar(); });
  cuerpo.querySelector('[data-no]').addEventListener('click', cerrarHoja);
}
