// Alternativas: las tres rutas que se comparan contra el itinerario cargado,
// con sus km, sus horas de volante, su coste y su día a día en paralelo.
//
// Es una pantalla de decisión, de lectura: no toca el estado ni el itinerario.
// Cuando se elija una, se convierte a datos-viaje.json aparte.

import { esc, num, duracion } from '../util.js';
import * as datos from '../datos.js';
import { plegable, recordarPliegues, abrirHoja } from '../ui.js';

const LIMITE_VOLANTE = 240;

/** Los mismos colores que la tabla comparativa y el mapa de las tres rutas. */
const COLOR = { termas: 'var(--ok)', 'roma-mar': 'var(--info)', norte: 'var(--alerta)' };

export function vistaAlternativas(raiz) {
  const A = datos.ALTERNATIVAS;
  if (!A) {
    raiz.innerHTML = '<div class="tarjeta"><p class="suave">No se han podido cargar las alternativas.</p></div>';
    return;
  }

  raiz.innerHTML = `
    <div class="tarjeta">
      <div class="seccion-tit" style="margin:0 0 8px">Tres rutas alternativas</div>
      <p class="prosa" style="font-size:15.5px">${A.intro}</p>
      ${bloqueEsenciales(A.esenciales)}
    </div>

    ${tarjetasOpciones(A.opciones)}

    ${tablaComparativa(A.comparativa)}

    ${caraACara(A.opciones)}

    ${bloqueSaturnia(A.saturnia)}

    ${bloqueDiagnostico(A.diagnostico)}

    ${A.opciones.filter(o => o.dias.length).map(bloqueOpcion).join('')}

    ${bloqueDecidir(A.decidir)}

    ${bloqueVerificar(A.verificar)}`;

  recordarPliegues(raiz);
  engancharCaraACara(raiz, A.opciones);
}

// ---------- Cara a cara: los doce días, las tres rutas, en paralelo ----------

/**
 * La comparación que de verdad se usa para decidir: día a día y en columnas,
 * sin subir y bajar. Cada fila es un día; cada columna, una ruta.
 *
 * Se marca lo que diferencia a una ruta de las otras dos (borde de su color)
 * y, en los kilómetros, quién conduce menos ese día (▼) y quién más (▲).
 */
function caraACara(opciones) {
  const rutas = opciones.filter(o => o.dias?.length);
  if (rutas.length < 2) return '';
  const dias = rutas[0].dias;

  return `<div class="seccion-tit">Cara a cara <span class="cnt">· los 12 días en paralelo</span></div>
  <div class="tarjeta">
    <div class="envuelve" style="margin-bottom:10px">
      <button class="btn btn-peq btn-pri" data-cac="dif">Solo las diferencias</button>
      <button class="btn btn-peq" data-cac="todo" hidden>Ver los 12 días</button>
    </div>

    <div class="cac" id="cac">
      <div class="cac-fila cac-cab">
        <span></span>
        ${rutas.map(r => `<span style="--c:${COLOR[r.id]}"><b>${esc(r.letra)}</b>${esc(r.etiqueta_corta || r.nombre)}</span>`).join('')}
      </div>

      ${dias.map((_, i) => filaDia(rutas, i)).join('')}

      <div class="cac-fila cac-total">
        <span>Total</span>
        ${rutas.map(r => {
          const km = r.dias.reduce((t, d) => t + d.km, 0);
          const min = Math.min(...rutas.map(x => x.dias.reduce((t, d) => t + d.km, 0)));
          return `<span style="--c:${COLOR[r.id]}"><b>${num(km)}</b><i>km${km === min ? ' ▼' : ''}</i></span>`;
        }).join('')}
      </div>
    </div>

    <p class="alt-leyenda">
      Cada columna es una ruta y cada fila un día. <b>El borde de color</b> marca a la que hace algo
      distinto de las otras dos; <span class="cac-menos">▼</span> es quien menos conduce ese día y
      <span class="cac-mas">▲</span> quien más. Toca cualquier celda para ver el día entero.
    </p>
  </div>`;
}

