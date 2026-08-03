// Lo que hay que reservar, con la cuenta atrás de cada cosa.
//
// La gracia no es la lista, es el calendario: el Coliseo abre la venta un día
// exacto (30 días antes de la visita) y esa fecha depende de la ruta que cojas,
// porque no todas ponen el Coliseo el mismo día. Así que la fecha no se escribe
// a mano en ningún sitio: se saca de la ruta elegida buscando qué día pisa ese
// lugar, y de ahí sale el estado de cada reserva.

import * as datos from '../datos.js';
import { esc, fecha, fechaLarga, diasHasta, euros, numero } from '../util.js';
import { ir } from '../app.js';

/** El día de una ruta en que se pisa un lugar, o null si esa ruta no pasa. */
function diaDe(idRuta, idLugar) {
  const ns = datos.diasDeLugar(idRuta, idLugar);
  if (!ns.length) return null;
  return datos.RUTA.get(idRuta).dias.find(d => d.n === ns[0]);
}

/** Estado de una reserva: cuándo abre la venta, si ya está abierta y cuánto queda. */
function estado(r, idRuta) {
  const d = diaDe(idRuta, r.lugar);
  if (!d) return { aplica: false };

  const faltanVisita = diasHasta(d.fecha);
  if (r.abre_dias_antes == null) {
    return { aplica: true, dia: d, faltanVisita, abierta: true, desdeSiempre: true };
  }
  const apertura = new Date(fecha(d.fecha));
  apertura.setDate(apertura.getDate() - r.abre_dias_antes);
  const iso = apertura.toISOString().slice(0, 10);
  const faltanApertura = diasHasta(iso);
  return {
    aplica: true, dia: d, faltanVisita,
    abierta: faltanApertura <= 0,
    apertura: iso, faltanApertura, abiertaHace: -faltanApertura
  };
}

/** Lo que marca la urgencia no es cuándo visitas, sino cuándo sales de casa: una
 *  vez en la carretera, durmiendo en el coche y con la cobertura justa, sacar una
 *  entrada nominativa deja de ser cómodo. Así que a menos de un mes de salir,
 *  toda reserva crítica que ya se pueda sacar está en rojo. */
function urgencia(e, r, salida) {
  const plural = n => `${n} ${n === 1 ? 'día' : 'días'}`;
  if (!e.abierta) {
    return { clave: 'espera', txt: `Se abre en ${plural(e.faltanApertura)}`, etiq: 'etiq-gris' };
  }
  if (r.prioridad === 'critica' && salida <= 30) {
    const txt = e.desdeSiempre ? 'Sácala ya'
      : e.abiertaHace > 0 ? `Abierta desde hace ${plural(e.abiertaHace)}`
      : 'Se abre hoy';
    return { clave: 'ya', txt, etiq: 'etiq-rojo' };
  }
  return { clave: 'abierta', txt: 'Ya se puede reservar', etiq: 'etiq-verde' };
}

const ORDEN = { critica: 0, recomendada: 1, opcional: 2 };

