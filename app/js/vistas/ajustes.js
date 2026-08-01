// Ajustes: tema, mapas offline, copia de seguridad y borrado.

import { esc, num, avisar, descargar } from '../util.js';
import * as datos from '../datos.js';
import * as estado from '../estado.js';
import { abrirHoja, cerrarHoja, repintar, confirmar } from '../ui.js';
import * as tiles from '../tiles.js';

const TEMAS = [
  { id: 'auto',     nombre: 'Automático',    pista: 'sigue al sistema' },
  { id: 'claro',    nombre: 'Claro',         pista: 'para el sol' },
  { id: 'oscuro',   nombre: 'Oscuro',        pista: 'ahorra batería' },
  { id: 'nocturno', nombre: 'Nocturno rojo', pista: 'de noche en el coche' }
];

// El navegador ofrece instalar la PWA una sola vez: se guarda el evento.
let eventoInstalar = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); eventoInstalar = e; });

let descargaEnCurso = null;

export function hojaAjustes() {
  const a = estado.obtener().ajustes;
  const s = estado.obtener();

  const cuerpo = abrirHoja('Ajustes', `
    <div class="seccion-tit" style="margin-top:4px">Aspecto</div>
    <div class="apilar">
      ${TEMAS.map(t => `<button class="btn btn-blq" data-tema="${t.id}"
        style="justify-content:space-between;${a.tema === t.id ? 'border-color:var(--acento);color:var(--acento)' : ''}">
        <span>${esc(t.nombre)}</span><span class="suave" style="font-weight:500">${esc(t.pista)}</span>
      </button>`).join('')}
    </div>

    <div class="seccion-tit">Tu edad</div>
    <p class="suave" style="font-size:14.5px">
      Decide qué descuentos te aplican: el de museos estatales italianos corta en 25 años
      y la Rolling Venice de Venecia en 29.
    </p>
    <label class="campo" style="margin-top:8px">
      <span>Años que tendrás en el viaje</span>
      <input type="number" id="aj-edad" inputmode="numeric" min="0" max="120" value="${Number(a.edad) || 29}">
    </label>
    <p id="veredicto-edad" class="suave" style="font-size:14px;margin-top:-4px"></p>

    <div class="seccion-tit">Mapas sin conexión</div>
    <div id="caja-mapas"></div>

    <div class="seccion-tit">Copia de seguridad</div>
    <p class="suave" style="font-size:14.5px">
      ${s.gastos.length} gasto${s.gastos.length === 1 ? '' : 's'} ·
      ${Object.keys(s.paradas_hechas).length} paradas hechas ·
      ${Object.keys(s.itinerario_editado).length} días editados.
      No hay servidor: si borras los datos del navegador, se pierde todo.
    </p>
    <div class="apilar" style="margin-top:10px">
      <button class="btn btn-pri btn-blq" data-exportar>Exportar a un fichero</button>
      <button class="btn btn-blq" data-importar>Importar desde un fichero</button>
      <input type="file" id="fichero" accept="application/json,.json" hidden>
    </div>

    <div class="seccion-tit">Instalar</div>
    <p class="suave" style="font-size:14.5px" id="txt-instalar">
      Instálala en la pantalla de inicio para abrirla sin navegador y que funcione en modo avión.
    </p>
    <button class="btn btn-blq" data-instalar style="margin-top:8px">Instalar la app</button>

    <div class="seccion-tit">Empezar de cero</div>
    <button class="btn btn-blq btn-peligro" data-borrar>Borrar todos mis datos</button>

    <p class="suave centro" style="font-size:13px;margin:22px 0 6px">
      Datos del viaje: ${datos.VIAJE.dias.length} días · ${datos.VIAJE.lugares.length} lugares ·
      generados el ${esc(datos.VIAJE.meta.generado)}.<br>
      Mapas © OpenStreetMap · Leaflet 1.9.4
    </p>`);

  pintarMapas(cuerpo.querySelector('#caja-mapas'));

  const campoEdad = cuerpo.querySelector('#aj-edad');
  const veredicto = cuerpo.querySelector('#veredicto-edad');
  const pintarVeredicto = () => {
    const e = Number(campoEdad.value) || 0;
    veredicto.innerHTML = e < 18
      ? 'Menor de 18: <b>entrada gratis</b> en museos estatales italianos.'
      : e <= 25
        ? 'Te aplica el <b>precio de 2 €</b> en museos estatales italianos (con DNI de la UE) y la <b>Rolling Venice</b>.'
        : e <= 29
          ? 'Pagas <b>tarifa completa</b> en museos estatales. Todavía te entra la <b>Rolling Venice</b> (hasta 29).'
          : 'Pagas <b>tarifa completa</b>: ningún descuento por edad te aplica.';
  };
  campoEdad.addEventListener('input', () => {
    estado.fijarAjuste('edad', Number(campoEdad.value) || 0);
    pintarVeredicto();
  });
  pintarVeredicto();

  cuerpo.addEventListener('click', async (ev) => {
    const tema = ev.target.closest('[data-tema]');
    if (tema) {
      estado.fijarAjuste('tema', tema.dataset.tema);
      const { aplicarTema } = await import('../app.js');
      aplicarTema();
      cerrarHoja();
      repintar();
      return;
    }

    if (ev.target.closest('[data-exportar]')) {
      const fecha = new Date().toISOString().slice(0, 10);
      descargar(`italia2026-copia-${fecha}.json`, estado.exportar());
      return avisar('Copia descargada');
    }

    if (ev.target.closest('[data-importar]')) return cuerpo.querySelector('#fichero').click();

    if (ev.target.closest('[data-instalar]')) {
      if (!eventoInstalar) {
        return avisar('Usa «Añadir a pantalla de inicio» del menú del navegador');
      }
      eventoInstalar.prompt();
      const { outcome } = await eventoInstalar.userChoice;
      eventoInstalar = null;
      return avisar(outcome === 'accepted' ? 'Instalada' : 'Instalación cancelada');
    }

    if (ev.target.closest('[data-borrar]')) {
      return confirmar('Borrar todos mis datos',
        'Se van los gastos, las paradas hechas, las reservas marcadas y los días editados. Los datos del viaje no se tocan. Esto no se puede deshacer.',
        'Borrar todo',
        () => { estado.borrarTodo(); avisar('Datos borrados'); repintar(); }, { peligro: true });
    }
  });

  cuerpo.querySelector('#fichero').addEventListener('change', async (ev) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    try {
      estado.importar(await f.text());
      cerrarHoja();
      repintar();
      avisar('Copia restaurada');
    } catch (e) {
      avisar('No se pudo importar: ' + e.message);
    }
  });
}

