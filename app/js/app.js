// Arranque y enrutado por hash. Cada pantalla vive en js/vistas/.

import { $, $$, avisar } from './util.js';
import { cerrarHoja, registrarPintor } from './ui.js';
import * as datos from './datos.js';
import * as estado from './estado.js';

import { vistaHoy } from './vistas/hoy.js';
import { vistaRuta } from './vistas/ruta.js';
import { vistaMapa } from './vistas/mapa.js';
import { vistaGasto, hojaGastoRapido } from './vistas/gasto.js';
import { vistaGuia } from './vistas/guia.js';
import { vistaAlternativas } from './vistas/alternativas.js';
import { vistaIdioma } from './vistas/lengua.js';
import { hojaAjustes } from './vistas/ajustes.js';

const VISTAS = {
  hoy:   { titulo: 'Hoy',         render: vistaHoy },
  ruta:  { titulo: 'Itinerario',  render: vistaRuta },
  mapa:  { titulo: 'Mapa',        render: vistaMapa },
  gasto: { titulo: 'Presupuesto', render: vistaGasto },
  guia:  { titulo: 'Guía',        render: vistaGuia },
  alternativas: { titulo: 'Alternativas', render: vistaAlternativas },
  idioma: { titulo: 'Idioma', render: vistaIdioma }
};

let limpiarVista = null;

export function aplicarTema() {
  document.documentElement.dataset.tema = estado.obtener().ajustes.tema || 'auto';
  const claro = document.documentElement.dataset.tema === 'claro';
  $('meta[name="theme-color"]')?.setAttribute('content', claro ? '#8c2f22' : '#101216');
}

function partes() {
  const bruto = location.hash.replace(/^#\/?/, '') || 'hoy';
  const [nombre, consulta] = bruto.split('?');
  return { nombre: VISTAS[nombre] ? nombre : 'hoy', params: new URLSearchParams(consulta || '') };
}

function pintar() {
  const { nombre, params } = partes();
  const vista = VISTAS[nombre];

  limpiarVista?.();
  limpiarVista = null;
  cerrarHoja();

  $('#cab-tit').textContent = vista.titulo;
  document.body.dataset.vista = nombre;   // en móvil, con la pestaña activa el título sobra
  $$('.nav-item, .pestana').forEach(a => a.setAttribute('aria-current', a.dataset.ruta === nombre ? 'page' : 'false'));
  $('#fab-gasto').hidden = (nombre === 'gasto');

  const contenedor = $('#vista');
  contenedor.innerHTML = '';
  window.scrollTo(0, 0);

  const salida = vista.render(contenedor, params);
  if (typeof salida === 'function') limpiarVista = salida;
}

async function registrarSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });
    // Con caché primero, una versión nueva no se ve hasta reabrir: mejor avisar.
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      nuevo?.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
          avisar('Hay una versión nueva: ciérrala y vuelve a abrirla');
        }
      });
    });
  } catch (e) {
    console.warn('Service worker no registrado:', e.message);
  }
}

async function arrancar() {
  try {
    await datos.cargar();
  } catch (e) {
    const caja = $('#arranque');
    caja.dataset.error = '1';
    $('#arranque-msg').innerHTML =
      `No se han podido cargar los datos del viaje.<br><small>${e.message}</small><br><br>` +
      '<small>Ábrela desde un servidor local, no con doble clic:<br><code>python -m http.server 8080</code></small>';
    return;
  }

  aplicarTema();
  registrarPintor(pintar);

  $('#arranque').remove();
  for (const id of ['cabecera', 'vista', 'nav']) $('#' + id).hidden = false;
  $('#cab-sup').textContent = 'Italia · 14-25 agosto 2026';

  addEventListener('hashchange', pintar);
  $('#btn-ajustes').addEventListener('click', hojaAjustes);
  $('#hoja-cerrar').addEventListener('click', cerrarHoja);
  $('#hoja-fondo').addEventListener('click', cerrarHoja);
  $('#fab-gasto').addEventListener('click', () => hojaGastoRapido());
  addEventListener('keydown', e => { if (e.key === 'Escape') cerrarHoja(); });

  // Al volver a la app tras un rato, la pantalla Hoy puede haberse quedado vieja.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && partes().nombre === 'hoy') pintar();
  });

  pintar();
  registrarSW();
}

arrancar();
