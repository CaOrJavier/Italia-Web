// Comer típico y barato por región, y dormir dentro del coche.

import * as datos from '../datos.js';
import { esc } from '../util.js';

export function pintar(main) {
  main.innerHTML = `
    <p class="intro">${esc(datos.COMER.intro)}</p>
    ${trucos()}
    <h2 class="seccion">Región por región</h2>
    ${datos.COMER.regiones.map(region).join('')}
    <h2 class="seccion">Dormir dentro del coche</h2>
    ${dormir()}
  `;
}

function trucos() {
  return `<details class="tarjeta" open>
    <summary class="cab-tarjeta" style="cursor:pointer">
      <h3>Ocho cosas que te ahorran la mitad</h3>
    </summary>
    <div>${datos.COMER.trucos.map(t =>
      `<div class="truco"><b>${esc(t.titulo)}</b><p>${esc(t.texto)}</p></div>`).join('')}</div>
  </details>`;
}

function region(r) {
  // Las cuatro regiones caen dentro de la ruta, así que ya no hay nada que
  // advertir: el aviso era para cuando había que elegir entre dos.
  const soloEn = '<span class="etiq etiq-verde">En la ruta</span>';

  return `
  <details class="tarjeta">
    <summary class="cab-tarjeta" style="cursor:pointer">
      <h3>${esc(r.region)}</h3>
      ${soloEn}
      <p class="peq">${esc(r.cuando)} · ${esc(r.presupuesto_dia)} al día</p>
    </summary>
    <div class="tarjeta-c" style="border-bottom:1px solid var(--linea)">
      <p style="margin:0">${esc(r.resumen)}</p>
    </div>
    <div>${r.platos.map(plato).join('')}</div>
    <div class="tarjeta-c" style="border-top:1px solid var(--linea);background:var(--papel-2)">
      <p class="peq" style="margin:0"><b>Dónde ·</b> ${esc(r.donde_comer)}</p>
    </div>
  </details>`;
}

function plato(p) {
  return `<div class="plato">
    <div class="plato-t">
      <b>${esc(p.nombre)}</b>
      <span class="etiq etiq-gris">${esc(p.precio)}</span>
      ${p.imprescindible ? '<span class="etiq etiq-verde">No lo comes igual en España</span>' : ''}
    </div>
    <p>${esc(p.que_es)}</p>
    <p class="donde">${esc(p.donde)}</p>
  </div>`;
}

function dormir() {
  const d = datos.DORMIR;
  const legal = datos.VIAJE.avisos.find(a => a.titulo.includes('Dormir en el coche'));

  return `
    <p class="intro">${esc(d.intro)}</p>

    ${legal ? `<div class="caja caja-ojo">
      <b class="caja-t">${esc(legal.titulo)}</b>${esc(legal.texto)}</div>` : ''}

    <div class="tarjeta">
      <div class="cab-tarjeta"><h3>Las cinco reglas</h3></div>
      <div class="tarjeta-c"><ul style="margin:0">
        ${d.reglas.map(r => `<li>${esc(r)}</li>`).join('')}
      </ul></div>
    </div>

    <div class="tarjeta">
      <div class="cab-tarjeta"><h3>Los sitios</h3>
        <span class="etiq etiq-verde">${d.sitios.filter(s => s.precio === 0).length} de ${d.sitios.length} gratis</span>
      </div>
      ${d.sitios.map(sitio).join('')}
    </div>`;
}

function sitio(s) {
  // En qué noches se duerme aquí: con una sola ruta, o es una parada del viaje o
  // es un sitio de repuesto por si algo falla.
  const noches = datos.RUTAS.rutas[0].dias.filter(d => d.dormir === s.id).length;
  return `<div class="plato">
    <div class="plato-t">
      <b>${esc(s.nombre)}</b>
      ${s.precio === 0
        ? '<span class="etiq etiq-verde">Gratis</span>'
        : `<span class="etiq etiq-ambar">${esc(s.precio)} € el día</span>`}
      <span class="etiq etiq-gris">${s.altitud} m</span>
      ${s.verificar ? '<span class="etiq etiq-rojo">Confírmalo antes de salir</span>' : ''}
    </div>
    <p>${esc(s.nota)}</p>
    <p class="donde">
      ${s.servicios.map(x => esc(x)).join(' · ')}
      · ruido ${esc(s.ruido)}
      ${noches ? ` · ${noches} ${noches === 1 ? 'noche' : 'noches'} aquí` : ' · de repuesto, no está en el plan'}
    </p>
  </div>`;
}