function filaDia(rutas, i) {
  const celdas = rutas.map(r => r.dias[i]);
  const textos = celdas.map(c => c.corto || c.etapa);
  const iguales = textos.every(t => t === textos[0]);
  const kms = celdas.map(c => c.km);
  const menos = Math.min(...kms), mas = Math.max(...kms);

  return `<div class="cac-fila ${iguales ? 'cac-igual' : ''}" data-dif="${iguales ? '0' : '1'}">
    <span class="cac-dia">${esc(celdas[0].etiqueta)}</span>
    ${celdas.map((c, j) => {
      const r = rutas[j];
      // Una celda «suelta» es la que no repite ninguna otra: es lo que distingue a esa ruta.
      const suelta = !iguales && textos.filter(t => t === textos[j]).length === 1;
      const flecha = menos === mas ? '' : c.km === menos ? '<i class="cac-menos">▼</i>' : c.km === mas ? '<i class="cac-mas">▲</i>' : '';
      return `<button class="cac-celda ${suelta ? 'suelta' : ''}" style="--c:${COLOR[r.id]}"
                data-ruta="${esc(r.id)}" data-dia="${i}">
        <b>${esc(c.corto || c.etapa)}</b>
        <i class="cac-km">${num(c.km)} km ${flecha}</i>
      </button>`;
    }).join('')}
  </div>`;
}

function engancharCaraACara(raiz, opciones) {
  const caja = raiz.querySelector('#cac');
  if (!caja) return;
  const rutas = opciones.filter(o => o.dias?.length);

  raiz.querySelectorAll('[data-cac]').forEach(b => b.addEventListener('click', () => {
    const soloDif = b.dataset.cac === 'dif';
    caja.querySelectorAll('[data-dif="0"]').forEach(f => { f.hidden = soloDif; });
    raiz.querySelector('[data-cac="dif"]').hidden = soloDif;
    raiz.querySelector('[data-cac="todo"]').hidden = !soloDif;
  }));

  caja.addEventListener('click', ev => {
    const b = ev.target.closest('.cac-celda');
    if (!b) return;
    const r = rutas.find(x => x.id === b.dataset.ruta);
    const d = r.dias[Number(b.dataset.dia)];
    abrirHoja(`${d.etiqueta} · Ruta ${r.letra}`, `
      <div class="envuelve" style="margin-bottom:10px">
        <span class="etiq" style="background:${COLOR[r.id]};color:#fff">${esc(r.nombre)}</span>
        <span class="etiq">${num(d.km)} km</span>
        <span class="etiq">${duracion(d.min)} de volante</span>
      </div>
      <p style="font-size:16.5px;font-weight:600">${esc(d.etapa)}</p>
      <p class="suave" style="margin-top:8px">Duerme en <b>${esc(d.dormir)}</b>${d.verificar ? ' — por verificar' : ''}</p>
      ${rutas.filter(x => x.id !== r.id).map(x => `
        <div class="item-lista">
          <span class="ruta-color" style="background:${COLOR[x.id]};margin-top:5px"></span>
          <div class="crece">
            <div style="font-weight:700">Ruta ${esc(x.letra)}: ${esc(x.dias[Number(b.dataset.dia)].corto || '')}</div>
            <div class="suave" style="font-size:14px">${esc(x.dias[Number(b.dataset.dia)].etapa)}</div>
          </div>
          <b class="mono">${num(x.dias[Number(b.dataset.dia)].km)} km</b>
        </div>`).join('')}
      <a class="btn btn-pri btn-blq" href="#/mapa?vista=rutas&r=${esc(r.id)}" style="margin-top:12px">Ver la ruta ${esc(r.letra)} en el mapa</a>`);
  });
}

// ---------- Lo que no se negocia ----------

function bloqueEsenciales(e) {
  if (!e) return '';
  return `<div class="alt-esenciales">
    <div class="alt-esenciales-tit">${esc(e.titulo)}</div>
    ${e.items.map(x => `
      <div class="alt-esencial">
        <b>${esc(x.que)}</b>
        <span>${esc(x.detalle)}</span>
      </div>`).join('')}
  </div>`;
}

// ---------- Saturnia ----------

