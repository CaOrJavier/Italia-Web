// La ruta, día a día.
//
// Una sola ruta, cerrada, y esta pantalla es leerla de arriba abajo. Dentro de
// cada día va todo lo suyo: la ruta del día en orden con lo que se puede soltar,
// el hora a hora, lo que hay que decidir antes de salir de casa y los desvíos que
// caben ese día. No hay nada que elegir ni estado que guardar: se lee y ya.

import * as datos from '../datos.js';
import { esc, fechaLarga, minutosAHoras, numero, euros } from '../util.js';
import { tiraLugares } from '../marcas.js';
import { cadena, nivelDeHora, NIVELES } from '../cadena.js';
import { figura } from '../fotos.js';

export function pintar(main, params) {
  const ruta = datos.RUTAS.rutas[0];
  // Sin día en la URL se abre el primero, como muestra de lo que hay dentro.
  const pedido = params.has('d');
  const abierto = pedido ? Number(params.get('d')) : 0;

  main.innerHTML = `
    <p class="intro">${esc(datos.RUTAS.intro)}</p>
    ${resumen(ruta)}
    ${fijo()}
    <h2 class="seccion">Los doce días</h2>
    <div class="tarjeta">${ruta.dias.map(d => dia(d, d.n === abierto)).join('')}</div>
  `;

  // El día abierto se recuerda en la URL, para poder compartir un día concreto.
  main.querySelectorAll('details.dia').forEach(d => {
    d.addEventListener('toggle', () => {
      if (!d.open) return;
      history.replaceState(null, '', `#/rutas?d=${d.dataset.n}`);
    });
  });

  // Solo se salta al día si venía pedido en la URL: si no, la pantalla empieza arriba.
  if (pedido) {
    const abre = main.querySelector('details.dia[open]');
    if (abre) abre.scrollIntoView({ block: 'center' });
  }
}

