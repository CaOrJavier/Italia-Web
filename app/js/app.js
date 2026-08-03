// Router por hash y arranque. Las vistas se cargan en diferido: la del mapa
// se trae Leaflet detrás, y las otras cuatro no tienen por qué pagarlo.

import * as datos from './datos.js';
import { esc, fechaCorta, diasHasta } from './util.js';

const VISTAS = {
  rutas: () => import('./vistas/rutas.js'),
  mapa: () => import('./vistas/mapa.js'),
  comparar: () => import('./vistas/comparar.js'),
  mezclar: () => import('./vistas/mezclar.js'),
  resumen: () => import('./vistas/resumen.js'),
  comer: () => import('./vistas/comer.js'),
  aparcar: () => import('./vistas/aparcar.js')
};

const POR_DEFECTO = 'rutas';
const main = document.getElementById('vista');
const nav = document.getElementById('nav');

/** '#/rutas?r=toscana&d=3' → { vista: 'rutas', params: URLSearchParams } */
function leerRuta() {
  const bruto = location.hash.replace(/^#\/?/, '');
  const [camino, consulta] = bruto.split('?');
  const vista = camino || POR_DEFECTO;
  return {
    vista: VISTAS[vista] ? vista : POR_DEFECTO,
    params: new URLSearchParams(consulta || '')
  };
}

/** Navega sin recargar. Si solo cambian los parámetros, la vista se repinta igual. */
export function ir(vista, params) {
  const q = params && [...params.keys()].length ? `?${params}` : '';
  location.hash = `#/${vista}${q}`;
}

let vistaActual = null;
let descartar = null;

async function pintar() {
  const { vista, params } = leerRuta();

  // Deja que la vista anterior suelte lo suyo (el mapa se queda con listeners).
  if (descartar) { try { descartar(); } catch (e) { console.warn(e); } descartar = null; }

  marcarNav(vista);

  if (vista !== vistaActual) main.scrollTop = 0;
  vistaActual = vista;

  // Las vistas pueden marcar el contenedor (el modo de tres columnas lo ensancha).
  // Se limpia aquí para que la marca no se le quede pegada a la siguiente.
  main.className = '';
  main.innerHTML = '<p class="cargando">Un momento…</p>';
  try {
    const mod = await VISTAS[vista]();
    main.innerHTML = '';
    descartar = (await mod.pintar(main, params)) || null;
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="caja caja-mal">
      <b>No se ha podido abrir esta pantalla.</b>
      <p>${esc(e.message)}</p></div>`;
  }
}

function marcarNav(vista) {
  nav.querySelectorAll('a').forEach(a => {
    const activo = a.dataset.vista === vista;
    a.classList.toggle('activo', activo);
    if (activo) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function pintarCabecera() {
  const f = datos.VIAJE.ferri;
  const sub = document.getElementById('cabecera-sub');
  sub.textContent = `${fechaCorta(f.llegada.fecha)} → ${fechaCorta(f.salida.fecha)} · ${f.noches} noches`;

  const faltan = diasHasta(f.llegada.fecha);
  const caja = document.getElementById('cuenta');
  if (faltan > 0) {
    caja.innerHTML = `<b>${faltan}</b><span>${faltan === 1 ? 'día' : 'días'}</span>`;
    caja.title = `Faltan ${faltan} días para embarcar`;
    caja.hidden = false;
  } else {
    const finales = diasHasta(f.salida.fecha);
    if (finales >= 0) {
      caja.innerHTML = `<b>${12 - finales}</b><span>de 12</span>`;
      caja.title = 'Día de viaje';
      caja.hidden = false;
    }
  }
}

async function arrancar() {
  try {
    await datos.cargar();
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="caja caja-mal">
      <b>No se han podido cargar los datos del viaje.</b>
      <p>${esc(e.message)}</p>
      <p class="peq">Si has abierto el fichero con doble clic, no va a funcionar: hace falta
      servirlo desde un servidor local, por ejemplo con
      <code>python -m http.server 8123 --directory app</code>.</p></div>`;
    return;
  }
  pintarCabecera();
  addEventListener('hashchange', pintar);
  await pintar();
}

arrancar();