function bloqueSaturnia(s) {
  if (!s) return '';
  return plegable('alt-saturnia', s.titulo, 'Termas gratis, 24 h, en las tres rutas', `
    <div class="prosa" style="font-size:15.5px">${s.porque_html}</div>
    <div class="alt-datos">
      ${s.datos.map(d => `
        <div class="alt-dato">
          <b>${esc(d.que)}</b>
          <span>${esc(d.detalle)}</span>
        </div>`).join('')}
    </div>
    <div class="caja-decision"><div class="prosa">${s.encaje_html}</div></div>`, { abierto: true });
}

// ---------- Las tres opciones de un vistazo ----------

function tarjetasOpciones(opciones) {
  // El plan cargado no compite con las tres rutas: es contra lo que se comparan.
  const fuera = opciones.filter(o => !o.dias?.length);
  const vivas = opciones.filter(o => o.dias?.length);

  return `${fuera.map(o => `
    <div class="alt-fuera">
      <span class="alt-fuera-x" aria-hidden="true">▸</span>
      <span class="crece">
        <b>${esc(o.nombre)}</b>
        <span>${esc(o.apodo)} · ${num(o.km)} km · ${esc(o.volante)} · ${esc(o.coste)}</span>
      </span>
      <span class="etiq etiq-info">cargado</span>
    </div>`).join('')}

  <div class="alt-tarjetas">
    ${vivas.map(o => `
      <div class="alt-card ${o.actual ? 'es-actual' : ''} ${o.recomendada ? 'es-reco' : ''}">
        <div class="alt-card-top">
          <span class="alt-letra">${esc(o.letra)}</span>
          ${o.actual ? '<span class="etiq etiq-info">en la app</span>' : ''}
          ${o.recomendada ? '<span class="etiq etiq-ok">recomendada</span>' : ''}
        </div>
        <b class="alt-card-nom">${esc(o.nombre)}</b>
        <span class="alt-card-sub">${esc(o.apodo)}</span>
        <div class="alt-cifras">
          <span><b>${num(o.km)}</b>km</span>
          <span><b>${esc(o.volante)}</b>volante</span>
          <span><b>${esc(o.coste)}</b>total</span>
        </div>
      </div>`).join('')}
  </div>`;
}

// ---------- Comparativa ----------

function tablaComparativa(c) {
  return `<div class="tarjeta">
    <div class="seccion-tit" style="margin:0 0 10px">Comparativa</div>
    <div class="alt-tabla" role="table">
      <div class="alt-tr alt-th" role="row">
        <span role="columnheader"></span>
        <span role="columnheader" class="col-fuera">Cargado</span>
        <span role="columnheader">1</span>
        <span role="columnheader">2</span>
        <span role="columnheader">3</span>
      </div>
      ${c.filas.map(f => `
        <div class="alt-tr ${f.destaca ? 'destaca' : ''}" role="row">
          <span role="rowheader">${esc(f.que)}</span>
          <span role="cell" class="col-fuera">${esc(f.plan)}</span>
          <span role="cell" class="col-a">${esc(f.a)}</span>
          <span role="cell" class="col-b">${esc(f.b)}</span>
          <span role="cell" class="col-c">${esc(f.c)}</span>
        </div>`).join('')}
    </div>
  </div>`;
}

// ---------- Diagnóstico ----------

function bloqueDiagnostico(d) {
  return plegable('alt-diag', d.titulo, `${d.puntos.length} problemas medibles`, `
    ${d.puntos.map(p => `
      <div class="alt-problema">
        <div class="fila fila-sep" style="align-items:flex-start">
          <div class="crece">
            <div class="alt-problema-tit">${esc(p.que)}</div>
            <div class="suave" style="font-size:14px;margin-top:2px">${esc(p.donde)}</div>
          </div>
          <span class="alt-problema-cifra">${esc(p.cifra)}</span>
        </div>
        <div class="prosa" style="font-size:15px;margin-top:8px">${p.detalle}</div>
      </div>`).join('')}
    <div class="prosa" style="font-size:15px;margin-top:12px;padding:10px 12px;border-radius:10px;background:var(--papel-2)">${d.fijo}</div>`);
}

// ---------- Cada alternativa, día a día ----------