// ---------- Mapas offline ----------

async function pintarMapas(caja) {
  const urls = tiles.listaTeselas(datos.VIAJE.ruta_polilinea);
  const guardadas = await tiles.resumenCache();
  const listas = await tiles.yaDescargadas(urls);
  const faltan = urls.length - listas;

  caja.innerHTML = `
    <p class="suave" style="font-size:14.5px">
      Guarda el fondo del mapa en el móvil: el corredor de la ruta (zoom 8-12) y
      ${tiles.CIUDADES.length} ciudades a pie (zoom 13-15). Sin esto, en los Apeninos y
      en Cinque Terre verás los puntos pero no el mapa.
    </p>
    <div class="fila fila-sep" style="margin-top:10px">
      <span class="suave">Ya guardado</span>
      <b class="mono">${num(guardadas.n)} teselas · ~${num(guardadas.mb)} MB</b>
    </div>
    <div class="fila fila-sep" style="margin-top:6px">
      <span class="suave">Falta por descargar</span>
      <b class="mono">${num(faltan)} · ~${num(tiles.estimarMB(faltan))} MB</b>
    </div>
    <div id="progreso" style="margin-top:10px"></div>
    <div class="apilar" style="margin-top:10px">
      <button class="btn btn-blq" data-bajar ${faltan === 0 ? 'disabled' : ''}>
        ${faltan === 0 ? 'Todo descargado' : `Descargar ~${num(tiles.estimarMB(faltan))} MB`}
      </button>
      ${guardadas.n ? '<button class="btn btn-blq btn-peligro" data-limpiar>Borrar los mapas guardados</button>' : ''}
    </div>
    <p class="suave" style="font-size:13px;margin-top:9px">
      Hazlo con wifi. Las teselas son de OpenStreetMap, un servicio donado: la descarga va
      despacio a propósito y es para uso personal.
    </p>`;

  caja.querySelector('[data-bajar]')?.addEventListener('click', async (ev) => {
    const boton = ev.currentTarget;
    const prog = caja.querySelector('#progreso');
    if (descargaEnCurso) {
      descargaEnCurso.abortada = true;
      descargaEnCurso = null;
      boton.textContent = 'Cancelando…';
      return;
    }
    descargaEnCurso = { abortada: false };
    boton.textContent = 'Cancelar';

    const res = await tiles.descargar(urls, {
      senal: descargaEnCurso,
      alProgreso: ({ hechas, total, fallos }) => {
        const pct = total ? Math.round(hechas / total * 100) : 100;
        prog.innerHTML = `<div class="fila fila-sep" style="font-size:14px">
            <span>${num(hechas)} / ${num(total)}</span><b>${pct}%</b>
          </div>
          <div class="barra" style="margin-top:6px"><i style="width:${pct}%"></i></div>
          ${fallos ? `<p class="suave" style="font-size:13px;margin-top:5px">${num(fallos)} sin descargar (se reintentan al repetir)</p>` : ''}`;
      }
    });

    descargaEnCurso = null;
    avisar(res.cancelado ? 'Descarga cancelada' : `Mapas guardados (${num(res.hechas - res.fallos)} teselas)`);
    pintarMapas(caja);
  });

  caja.querySelector('[data-limpiar]')?.addEventListener('click', () => {
    confirmar('Borrar los mapas guardados',
      `Se liberan unos ${num(guardadas.mb)} MB. Los puntos y la ruta se seguirán viendo, pero sin fondo cuando no haya cobertura.`,
      'Borrar mapas',
      async () => { await tiles.borrarCache(); avisar('Mapas borrados'); pintarMapas(caja); }, { peligro: true });
  });
}