export function pintar(main, params) {
  const idRuta = datos.RUTA.has(params.get('r')) ? params.get('r') : datos.RUTAS.rutas[0].id;
  const ruta = datos.RUTA.get(idRuta);
  const R = datos.RESERVAS;

  const salida = diasHasta(datos.VIAJE.ferri.llegada.fecha);
  const items = R.reservas
    .map(r => ({ r, e: estado(r, idRuta) }))
    .filter(x => x.e.aplica)
    .map(x => ({ ...x, u: urgencia(x.e, x.r, salida) }))
    .sort((a, b) => (ORDEN[a.r.prioridad] - ORDEN[b.r.prioridad]) || (a.e.faltanVisita - b.e.faltanVisita));

  const criticas = items.filter(x => x.r.prioridad === 'critica');
  const gasto = items.filter(x => x.r.prioridad !== 'opcional').reduce((a, x) => a + x.r.precio, 0);
  const conOpcionales = items.reduce((a, x) => a + x.r.precio, 0);

  main.innerHTML = `
    <p class="intro">${esc(R.intro)}</p>

    ${cabecera(salida, criticas, gasto, conOpcionales)}

    <div class="filtros" id="f-rutas" role="group" aria-label="Ruta">
      ${datos.RUTAS.rutas.map(r => `<button type="button" data-r="${esc(r.id)}"
        aria-pressed="${r.id === idRuta}" style="--c:${esc(r.color)}">
        <span class="raya"></span>${r.numero}. ${esc(r.nombre)}</button>`).join('')}
    </div>
    <p class="peq" style="margin:-6px 0 14px">Las fechas de abajo son las de la ruta
      <b>${ruta.numero}. ${esc(ruta.nombre)}</b>. Si coges otra, cambian.</p>

    <div class="caja caja-ojo"><b class="caja-t">Entradas nominativas</b>${esc(R.aviso_franja)}</div>

    ${['critica', 'recomendada', 'opcional'].map(p => bloque(p, items.filter(x => x.r.prioridad === p))).join('')}

    <h2 class="seccion">Lo que NO hace falta reservar</h2>
    <div class="tarjeta">${R.sin_reserva.map(s => `
      <div class="truco"><b>${esc(s.que)}</b><p>${esc(s.detalle)}</p></div>`).join('')}</div>

    <h2 class="seccion">Papeleo antes de salir</h2>
    <div class="tarjeta">${R.papeleo.map(s => `
      <div class="truco">
        <b>${esc(s.que)}</b><p>${esc(s.detalle)}</p>
        ${s.url ? `<p style="margin-top:5px"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)}</a></p>` : ''}
      </div>`).join('')}</div>

    <h2 class="seccion">Y confirmar antes de salir</h2>
    <div class="tarjeta">${datos.VIAJE.verificar.map(v => `
      <div class="truco">
        <b>${esc(v.que)}</b><p>${esc(v.detalle)}</p>
        <p style="margin-top:5px"><a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.url)}</a></p>
      </div>`).join('')}</div>
  `;

  main.querySelectorAll('#f-rutas button').forEach(b => {
    b.addEventListener('click', () => ir('reservar', new URLSearchParams({ r: b.dataset.r })));
  });
}

function cabecera(salida, criticas, gasto, conOpcionales) {
  const urge = criticas.filter(x => x.u.clave === 'ya').length;
  return `
  <div class="tarjeta">
    <div class="cifras">
      <div><b>${salida > 0 ? salida : 0}</b><span>días para salir</span></div>
      <div><b>${criticas.length}</b><span>reservas críticas</span></div>
      <div><b>${euros(gasto)}</b><span>en entradas</span></div>
      <div><b>${euros(conOpcionales)}</b><span>con los museos</span></div>
    </div>
    ${urge ? `<div class="tarjeta-c" style="padding-top:0">
      <div class="caja caja-mal" style="margin:14px 0 0">
        <b class="caja-t">Hay ${urge} ${urge === 1 ? 'reserva abierta y sin sacar' : 'reservas abiertas y sin sacar'}</b>
        La venta ya está abierta y el viaje sale en ${salida} días. Esto es lo primero que hay que hacer hoy.
      </div></div>` : ''}
  </div>`;
}

const TITULO = {
  critica: 'Sin esto no entras',
  recomendada: 'Muy recomendable',
  opcional: 'Solo si te apetece y te da el presupuesto'
};

function bloque(prioridad, items) {
  if (!items.length) return '';
  return `
    <h2 class="seccion">${esc(TITULO[prioridad])}</h2>
    ${items.map(ficha).join('')}`;
}

function ficha({ r, e, u }) {
  return `
  <div class="tarjeta reserva reserva-${esc(u.clave)}">
    <div class="cab-tarjeta">
      <h3>${esc(r.que)}</h3>
      <span class="etiq ${esc(u.etiq)}">${esc(u.txt)}</span>
      <span class="etiq etiq-gris">${esc(r.precio_txt)}</span>
    </div>
    <dl class="datos">
      <div><dt>Vas el día</dt><dd>D${e.dia.n} · ${esc(fechaLarga(e.dia.fecha))}
        <small>faltan ${e.faltanVisita} días</small></dd></div>
      <div><dt>Venta</dt><dd>${e.desdeSiempre
        ? 'Abierta desde hace meses'
        : `Se abrió el ${esc(fechaLarga(e.apertura))}`}
        <small>${e.desdeSiempre ? 'no hay ventana que esperar' : `${r.abre_dias_antes} días antes exactos de la visita`}</small></dd></div>
    </dl>
    <div class="tarjeta-c">
      <p>${esc(r.como)}</p>
      ${r.ojo ? `<div class="caja caja-ojo"><b class="caja-t">Ojo</b>${esc(r.ojo)}</div>` : ''}
      ${r.reventa ? `<p class="peq"><b>Cuidado con la reventa.</b> ${esc(r.reventa)}</p>` : ''}
      ${r.url ? `<p style="margin-top:10px">
        <a class="btn-oficial" href="${esc(r.url)}" target="_blank" rel="noopener">Web oficial →</a></p>` : ''}
    </div>
  </div>`;
}
