// Pantalla Hoy: responde de un vistazo a "son las 14:30 del día 19, ¿qué hago ahora?".

import { esc, ahora, aMinutos, fechaLarga, diasEntre, eur, duracion, num, soloTexto, recortar } from '../util.js';
import * as datos from '../datos.js';
import * as estado from '../estado.js';
import { ir, hojaNavegar, abrirHoja } from '../ui.js';
import { ilustracionDia } from '../ilustraciones.js';
import { fotoDia } from '../fotos.js';

const SOL = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/></svg>`;
const LUNA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.2 8.2 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/></svg>`;

export function vistaHoy(raiz, params) {
  const t = ahora();
  const diaHoy = datos.diaPorFecha(t.fecha);
  const primero = datos.dias()[0];
  const ultimo = datos.dias()[datos.dias().length - 1];

  const antes = t.fecha < primero.fecha;
  const despues = t.fecha > ultimo.fecha;

  // Día que se está mirando: el real, o el que se elija con el selector.
  const pedido = params.get('dia');
  const n = pedido !== null && datos.dia(pedido) ? Number(pedido)
          : diaHoy ? diaHoy.dia
          : antes ? 0 : ultimo.dia;
  const esElDeHoy = !!diaHoy && diaHoy.dia === n;
  const d = datos.dia(n);

  const partes = [];

  // Orden pensado para la pregunta que más se va a hacer: «son las 14:30,
  // ¿qué hago ahora?». Durante el viaje eso va lo primero; el resto, debajo.
  if (antes) partes.push(bloqueCuentaAtras(t.fecha, primero));
  if (despues) partes.push(`<div class="tarjeta centro"><h2>Viaje terminado</h2>
    <p class="suave">Volviste el ${fechaLarga(ultimo.fecha)}. Los gastos siguen guardados en la pestaña Presupuesto.</p></div>`);

  partes.push(bloqueCriticas());
  partes.push(lineaDia(d, esElDeHoy));

  if (d.aviso) {
    partes.push(`<div class="tarjeta" style="border-color:var(--alerta);background:var(--alerta-sua)">
      <p style="margin:0"><b>${esc(d.aviso)}</b></p></div>`);
  }

  partes.push(esElDeHoy ? bloquesAhora(n, t) : bloquePlanCompleto(n));
  partes.push(bloqueSiguientePunto(n, esElDeHoy));
  partes.push(bloqueGasto(n, esElDeHoy ? t.fecha : d.fecha));

  partes.push('<div class="seccion-tit">Otro día</div>');
  partes.push(tiraDias(n, diaHoy?.dia));
  partes.push(bloqueDia(d, n));

  raiz.innerHTML = partes.filter(Boolean).join('');

  raiz.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-accion]');
    if (!b) return;
    const { accion, valor } = b.dataset;
    if (accion === 'dia')      ir(`#/hoy?dia=${valor}`);
    if (accion === 'navegar')  { const [la, lo] = valor.split(','); hojaNavegar(+la, +lo, b.dataset.nombre || ''); }
    if (accion === 'ruta')     ir(`#/ruta?dia=${valor}`);
    if (accion === 'reservas') ir('#/guia?ficha=reservas');
    if (accion === 'franja')   verFranja(n, Number(valor));
  });

  // El selector de días se coloca sobre el día visible.
  raiz.querySelector('.tira-dia[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

// ---------- Bloques ----------

function bloqueCuentaAtras(hoy, primero) {
  const faltan = diasEntre(hoy, primero.fecha);
  return `<div class="tarjeta">
    <div class="contador">
      <div class="n">${faltan}</div>
      <div class="t">${faltan === 1 ? 'día para salir' : 'días para salir'}</div>
    </div>
    <p class="centro suave" style="margin-top:10px">
      Ferri a <b>${esc(datos.VIAJE.meta.llegada.puerto)}</b> el ${fechaLarga(primero.fecha)} a las <b>${esc(datos.VIAJE.meta.llegada.hora)}</b>.
    </p>
  </div>`;
}

function bloqueCriticas() {
  const criticas = datos.reservasCriticasPendientes();
  if (!criticas.length) return '';
  return `<div class="tarjeta" style="border:2px solid var(--peligro);background:var(--peligro-sua)">
    <div class="fila fila-sep">
      <h2 style="color:var(--peligro)">Sin reservar todavía</h2>
      <span class="etiq etiq-peligro">${criticas.length} crítica${criticas.length > 1 ? 's' : ''}</span>
    </div>
    ${criticas.map(r => `
      <div class="item-lista" style="border-color:var(--peligro)">
        <div class="crece">
          <div style="font-weight:700">${esc(r.que)}</div>
          <div class="suave" style="font-size:14.5px">${esc(r.fecha)}${r.hora ? ' · ' + esc(r.hora) : ''} · ${eur(r.precio_eur)}</div>
        </div>
      </div>`).join('')}
    <button class="btn btn-pri btn-blq" data-accion="reservas" style="margin-top:10px">Ir a reservas</button>
  </div>`;
}

function tiraDias(activo, hoy) {
  return `<div class="tira-dias">${datos.dias().map(d => `
    <button class="tira-dia ${d.dia === hoy ? 'es-hoy' : ''}" data-accion="dia" data-valor="${d.dia}"
            aria-pressed="${d.dia === activo}" title="${esc(d.titulo)}">
      <b>${esc(d.etiqueta)}</b>
      <span>${esc(d.fecha.slice(8))} ${esc(d.dia_semana.slice(0, 3))}</span>
    </button>`).join('')}</div>`;
}

/** Contexto en una línea: qué día es y de qué va, sin robar sitio al «ahora». */
function lineaDia(d, esHoy) {
  return `<div class="linea-dia">
    <span class="linea-dia-ilus">${ilustracionDia(d.dia)}<b>${esc(d.etiqueta)}</b></span>
    <span class="crece">
      <b>${esc(d.titulo)}</b>
      <span class="suave">${esHoy ? 'hoy, ' : ''}${esc(fechaLarga(d.fecha))}</span>
    </span>
  </div>`;
}

function bloqueDia(d, n) {
  const r = datos.resumenDia(n);
  const noche = datos.nocheDe(n);
  // La foto va en esta tarjeta-resumen del final, no arriba: en el día real
  // lo primero tiene que ser "qué hago ahora", y un banner lo empuja fuera
  // de la pantalla.
  return `<div class="tarjeta">
    ${fotoDia(n)}
    <div class="fila fila-sep" style="align-items:flex-start">
      <div class="crece">
        <div class="suave" style="font-size:13.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">
          ${esc(d.etiqueta)} · ${esc(fechaLarga(d.fecha))}
        </div>
        <h2 style="font-size:21px;margin:3px 0 4px">${esc(d.titulo)}</h2>
        <div class="suave" style="font-size:15px">${esc(d.etapa)}</div>
      </div>
    </div>
    <div class="envuelve" style="margin-top:11px">
      <span class="etiq">${num(r.km)} km</span>
      <span class="etiq ${r.minutos > 240 ? 'etiq-alerta' : ''}">${duracion(r.minutos)} de volante</span>
      ${r.estimado ? '<span class="etiq etiq-info">día editado</span>' : ''}
      ${noche ? `<span class="etiq etiq-ok">Dormir: ${esc(noche.nombre.split('(')[0].trim())}</span>` : ''}
    </div>
    <div class="dato-sol" style="margin-top:11px">
      <span>${SOL} ${esc(d.amanecer)}</span>
      <span>${LUNA} ${esc(d.ocaso)}</span>
      <button class="btn btn-peq" style="margin-left:auto" data-accion="ruta" data-valor="${n}">Ver el día</button>
    </div>
  </div>`;
}

function tarjetaFranja(f, i, { destacada, etiqueta }) {
  const resumen = recortar(soloTexto(f.html), destacada ? 240 : 130);
  return `<div class="ahora ${destacada ? '' : 'despues'}">
    <div class="ahora-cinta"><span>${etiqueta}</span><span class="hora">${esc(f.hora)}</span></div>
    <div class="ahora-cuerpo">
      <div class="ahora-etiq">${esc(f.etiqueta)}</div>
      <p class="suave" style="font-size:16px">${esc(resumen)}</p>
      <button class="btn btn-peq" data-accion="franja" data-valor="${i}" style="margin-top:10px">Leer entero</button>
    </div>
  </div>`;
}

function bloquesAhora(n, t) {
  const { actual, siguiente, indice } = datos.franjaEnCurso(n, t.hora);
  const franjas = datos.franjasDe(n);
  if (!franjas.length) return '';

  let salida = '';
  if (actual) {
    salida += tarjetaFranja(actual, indice, { destacada: true, etiqueta: 'Ahora' });
  } else {
    const prim = franjas[0];
    salida += `<div class="ahora">
      <div class="ahora-cinta"><span>Ahora</span><span class="hora">${esc(t.hora)}</span></div>
      <div class="ahora-cuerpo">
        <div class="ahora-etiq">Todavía de noche</div>
        <p class="suave" style="font-size:16px">El día arranca a las <b>${esc(prim.hora)}</b> (${esc(prim.etiqueta)}). Quedan ${duracion(aMinutos(prim.hora) - t.min)}.</p>
      </div>
    </div>`;
  }
  if (siguiente) salida += tarjetaFranja(siguiente, indice + 1, { destacada: false, etiqueta: 'Después' });
  else if (actual) salida += `<div class="tarjeta suave centro">Última franja del día. Mañana: <b>${esc(datos.dia(n + 1)?.titulo ?? 'vuelta a casa')}</b>.</div>`;
  return salida;
}

function bloquePlanCompleto(n) {
  const franjas = datos.franjasDe(n);
  if (!franjas.length) return '';
  return `<div class="seccion-tit">Plan del día</div>
    <div class="tarjeta">${franjas.map((f, i) => `
      <div class="franja">
        <div class="franja-hora">${esc(f.hora)}<span>${esc(f.etiqueta)}</span></div>
        <div class="crece">
          <p class="suave" style="font-size:15.5px;margin:0">${esc(recortar(soloTexto(f.html), 150))}</p>
          <button class="btn btn-peq" data-accion="franja" data-valor="${i}" style="margin-top:8px">Leer entero</button>
        </div>
      </div>`).join('')}</div>`;
}

function bloqueSiguientePunto(n, esHoy) {
  const s = estado.obtener();
  const paradas = datos.paradasVisibles(n).filter(p => Number.isFinite(p.lat));
  const pendiente = paradas.find(p => !s.paradas_hechas[p.id]) ?? paradas[0];
  if (!pendiente) return '';
  const cat = datos.categoria(pendiente.categoria);
  return `<div class="tarjeta">
    <div class="seccion-tit" style="margin:0 0 8px">${esHoy ? 'Siguiente parada' : 'Primera parada del día'}</div>
    <div class="fila">
      <span class="parada-punto" style="background:${cat.color};margin-top:0"></span>
      <div class="crece">
        <div style="font-weight:700;font-size:17px">${esc(pendiente.nombre)}</div>
        <div class="suave" style="font-size:14.5px">${esc(cat.nombre)}${pendiente.precio ? ' · ' + esc(pendiente.precio) : ''}</div>
      </div>
    </div>
    ${pendiente.coords_aproximadas ? '<p class="suave" style="font-size:14px;margin-top:8px">Coordenadas aproximadas: fíate de la dirección del texto.</p>' : ''}
    <button class="btn btn-pri btn-blq" style="margin-top:11px"
            data-accion="navegar" data-valor="${pendiente.lat},${pendiente.lon}" data-nombre="${esc(pendiente.nombre)}">
      Navegar
    </button>
  </div>`;
}

function bloqueGasto(n, fecha) {
  const previsto = datos.previstoDia(n);
  const real = estado.totalDe(fecha);
  const pct = previsto > 0 ? Math.min(140, Math.round(real / previsto * 100)) : 0;
  const clase = pct > 100 ? 'va-mal' : pct > 85 ? 'va-justo' : '';
  return `<div class="tarjeta">
    <div class="fila fila-sep">
      <div>
        <div class="seccion-tit" style="margin:0 0 4px">Gasto del ${esc(fecha.slice(8, 10))}</div>
        <div class="cifra"><b>${eur(real)}</b><span>de ${eur(previsto)} previstos</span></div>
      </div>
      <span class="etiq ${pct > 100 ? 'etiq-peligro' : 'etiq-ok'}">${pct}%</span>
    </div>
    <div class="barra ${clase}" style="margin-top:10px"><i style="width:${Math.min(100, pct)}%"></i></div>
  </div>`;
}

function verFranja(n, i) {
  const f = datos.franjasDe(n)[i];
  if (!f) return;
  abrirHoja(`${f.hora} · ${f.etiqueta}`, `<div class="prosa">${f.html}</div>`);
}
