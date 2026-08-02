// Las tres rutas, día a día.
//
// Dos modos: una ruta a lo largo (el de siempre, y el único que cabe en el móvil)
// y las tres en paralelo, alineadas día a día, que es donde se ve de un vistazo
// qué hace cada una el mismo martes. El segundo pide pantalla de ordenador.

import * as datos from '../datos.js';
import { esc, fechaLarga, fechaCorta, minutosAHoras, numero, euros } from '../util.js';
import { marcaDia, tiraLugares, leyenda } from '../marcas.js';
import { figura } from '../fotos.js';
import { ir } from '../app.js';

// Seis columnas piden sitio de verdad: por debajo de 1240 px no se leen.
const ANCHA = '(min-width: 1240px)';
const esAncha = () => matchMedia(ANCHA).matches;

export function pintar(main, params) {
  // El modo se respeta si viene en la URL; si no, lo decide el tamaño de pantalla.
  const pedidoModo = params.get('v');
  const modo = pedidoModo === 'tres' || pedidoModo === 'una'
    ? pedidoModo
    : (esAncha() ? 'tres' : 'una');

  // En pantalla estrecha las tres columnas no caben: se cae al modo de una ruta.
  const real = modo === 'tres' && !esAncha() ? 'una' : modo;

  main.classList.toggle('vista-ancha', real === 'tres');
  if (real === 'tres') paralelo(main, params, !!pedidoModo);
  else unaSola(main, params, !!pedidoModo);

  // Si el modo no lo ha elegido el usuario, sigue al tamaño de la ventana.
  if (pedidoModo) return null;
  const mq = matchMedia(ANCHA);
  const alCambiar = () => pintar(main, params);
  mq.addEventListener('change', alCambiar);
  return () => mq.removeEventListener('change', alCambiar);
}

// ── Modo una ruta ──────────────────────────────────────────────────────────

/** Solo se arrastra el modo por la URL si lo eligió el usuario. Si lo decidió el
 *  tamaño de pantalla, se deja fuera: así el mismo enlace abierto en el ordenador
 *  vuelve a salir en tres columnas. */
function conModo(explicito, modo, resto) {
  return new URLSearchParams(explicito ? { v: modo, ...resto } : resto);
}

function unaSola(main, params, modoExplicito) {
  const idRuta = datos.RUTA.has(params.get('r')) ? params.get('r') : datos.RUTAS.rutas[0].id;
  const ruta = datos.RUTA.get(idRuta);
  // Sin día en la URL se abre el primero, como muestra de lo que hay dentro.
  const pedido = params.has('d');
  const abierto = pedido ? Number(params.get('d')) : 0;

  main.innerHTML = `
    <p class="intro">${esc(datos.RUTAS.intro)}</p>
    ${cambiaModo('una')}
    ${selector(idRuta)}
    ${resumen(ruta)}
    ${comun()}
    <h2 class="seccion">Los doce días</h2>
    <div class="tarjeta">${ruta.dias.map(d => dia(d, d.n === abierto)).join('')}</div>
  `;

  main.querySelectorAll('.selector button').forEach(b => {
    b.addEventListener('click', () => ir('rutas', conModo(modoExplicito, 'una', { r: b.dataset.r })));
  });
  enlazarModo(main);

  // El día abierto se recuerda en la URL, para poder compartir un día concreto.
  main.querySelectorAll('details.dia').forEach(d => {
    d.addEventListener('toggle', () => {
      if (!d.open) return;
      const q = conModo(modoExplicito, 'una', { r: idRuta, d: d.dataset.n });
      history.replaceState(null, '', `#/rutas?${q}`);
    });
  });

  // Solo se salta al día si venía pedido en la URL: si no, la pantalla empieza arriba.
  if (pedido) {
    const abre = main.querySelector('details.dia[open]');
    if (abre) abre.scrollIntoView({ block: 'center' });
  }
}

// ── Modo tres columnas ─────────────────────────────────────────────────────

function paralelo(main, params, modoExplicito) {
  const rutas = datos.RUTAS.rutas;
  const abierto = params.has('d') ? Number(params.get('d')) : null;
  const dias = rutas[0].dias.length;

  main.innerHTML = `
    <p class="intro">Las seis a la vez, alineadas por día. Pincha en cualquier casilla y se
    abre la fila entera: así ves qué hacen las otras tres rutas ese mismo día.</p>
    ${cambiaModo('tres')}
    ${leyenda()}
    ${comun()}
    <div class="par">
      <div class="par-fila par-cab">
        <div class="par-dia-hueco"></div>
        ${rutas.map(cabeceraRuta).join('')}
      </div>
      ${Array.from({ length: dias }, (_, n) => fila(n, rutas, n === abierto)).join('')}
    </div>
    <p class="peq">Los kilómetros de cada casilla son solo los de ese día. En rojo, con un
    <b>!</b>, los días en los que las visitas no caben contando el tiempo real de aparcar y
    entrar en transporte público.</p>
  `;

  enlazarModo(main);

  main.querySelectorAll('.par-abre').forEach(b => {
    b.addEventListener('click', () => {
      const filaEl = b.closest('.par-fila');
      const abre = !filaEl.classList.contains('abierta');
      filaEl.classList.toggle('abierta', abre);
      filaEl.querySelectorAll('.par-abre').forEach(x => x.setAttribute('aria-expanded', String(abre)));
      const q = conModo(modoExplicito, 'tres', abre ? { d: filaEl.dataset.n } : {});
      history.replaceState(null, '', `#/rutas${[...q.keys()].length ? '?' + q : ''}`);
    });
  });

  main.querySelectorAll('[data-sola]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      // Aquí sí es una elección: quiere esa ruta sola, aunque la pantalla dé para tres.
      ir('rutas', new URLSearchParams({ v: 'una', r: a.dataset.sola }));
    });
  });
}

