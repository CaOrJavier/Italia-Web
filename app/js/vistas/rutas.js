// Las tres rutas, día a día.

import * as datos from '../datos.js';
import { esc, fechaLarga, minutosAHoras, numero, euros } from '../util.js';
import { ir } from '../app.js';

export function pintar(main, params) {
  const idRuta = datos.RUTA.has(params.get('r')) ? params.get('r') : datos.RUTAS.rutas[0].id;
  const ruta = datos.RUTA.get(idRuta);
  // Sin día en la URL se abre el primero, como muestra de lo que hay dentro.
  const pedido = params.has('d');
  const abierto = pedido ? Number(params.get('d')) : 0;

  main.innerHTML = `
    <p class="intro">${esc(datos.RUTAS.intro)}</p>
    ${selector(idRuta)}
    ${resumen(ruta)}
    ${comun()}
    <h2 class="seccion">Los doce días</h2>
    <div class="tarjeta">${ruta.dias.map(d => dia(d, ruta, d.n === abierto)).join('')}</div>
  `;

  main.querySelectorAll('.selector button').forEach(b => {
    b.addEventListener('click', () => ir('rutas', new URLSearchParams({ r: b.dataset.r })));
  });

  // El día abierto se recuerda en la URL, para poder compartir un día concreto.
  main.querySelectorAll('details.dia').forEach(d => {
    d.addEventListener('toggle', () => {
      if (!d.open) return;
      const q = new URLSearchParams({ r: idRuta, d: d.dataset.n });
      history.replaceState(null, '', `#/rutas?${q}`);
    });
  });

  // Solo se salta al día si venía pedido en la URL: si no, la pantalla empieza arriba.
  if (pedido) {
    const abre = main.querySelector('details.dia[open]');
    if (abre) abre.scrollIntoView({ block: 'center' });
  }
}

export function selector(activa) {
  return `<div class="selector">${datos.RUTAS.rutas.map(r => `
    <button type="button" data-r="${esc(r.id)}" aria-pressed="${r.id === activa}"
            style="--barra:${esc(r.color)}">
      <span class="num">${r.numero}</span>
      <span class="txt"><b>${esc(r.nombre)}</b><span>${esc(r.lema)}</span></span>
      <span class="cifra">${numero(r.km)} km<br>${minutosAHoras(r.minutos_volante)}</span>
    </button>`).join('')}</div>`;
}

function resumen(r) {
  const apretados = datos.apretadosDe(r);
  const comb = datos.combustible(r);
  return `
  <div class="tarjeta" style="--barra:${esc(r.color)}">
    <div class="tarjeta-c">
      <p>${esc(r.resumen)}</p>
    </div>
    <div class="cifras">
      <div><b>${numero(r.km)}</b><span>kilómetros</span></div>
      <div><b>${minutosAHoras(r.minutos_volante)}</b><span>al volante</span></div>
      <div><b>${euros(r.coste_estimado)}</b><span>estimado</span></div>
      <div><b>${apretados.length}</b><span>${apretados.length === 1 ? 'día apretado' : 'días apretados'}</span></div>
    </div>
    <div class="tarjeta-c">
      <div class="listas">
        <div><h3 class="seccion" style="margin:0 0 6px">Ganas</h3>
          <ul class="gana">${r.ganas.map(x => `<li><span>${esc(x)}</span></li>`).join('')}</ul></div>
        <div><h3 class="seccion" style="margin:0 0 6px">Pierdes</h3>
          <ul class="pierde">${r.pierdes.map(x => `<li><span>${esc(x)}</span></li>`).join('')}</ul></div>
      </div>
      <div class="caja caja-info" style="margin:14px 0 0">
        <b class="caja-t">Dónde duermes</b>
        ${r.bases.map(b => `${esc(b.sitio)} <b>×${b.noches}</b>`).join(' · ')}
        <p class="peq" style="margin:6px 0 0">Combustible estimado: ${comb.litros} litros,
        unos ${euros(comb.euros)} a ${String(datos.VIAJE.combustible.precio_litro_estimado).replace('.', ',')} €/l.</p>
      </div>
    </div>
  </div>`;
}

function comun() {
  const c = datos.RUTAS.comun;
  return `<details class="tarjeta"><summary class="cab-tarjeta" style="cursor:pointer">
      <h3>${esc(c.titulo)}</h3><span class="etiq etiq-gris">Igual en las tres</span>
    </summary>
    <div class="tarjeta-c"><ul>${c.puntos.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>
  </details>`;
}

function dia(d, ruta, abierto) {
  const parkings = datos.parkingsDe(d);
  const cama = datos.camaDe(d);
  const tpt = datos.minutosTransporte(d);

  return `
  <details class="dia" data-n="${d.n}" ${abierto ? 'open' : ''}>
    <summary>
      <span class="dia-n"><b>D${d.n}</b>${esc(d.dia_semana.slice(0, 3))} ${esc(d.fecha.slice(-2))}</span>
      <span class="dia-t"><b>${esc(d.titulo)}</b><span>${esc(d.etapa)}</span></span>
      ${d.apretado ? '<span class="dia-marca" title="Día apretado">!</span>' : ''}
      <span class="dia-km"><b>${d.km} km</b>${minutosAHoras(d.minutos)}</span>
    </summary>
    <div class="dia-c">
      <p class="peq" style="margin:-2px 0 10px">${esc(fechaLarga(d.fecha))}</p>

      ${d.apretado ? `<div class="caja caja-ojo">
        <b class="caja-t">Día apretado</b>${esc(d.apretado)}</div>` : ''}

      <ul class="horas">${d.plan.map(p =>
        `<li><time>${esc(p.hora)}</time><span>${esc(p.que)}</span></li>`).join('')}</ul>

      ${d.aviso ? `<div class="caja caja-ojo"><b class="caja-t">Ojo</b>${esc(d.aviso)}</div>` : ''}

      <div class="ficha">
        ${parkings.map(p => `<div>
          <span class="k">Aparcar</span>
          <span class="v"><b>${esc(p.parking)}</b>
            <small>${esc(p.ciudad)} · ${esc(p.precio)}</small>
            <small>${esc(p.transporte)} · <b>${p.minutos_centro} min</b> al centro · ${esc(p.billete)}</small>
          </span></div>`).join('')}

        ${cama ? `<div>
          <span class="k">Dormir</span>
          <span class="v"><b>${esc(cama.nombre)}</b>
            <small>${cama.precio === 0 ? '<span class="etiq etiq-verde">Gratis</span>' : esc(cama.precio) + ' €'}
              · ${cama.altitud} m de altitud</small>
          </span></div>` : `<div>
          <span class="k">Dormir</span>
          <span class="v"><b>En el ferri</b><small>Sale a las ${esc(datos.VIAJE.ferri.salida.hora)}</small></span></div>`}

        <div><span class="k">Comer</span><span class="v">${esc(d.comer)}</span></div>

        <div><span class="k">El día</span><span class="v">
          <b>${d.km} km · ${minutosAHoras(d.minutos)} de volante</b>
          ${tpt ? `<small>Más ${minutosAHoras(tpt)} de transporte público, ida y vuelta</small>` : ''}
          <small>Gasto estimado del día: ${euros(d.coste_dia)}</small>
        </span></div>
      </div>
    </div>
  </details>`;
}