function bloqueOpcion(o) {
  const dias = o.dias;
  const kmTotal = dias.reduce((t, d) => t + d.km, 0);

  return `<div class="seccion-tit">
    Ruta ${esc(o.letra)} <span class="cnt">· ${esc(o.nombre)}</span>
  </div>
  <div class="tarjeta ${o.recomendada ? 'alt-reco' : ''}">
    <div class="prosa" style="font-size:15.5px">${o.idea_html}</div>
    <div class="envuelve" style="margin-top:11px">
      <span class="etiq">${num(kmTotal)} km</span>
      <span class="etiq">${esc(o.volante)} de volante</span>
      <span class="etiq etiq-acento">${esc(o.coste)}</span>
      <a class="btn btn-peq" href="#/mapa?vista=rutas&r=${esc(o.id)}">Ver en el mapa</a>
    </div>

    <div class="alt-dias">
      ${dias.map(d => `
        <div class="alt-dia ${d.cambia ? 'cambia' : ''} ${d.hito ? 'hito' : ''}">
          <span class="alt-dia-et">${esc(d.etiqueta)}</span>
          <span class="crece">
            <span class="alt-dia-etapa">${esc(d.etapa)}</span>
            <span class="alt-dia-pie">
              <b class="${d.min > LIMITE_VOLANTE ? 'ojo' : ''}">${num(d.km)} km · ${duracion(d.min)}</b>
              · ${esc(d.dormir)}${d.verificar ? ' <i class="alt-ver" title="Noche por verificar">⚠</i>' : ''}
            </span>
          </span>
        </div>`).join('')}
    </div>
    <p class="alt-leyenda">
      <span class="alt-leyenda-hito">Azul</span>: los tres esenciales · Roma, Florencia y Cinque Terre.
      <span class="alt-leyenda-cambia">Rojo</span>: lo que esta ruta hace distinto de las otras dos.
      <span class="alt-ver">⚠</span> noche por verificar.
    </p>
  </div>

  ${plegable(`alt-cambios-${o.id}`, 'Qué tiene de particular', `${o.cambios_html.length} claves`,
    o.cambios_html.map(p => `<div class="prosa" style="font-size:15.5px;margin-bottom:10px">${p}</div>`).join('') +
    (o.variante_html ? `<div class="caja-decision"><div class="prosa">${o.variante_html}</div></div>` : ''))}

  <div class="tarjeta">
    <div class="alt-balance">
      <div>
        <div class="alt-balance-tit ok">Ganas</div>
        <ul>${o.ganas.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>
      <div>
        <div class="alt-balance-tit no">Pierdes</div>
        <ul>${o.pierdes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>
    </div>
    <div class="prosa" style="font-size:15px;margin-top:12px;padding-top:11px;border-top:1px solid var(--linea)">
      <b>Coste:</b> ${o.coste_detalle}
    </div>
  </div>`;
}

// ---------- Cómo decidir ----------

function bloqueDecidir(d) {
  return `<div class="seccion-tit">Cómo decidir</div>
  <div class="tarjeta">
    <p class="suave" style="font-size:15px">Tres preguntas, en este orden.</p>
    ${d.preguntas.map((q, i) => `
      <div class="alt-pregunta">
        <span class="alt-num">${i + 1}</span>
        <div class="crece">
          <div style="font-weight:700;font-size:16px">${esc(q.p)}</div>
          <div class="prosa" style="font-size:15px;margin-top:3px">${q.r_html}</div>
        </div>
      </div>`).join('')}
    <div class="caja-decision" style="margin-top:12px">
      <div class="prosa"><b class="caja-t">La recomendación</b>${d.recomendacion_html}</div>
    </div>
  </div>`;
}

// ---------- Pendiente de verificar ----------

function bloqueVerificar(v) {
  return plegable('alt-verificar', 'Pendiente de verificar', `${v.puntos.length} cosas antes de salir`, `
    <p class="suave" style="font-size:15px">${esc(v.intro)}</p>
    ${v.puntos.map(p => `
      <div class="frase">
        <div class="fila fila-sep" style="align-items:baseline">
          <span class="frase-it crece">${esc(p.que)}</span>
          <span class="etiq etiq-alerta">${esc(p.alt)}</span>
        </div>
        <div class="frase-es">${esc(p.detalle)}</div>
      </div>`).join('')}
    <div class="prosa" style="font-size:15px;margin-top:12px">${v.nota_html}</div>`);
}