function resumen(r) {
  const apretados = datos.apretadosDe(r);
  const comb = datos.combustible(r);
  const nDesvios = datos.EXTRAS.desvios.length;
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
      <h3 class="seccion" style="margin:0 0 6px">Lo que te llevas</h3>
      <ul class="gana">${r.ganas.map(x => `<li><span>${esc(x)}</span></li>`).join('')}</ul>
      <div class="caja caja-info" style="margin:14px 0 0">
        <b class="caja-t">Dónde duermes</b>
        ${r.bases.map(b => `${esc(b.sitio)} <b>×${b.noches}</b>`).join(' · ')}
        <p class="peq" style="margin:6px 0 0">Combustible estimado: ${comb.litros} litros,
        unos ${euros(comb.euros)} a ${String(datos.VIAJE.combustible.precio_litro_estimado).replace('.', ',')} €/l.</p>
      </div>
      <p class="peq" style="margin:10px 0 0">Dentro de cada día están los
        ${nDesvios} desvíos que caben ese día, con sus kilómetros contados, y las
        ${datos.EXTRAS.variantes.length} decisiones que hay que tomar antes de salir de casa.</p>
    </div>
  </div>`;
}

function fijo() {
  const c = datos.RUTAS.fijo;
  return `<details class="tarjeta"><summary class="cab-tarjeta" style="cursor:pointer">
      <h3>${esc(c.titulo)}</h3><span class="etiq etiq-gris">El calendario manda</span>
    </summary>
    <div class="tarjeta-c"><ul>${c.puntos.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>
  </details>`;
}

function dia(d, abierto) {
  return `
  <details class="dia" data-n="${d.n}" ${abierto ? 'open' : ''}>
    <summary>
      <span class="dia-n"><b>D${d.n}</b>${esc(d.dia_semana.slice(0, 3))} ${esc(d.fecha.slice(-2))}</span>
      <span class="dia-t"><b>${esc(d.titulo)}</b><span>${esc(d.etapa)}</span></span>
      ${d.apretado ? '<span class="dia-marca" title="Día apretado">!</span>' : ''}
      <span class="dia-km"><b>${d.km} km</b>${minutosAHoras(d.minutos)}</span>
    </summary>
    <div class="dia-c">${detalle(d)}</div>
  </details>`;
}

/** Lo que hay que decidir ese día, casi siempre antes de salir de casa: en qué
 *  te gastas la entrada de Florencia, qué tarjeta compras en Cinque Terre. Va
 *  como texto y no como interruptor: la decisión se toma una vez y no hace falta
 *  una pantalla para llevar la cuenta. */
function decidir(d) {
  const mias = datos.EXTRAS.variantes.filter(v => v.dia === d.n);
  if (!mias.length) return '';
  return mias.map(v => `
    <div class="caja caja-var">
      <b class="caja-t">${esc(v.icono)} ${esc(v.titulo)}</b>
      ${v.nota ? `<p class="peq">${esc(v.nota)}</p>` : ''}
      <ul class="opciones">${v.opciones.map((o, i) => `
        <li${i === 0 ? ' class="op-plan"' : ''}>
          <b>${esc(o.icono)} ${esc(o.nombre)}</b>
          ${i === 0 ? '<span class="etiq etiq-verde">Lo que va en el plan</span>' : ''}
          ${coste(o) ? `<span class="etiq etiq-gris">${esc(coste(o))}</span>` : ''}
          <p>${esc(o.que)}</p>
        </li>`).join('')}</ul>
    </div>`).join('');
}

/** Los desvíos que caben ese día: un sitio de más, con lo que cuesta meterlo. No
 *  se encienden ni se apagan, se leen: los kilómetros y el rato están escritos y
 *  la suma se hace sobre la marcha si de verdad se coge alguno. */
function desvios(d) {
  const mios = datos.EXTRAS.desvios.filter(x => x.dia === d.n);
  if (!mios.length) return '';
  return `
  <details class="tarjeta tarjeta-desvios">
    <summary class="cab-tarjeta" style="cursor:pointer">
      <h3>Si te sobra tiempo este día</h3>
      <span class="etiq etiq-gris">${mios.length} desvío${mios.length > 1 ? 's' : ''}</span>
    </summary>
    ${mios.map(x => `<div class="plato">
      <div class="plato-t">
        <b>${esc(x.icono)} ${esc(x.nombre)}</b>
        <span class="etiq etiq-ambar">${esc(coste(x) || 'sin coste')}</span>
      </div>
      ${x.cuando ? `<p class="peq"><b>Cuándo cae ·</b> ${esc(x.cuando)}</p>` : ''}
      <p>${esc(x.que)}</p>
    </div>`).join('')}
  </details>`;
}

/** «+35 km · +50 min de coche · 2 h 30 allí · +5 €», saltándose lo que sea cero.
 *  Las tres monedas van separadas porque los kilómetros y el volante son una cosa
 *  y el rato que te come el sitio es otra: Fiesole son tres horas y ni un km. */
function coste(x) {
  const p = [];
  const signo = (n, u) => `${n > 0 ? '+' : '−'}${numero(Math.abs(n))} ${u}`;
  if (x.km) p.push(signo(x.km, 'km'));
  if (x.minutos) p.push(`${x.minutos > 0 ? '+' : '−'}${minutosAHoras(Math.abs(x.minutos))} de coche`);
  if (x.rato) p.push(`${minutosAHoras(x.rato)} allí`);
  if (x.coste) p.push(signo(x.coste, '€'));
  return p.length ? p.join(' · ') : null;
}

/** Las fotos de los sitios del día. Como mucho cuatro: es una muestra, no un álbum. */
function fotosDia(d) {
  const con = datos.lugaresDeDia(d).filter(l => datos.fotoDe(l.id)).slice(0, 4);
  if (!con.length) return '';
  return `<div class="rejilla rejilla-dia">${con.map(l =>
    figura(l.id, { alto: 96, pie: l.nombre })).join('')}</div>`;
}

/** El cuerpo de un día. */
function detalle(d) {
  const parkings = datos.parkingsDe(d);
  const cama = datos.camaDe(d);
  const tpt = datos.minutosTransporte(d);
  const niveles = nivelDeHora(d);

  return `
    <p class="peq" style="margin:-2px 0 10px">${esc(fechaLarga(d.fecha))}</p>

    ${d.apretado ? `<div class="caja caja-ojo">
      <b class="caja-t">Día apretado</b>${esc(d.apretado)}</div>` : ''}

    ${cadena(d)}

    <ul class="horas">${d.plan.map(p => {
      const n = niveles.get(p.hora);
      return `<li${n ? ` class="${NIVELES[n].clase}"` : ''}>
        <time>${esc(p.hora)}</time>
        <span>${n ? `<i class="pa-marca" title="${esc(NIVELES[n].nombre)}">${NIVELES[n].simbolo}</i> ` : ''}${esc(p.que)}</span>
      </li>`;
    }).join('')}</ul>

    ${d.aviso ? `<div class="caja caja-ojo"><b class="caja-t">Ojo</b>${esc(d.aviso)}</div>` : ''}

    ${decidir(d)}
    ${desvios(d)}

    ${fotosDia(d)}
    ${tiraLugares(d)}

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
    </div>`;
}
