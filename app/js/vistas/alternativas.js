// Alternativas: las dos versiones del itinerario que se compararon contra el
// plan montado en la app, con sus km, sus horas de volante y su coste.
//
// Es una pantalla de decisión, de lectura: no toca el estado ni el itinerario.
// Si acaba eligiéndose la A o la B, se convierte a datos-viaje.json aparte.

import { esc, num, duracion } from '../util.js';
import * as datos from '../datos.js';
import { plegable, recordarPliegues } from '../ui.js';

const LIMITE_VOLANTE = 240;

export function vistaAlternativas(raiz) {
  const A = datos.ALTERNATIVAS;
  if (!A) {
    raiz.innerHTML = '<div class="tarjeta"><p class="suave">No se han podido cargar las alternativas.</p></div>';
    return;
  }

  raiz.innerHTML = `
    <div class="tarjeta">
      <div class="seccion-tit" style="margin:0 0 8px">Tres rutas sin Venecia</div>
      <p class="prosa" style="font-size:15.5px">${A.intro}</p>
      ${bloqueEsenciales(A.esenciales)}
    </div>

    ${tarjetasOpciones(A.opciones)}

    ${tablaComparativa(A.comparativa)}

    ${bloqueSaturnia(A.saturnia)}

    ${bloqueDiagnostico(A.diagnostico)}

    ${A.opciones.filter(o => o.dias.length).map(bloqueOpcion).join('')}

    ${bloqueDecidir(A.decidir)}

    ${bloqueVerificar(A.verificar)}`;

  recordarPliegues(raiz);
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
  // El plan descartado no compite con las tres rutas: va como tira, no como tarjeta.
  const fuera = opciones.filter(o => o.descartada);
  const vivas = opciones.filter(o => !o.descartada);

  return `${fuera.map(o => `
    <div class="alt-fuera">
      <span class="alt-fuera-x" aria-hidden="true">✕</span>
      <span class="crece">
        <b>${esc(o.nombre)}</b>
        <span>${esc(o.apodo)} · ${num(o.km)} km · ${esc(o.volante)} · ${esc(o.coste)}</span>
      </span>
      <span class="etiq etiq-peligro">descartada</span>
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
        <span role="columnheader" class="col-fuera">Venecia</span>
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