function cabeceraRuta(r) {
  return `<div class="par-ruta" style="--barra:${esc(r.color)}">
    <b>${r.numero}. ${esc(r.nombre)}</b>
    <span>${esc(r.lema)}</span>
    <span class="par-cifras">${numero(r.km)} km · ${minutosAHoras(r.minutos_volante)} · ${euros(r.coste_estimado)}</span>
    <a href="#/rutas?v=una&amp;r=${esc(r.id)}" data-sola="${esc(r.id)}">Ver solo esta →</a>
  </div>`;
}

function fila(n, rutas, abierta) {
  const dia0 = rutas[0].dias[n];
  return `<div class="par-fila${abierta ? ' abierta' : ''}" data-n="${n}">
    <div class="par-dia">
      <button type="button" class="par-abre" aria-expanded="${abierta}"
              aria-label="Abrir el día ${n} en las seis rutas">
        <b>D${n}</b><span>${esc(fechaCorta(dia0.fecha))}</span>
      </button>
    </div>
    ${rutas.map(r => celda(r.dias[n], r, abierta)).join('')}
  </div>`;
}

function celda(d, r, abierta) {
  const cama = datos.camaDe(d);
  return `<div class="par-celda" style="--barra:${esc(r.color)}">
    <button type="button" class="par-abre par-t" aria-expanded="${abierta}">
      <b>${esc(d.titulo)}</b>
      <span class="par-etapa">${esc(d.etapa)}</span>
      <span class="par-meta">
        <span class="etiq etiq-gris">${d.km} km · ${minutosAHoras(d.minutos)}</span>
        ${marcaDia(d)}
        ${d.apretado ? '<span class="etiq etiq-rojo">! apretado</span>' : ''}
      </span>
      <span class="par-cama">${cama
        ? (cama.precio === 0 ? '☾ ' : '☾ ') + esc(cama.nombre.split('·')[0].trim())
        : '⇄ ferri de vuelta'}</span>
    </button>
    <div class="par-detalle">${detalle(d)}</div>
  </div>`;
}

// ── Piezas compartidas ─────────────────────────────────────────────────────

function cambiaModo(activo) {
  return `<div class="filtros modo" role="group" aria-label="Cómo ver las rutas">
    <button type="button" data-modo="una" aria-pressed="${activo === 'una'}">Una ruta a lo largo</button>
    <button type="button" data-modo="tres" aria-pressed="${activo === 'tres'}">Las seis en paralelo</button>
  </div>`;
}

function enlazarModo(main) {
  main.querySelectorAll('.modo button').forEach(b => {
    b.addEventListener('click', () => {
      if (b.getAttribute('aria-pressed') === 'true') return;
      ir('rutas', new URLSearchParams({ v: b.dataset.modo }));
    });
  });
}

export function selector(activa) {
  return `<div class="selector">${datos.RUTAS.rutas.map(r => {
    const solos = datos.exclusivosDe(r.id).length;
    return `
    <button type="button" data-r="${esc(r.id)}" aria-pressed="${r.id === activa}"
            style="--barra:${esc(r.color)}">
      <span class="num">${r.numero}</span>
      <span class="txt"><b>${esc(r.nombre)}</b><span>${esc(r.lema)}</span></span>
      <span class="cifra">${numero(r.km)} km<br>${minutosAHoras(r.minutos_volante)}
        ${solos ? `<br><span class="marca marca-solo" style="--m:${esc(r.color)}"
          title="${solos} sitios que no salen en ninguna otra ruta"><span class="marca-s"
          aria-hidden="true">★</span><span>${solos} propios</span></span>` : ''}</span>
    </button>`;
  }).join('')}</div>`;
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

/** Las fotos de los sitios del día. Como mucho cuatro: es una muestra, no un álbum. */
function fotosDia(d) {
  const con = datos.lugaresDeDia(d).filter(l => datos.fotoDe(l.id)).slice(0, 4);
  if (!con.length) return '';
  return `<div class="rejilla rejilla-dia">${con.map(l =>
    figura(l.id, { alto: 96, pie: l.nombre })).join('')}</div>`;
}

/** El cuerpo de un día. Lo comparten los dos modos, para que no se dupliquen los datos. */
function detalle(d) {
  const parkings = datos.parkingsDe(d);
  const cama = datos.camaDe(d);
  const tpt = datos.minutosTransporte(d);

  return `
    <p class="peq" style="margin:-2px 0 10px">${esc(fechaLarga(d.fecha))}</p>

    ${d.apretado ? `<div class="caja caja-ojo">
      <b class="caja-t">Día apretado</b>${esc(d.apretado)}</div>` : ''}

    <ul class="horas">${d.plan.map(p =>
      `<li><time>${esc(p.hora)}</time><span>${esc(p.que)}</span></li>`).join('')}</ul>

    ${d.aviso ? `<div class="caja caja-ojo"><b class="caja-t">Ojo</b>${esc(d.aviso)}</div>` : ''}

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
