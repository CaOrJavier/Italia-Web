// Dónde dejar el coche fuera de cada ZTL y cuánto se tarda en llegar al centro.

import * as datos from '../datos.js';
import { esc, minutosAHoras } from '../util.js';

const NIVEL = {
  'Muy dura': 'etiq-rojo',
  'Dura': 'etiq-rojo',
  'Prohibido de hecho': 'etiq-rojo',
  'Media': 'etiq-ambar',
  'Ninguna en la práctica': 'etiq-verde'
};

export function pintar(main) {
  const ciudades = datos.APARCAR.ciudades;

  main.innerHTML = `
    <p class="intro">${esc(datos.APARCAR.intro)}</p>

    <div class="caja caja-ojo">
      <b class="caja-t">La regla de oro</b>${esc(datos.APARCAR.regla_oro)}
    </div>

    <div class="caja caja-info">
      <b class="caja-t">Tu coche</b>
      ${esc(datos.VIAJE.coche.nota_ztl)}
    </div>

    <h2 class="seccion">Cuánto tiempo cuesta cada ciudad</h2>
    ${tabla(ciudades)}

    <h2 class="seccion">Ciudad por ciudad</h2>
    ${ciudades.map(ciudad).join('')}

    <h2 class="seccion">Verificar antes de salir</h2>
    ${verificar()}
  `;
}

function tabla(ciudades) {
  const total = ciudades.reduce((t, c) => t + c.minutos_centro * 2, 0);
  return `<div class="scroll-x"><table>
    <caption class="peq" style="text-align:left;padding:9px 11px">
      Ida y vuelta es el doble: si una ciudad pone 45 minutos, ese día pierdes hora y media
      solo en llegar y volver.</caption>
    <thead><tr>
      <th scope="col">Ciudad</th><th scope="col">ZTL</th>
      <th scope="col">Al centro</th><th scope="col">Ida y vuelta</th>
      <th scope="col">Aparcar</th><th scope="col">Billete</th>
    </tr></thead>
    <tbody>${ciudades.map(c => `<tr>
      <th scope="row">${esc(c.ciudad)}</th>
      <td><span class="etiq ${NIVEL[c.ztl] || 'etiq-gris'}">${esc(c.ztl)}</span></td>
      <td class="num">${c.minutos_centro} min</td>
      <td class="num">${minutosAHoras(c.minutos_centro * 2)}</td>
      <td class="num">${esc(c.precio)}</td>
      <td>${esc(c.billete)}</td>
    </tr>`).join('')}</tbody>
    <tfoot><tr>
      <th scope="row">Si las pisaras todas</th><td></td><td></td>
      <td class="num"><b>${minutosAHoras(total)}</b></td><td></td><td></td>
    </tr></tfoot>
  </table></div>`;
}

function ciudad(c) {
  return `
  <details class="tarjeta">
    <summary class="cab-tarjeta" style="cursor:pointer">
      <h3>${esc(c.ciudad)}</h3>
      <span class="etiq ${NIVEL[c.ztl] || 'etiq-gris'}">ZTL ${esc(c.ztl.toLowerCase())}</span>
      <span class="etiq etiq-azul">${c.minutos_centro} min al centro</span>
      ${c.verificar ? '<span class="etiq etiq-rojo">Confírmalo</span>' : ''}
    </summary>
    <div class="tarjeta-c">
      <p class="peq">${esc(c.ztl_detalle)}</p>
      <div class="ficha" style="margin-top:4px">
        <div><span class="k">Aparcar</span><span class="v">
          <b>${esc(c.parking)}</b><small>${esc(c.precio)}</small></span></div>
        <div><span class="k">Entrar</span><span class="v">
          <b>${esc(c.transporte)}</b><small>${esc(c.billete)}</small></span></div>
        <div><span class="k">Tiempo</span><span class="v">
          <b>${c.minutos_centro} min por sentido</b><small>${esc(c.desglose)}</small></span></div>
        <div><span class="k">Mapa</span><span class="v">
          <a href="https://www.openstreetmap.org/?mlat=${c.lat}&amp;mlon=${c.lon}#map=15/${c.lat}/${c.lon}"
             target="_blank" rel="noopener">${c.lat}, ${c.lon}</a>
          ${c.aprox ? '<small>Coordenadas aproximadas: busca el nombre del aparcamiento en el navegador</small>' : ''}
        </span></div>
      </div>
      <p style="margin-top:12px;font-size:14px">${esc(c.nota)}</p>
    </div>
  </details>`;
}

function verificar() {
  return `<div class="tarjeta">
    <div class="cab-tarjeta">
      <h3>Lo que hay que confirmar</h3>
      <span class="etiq etiq-ambar">Precios estimados</span>
    </div>
    <div class="tarjeta-c">
      <p class="peq">Los precios y horarios de esta web son de agosto de 2026 y algunos cambian
      de una temporada a otra. Nada de lo que hay aquí sustituye a mirarlo en la web oficial la
      semana antes de salir.</p>
    </div>
    ${datos.VIAJE.verificar.map(v => `<div class="truco">
      <b>${esc(v.que)}</b>
      <p>${esc(v.detalle)}</p>
      <p style="margin-top:5px"><a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.url)}</a></p>
    </div>`).join('')}
  </div>`;
}
