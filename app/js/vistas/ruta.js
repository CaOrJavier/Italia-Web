// Itinerario: los 12 días, el detalle de cada uno y su edición.

import { esc, eur, num, duracion, fechaLarga, avisar } from '../util.js';
import * as datos from '../datos.js';
import * as estado from '../estado.js';
import { ir, abrirHoja, cerrarHoja, hojaNavegar, confirmar, plegable, recordarPliegues } from '../ui.js';
import { ilustracionDia } from '../ilustraciones.js';
import { fotoDia } from '../fotos.js';
import { paraDia } from '../mas-que-ver.js';

/**
 * Variante «Roma al final»: en vez de Roma el día 1 y el Vaticano el último,
 * Roma entera en los dos últimos días, seguidos.
 *
 * Sale porque los Museos Vaticanos cierran el 14, el 15 y los domingos, así
 * que en el plan original la única ventana era la mañana del 25 — y eso
 * obligaba a partir Roma. Confirmado que abren lunes a sábado de 08:00 a
 * 20:00 (última entrada 18:00), el lunes 24 por la tarde queda libre.
 *
 * No toca datos-viaje.json: se aplica como edición del usuario, así que
 * «volver al plan original» la deshace día por día.
 */
const VARIANTE_ROMA = {
  id: 'roma-al-final',
  nombre: 'Roma al final, en días seguidos',
  // día -> paradas en orden. Lo que no aparezca en ningún día se oculta.
  dias: {
    1:  [3, 16],                       // Ferragosto: playa de Tarquinia y lago de Bracciano
    10: [68, 69, 4, 74, 12, 5, 6, 7, 14],  // Asís por la mañana, Roma y el Vaticano por la tarde
    11: [8, 9, 75, 76]                 // Coliseo a primera hora y al puerto
  },
  ocultar: [10, 11, 13, 15, 70, 71, 72, 73]
};

const LIMITE_VOLANTE = 240; // minutos de volante en todo el día
const LIMITE_SEGUIDO = datos.LIMITE_SEGUIDO; // minutos de un solo tirón: lo que de verdad cansa yendo solo

export function vistaRuta(raiz, params) {
  const n = params.get('dia');
  if (params.get('prioridades') === '1') triaje(raiz);
  else if (n !== null && datos.dia(n)) detalle(raiz, Number(n));
  else listado(raiz);
}

// ---------- Triaje de prioridades ----------

/**
 * Pantalla para decidir de una sentada qué es imprescindible y qué es
 * prescindible. Existe porque el plan **no trae prioridades**: probé a
 * deducirlas de los datos (reservas, títulos de día, negritas de la guía) y
 * ninguna señal es fiable — o marcaba 3 de 58 o marcaba 41. Lo que es
 * imprescindible depende del viajero, así que lo decide el viajero.
 */
function triaje(raiz) {
  const s = estado.obtener();
  const visitas = datos.dias().flatMap(d =>
    datos.paradasVisibles(d.dia)
      .filter(p => datos.prioridadDe(p) !== 'logistica')
      .map(p => ({ p, d })));
  const decididas = visitas.filter(({ p }) => datos.prioridadTocada(p)).length;
  const opciones = ['imprescindible', 'recomendable', 'sivabien'];

  raiz.innerHTML = `
    <button class="btn btn-peq" data-volver style="margin-bottom:12px">← Itinerario</button>
    <div class="tarjeta">
      <h2>Tus prioridades</h2>
      <p style="margin-top:6px">El plan no trae prioridades: <b>las decides tú</b>. Intenté deducirlas de
      los datos y no salía nada de fiar, así que por defecto todo entra como <b>Recomendable</b>, salvo
      lo que tiene reserva (imprescindible) y los miradores, playas y sitios de comer (si va bien).</p>
      <p style="margin-top:8px">Baja la lista y toca. Son ${visitas.length} paradas, cinco minutos en el sofá.
      Luego, el día que te desvíes, el botón <b>Día ligero</b> te quita de encima todas las «si va bien» de golpe.</p>
      <div class="fila fila-sep" style="margin-top:12px"><b>${decididas} de ${visitas.length} decididas por ti</b></div>
      <div class="barra" style="margin-top:8px"><i style="width:${decididas / visitas.length * 100}%"></i></div>
      ${decididas ? '<button class="btn btn-peq btn-peligro btn-blq" data-olvidar style="margin-top:12px">Olvidar mis decisiones</button>' : ''}
    </div>

    ${datos.dias().map(d => {
      const suyas = visitas.filter(v => v.d.dia === d.dia);
      if (!suyas.length) return '';
      return `<div class="seccion-tit">${esc(d.etiqueta)} · ${esc(d.titulo)}</div>
      <div class="tarjeta">
        ${suyas.map(({ p }) => {
          const pri = datos.prioridadDe(p);
          return `<div class="triaje">
            <div class="triaje-nom">${esc(p.nombre)}${datos.prioridadTocada(p) ? '' : ' <span class="suave" style="font-weight:500">· por defecto</span>'}</div>
            <div class="triaje-ops">
              ${opciones.map(k => `<button class="triaje-op ${pri === k ? 'activa' : ''}"
                style="--pri:${datos.PRIORIDADES[k].color}" data-fijar="${p.id}" data-valor="${k}"
                aria-pressed="${pri === k}">${esc(datos.PRIORIDADES[k].corto)}</button>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>`;
    }).join('')}`;

  raiz.onclick = (ev) => {
    if (ev.target.closest('[data-volver]')) return ir('#/ruta');
    if (ev.target.closest('[data-olvidar]')) {
      return confirmar('Olvidar mis decisiones',
        'Todas las paradas vuelven a la prioridad por defecto. No afecta a nada más.',
        'Olvidar', () => {
          estado.cambiar(st => { st.prioridades = {}; });
          avisar('Prioridades reiniciadas');
          triaje(raiz);
        }, { peligro: true });
    }
    const b = ev.target.closest('[data-fijar]');
    if (!b) return;
    estado.fijarPrioridad(Number(b.dataset.fijar), b.dataset.valor);
    triaje(raiz);
  };
}

// ---------- Listado de días ----------

function listado(raiz) {
  const s = estado.obtener();
  raiz.innerHTML = `
    <div class="tarjeta">
      <div class="seccion-tit" style="margin:0 0 8px">Colores de prioridad</div>
      <div class="envuelve" style="margin-bottom:10px">
        ${datos.CICLO_PRIORIDAD.map(k => `<span class="etiq" style="background:${datos.PRIORIDADES[k].color};color:#fff">${esc(datos.PRIORIDADES[k].corto)}</span>`).join('')}
      </div>
      <p class="suave" style="font-size:14.5px">
        El plan no trae prioridades: son tuyas. Por defecto casi todo entra como <b>Recomendable</b>.
        Decídelas una vez y el día que te desvíes sueltas las «si va bien» de un toque.
      </p>
      <button class="btn btn-pri btn-blq" data-triaje style="margin-top:11px">
        ${(() => {
          const v = datos.dias().flatMap(d => datos.paradasVisibles(d.dia).filter(p => datos.prioridadDe(p) !== 'logistica'));
          const hechas = v.filter(p => datos.prioridadTocada(p)).length;
          return hechas ? `Ajustar prioridades (${hechas}/${v.length})` : 'Poner mis prioridades';
        })()}
      </button>
    </div>

    ${tarjetaRutas()}

    ${tarjetaVariante()}

    <div class="seccion-tit">12 días <span class="cnt">· ${num(datos.VIAJE.meta.km_totales)} km · ${datos.VIAJE.meta.horas_conduccion} h de volante</span></div>
    ${datos.dias().map(d => {
      const r = datos.resumenDia(d.dia);
      const noche = datos.nocheDe(d.dia);
      const paradas = datos.paradasVisibles(d.dia);
      const hechas = paradas.filter(p => s.paradas_hechas[p.id]).length;
      const porPri = datos.CICLO_PRIORIDAD.map(k => ({ k, n: paradas.filter(p => datos.prioridadDe(p) === k).length })).filter(x => x.n);
      const m = datos.margenDia(d.dia);
      return `<div class="tarjeta">
        <button class="dia-cab" data-dia="${d.dia}">
          <span class="dia-ilus">${ilustracionDia(d.dia)}<b>${esc(d.etiqueta)}</b></span>
          <span class="crece">
            <span style="display:block;font-weight:700;font-size:17.5px">${esc(d.titulo)}</span>
            <span class="suave" style="display:block;font-size:14.5px;margin-top:2px">${esc(d.etapa)}</span>
          </span>
        </button>
        <div class="tira-pri" aria-hidden="true">
          ${porPri.map(x => `<i style="flex:${x.n};background:${datos.PRIORIDADES[x.k].color}" title="${x.n} ${esc(datos.PRIORIDADES[x.k].corto)}"></i>`).join('')}
        </div>
        <div class="dia-datos">
          <span><b>${num(r.km)}</b> km</span>
          <span class="${r.minutos > LIMITE_VOLANTE ? 'ojo' : ''}"><b>${duracion(r.minutos)}</b> al volante</span>
          <span><b>${paradas.length}</b> paradas${hechas ? ` · ${hechas} hechas` : ''}</span>
          ${datos.estaEditado(d.dia) ? '<span class="etiq etiq-info">editado</span>' : ''}
        </div>
      </div>`;
    }).join('')}`;

  recordarPliegues(raiz);
  raiz.addEventListener('click', ev => {
    if (ev.target.closest('[data-triaje]')) return ir('#/ruta?prioridades=1');
    if (ev.target.closest('[data-variante]')) return aplicarVariante(raiz);
    if (ev.target.closest('[data-desvariante]')) return quitarVariante(raiz);
    const b = ev.target.closest('[data-dia]');
    if (b) ir(`#/ruta?dia=${b.dataset.dia}`);
  });
}

/**
 * Las tres rutas que se compararon antes de escribir el itinerario.
 *
 * Sólo la A tiene día a día verificado: es la que se desarrolló. B y C están
 * con sus km, su coste y su veredicto, que es lo que hace falta para decidir,
 * pero no se inventan doce días para cada una.
 */
function tarjetaRutas() {
  if (!datos.RUTAS) return '';
  const { rutas, razonamiento, decision_html, intro } = datos.RUTAS;

  const resumen = rutas.map(r => `${r.letra} ${num(r.km)} km`).join(' · ');
  return plegable('rutas', 'Las tres rutas sin Venecia', resumen, `
    <p class="suave" style="font-size:15px">${esc(intro)}</p>
    ${rutas.map(r => `
      <div class="ruta-opcion ${r.elegida ? 'elegida' : ''} ${r.descartada ? 'descartada' : ''}">
        <div class="fila fila-sep" style="align-items:flex-start">
          <div class="crece">
            <div class="ruta-nom"><span class="ruta-letra">${esc(r.letra)}</span> ${esc(r.nombre)}</div>
            <div class="suave" style="font-size:14px;margin-top:3px">${esc(r.trazado)}</div>
          </div>
          <div class="ruta-cifras">
            <b>${num(r.km)}</b><span>km</span>
            <em>${esc(r.coste)}</em>
          </div>
        </div>
        <div class="prosa" style="font-size:15px;margin-top:9px"><b>Ves:</b> ${r.ve_html}</div>
        <div class="prosa" style="font-size:15px;margin-top:6px">${r.veredicto_html}</div>
      </div>`).join('')}
    ${razonamiento.map(p => `<div class="prosa" style="font-size:15.5px;margin-top:12px">${p}</div>`).join('')}
    ${decision_html ? `<div class="caja-decision"><div class="prosa">${decision_html}</div></div>` : ''}
    <p class="etiq etiq-alerta" style="white-space:normal;line-height:1.45;padding:10px 12px;margin-top:12px">
      Los 12 días de abajo <b>siguen siendo el plan viejo, el que pasaba por Venecia</b> (con Saturnia ya
      añadida el día 2). Elige una de las tres rutas y se reconstruye el itinerario entero.
    </p>
    <a class="btn btn-pri btn-blq" href="#/alternativas" style="margin-top:10px">
      Ver las tres rutas día a día
    </a>`);
}

const varianteActiva = () => estado.obtener().variante === VARIANTE_ROMA.id;

function tarjetaVariante() {
  const v = varianteActiva();
  return `<div class="tarjeta" style="${v ? 'border-color:var(--ok)' : ''}">
    <div class="seccion-tit" style="margin:0 0 6px">
      ${v ? 'Variante aplicada: Roma al final' : 'Variante: Roma al final'}
    </div>
    <p class="suave" style="font-size:14.5px">
      ${v
        ? 'Roma va entera en el <b>24 y el 25</b>, seguidos. El 15 queda libre: playa de Tarquinia y lago de Bracciano. El Vaticano pasa al lunes 24 por la tarde y el Coliseo al martes 25 a primera hora.'
        : 'En vez de Roma el día 1 y el Vaticano el último, <b>Roma entera en los dos últimos días</b>. El 15 (Ferragosto) queda como día de playa y lago.'}
    </p>
    <button class="btn btn-blq ${v ? 'btn-peligro' : 'btn-pri'}" style="margin-top:11px"
            ${v ? 'data-desvariante' : 'data-variante'}>
      ${v ? 'Volver al plan original' : 'Aplicar la variante'}
    </button>
  </div>`;
}

function aplicarVariante(raiz) {
  confirmar('Roma al final',
    'Roma pasa al 24 y 25, seguidos, con el Vaticano el lunes por la tarde y el Coliseo el martes a primera hora. ' +
    'El 15 queda libre. Se puede deshacer cuando quieras y no toca los datos del viaje.',
    'Aplicar', () => {
      estado.cambiar(s => {
        for (const [d, ids] of Object.entries(VARIANTE_ROMA.dias)) {
          for (const id of ids) s.reasignaciones[id] = Number(d);
          s.itinerario_editado[d] = ids.slice();
        }
        for (const id of VARIANTE_ROMA.ocultar) s.lugares_ocultos[id] = true;
        s.variante = VARIANTE_ROMA.id;
      });
      avisar('Variante aplicada');
      listado(raiz);
    });
}

function quitarVariante(raiz) {
  confirmar('Volver al plan original',
    'Roma vuelve al día 1 y el Vaticano al 25. Tus gastos, notas, prioridades y paradas hechas no se tocan.',
    'Restaurar', () => {
      estado.cambiar(s => {
        for (const [d, ids] of Object.entries(VARIANTE_ROMA.dias)) {
          for (const id of ids) delete s.reasignaciones[id];
          delete s.itinerario_editado[d];
        }
        for (const id of VARIANTE_ROMA.ocultar) delete s.lugares_ocultos[id];
        delete s.variante;
      });
      avisar('Plan original restaurado');
      listado(raiz);
    }, { peligro: true });
}

// ---------- Detalle de un día ----------

function detalle(raiz, n) {
  const d = datos.dia(n);
  const extras = datos.extrasDe(n);
  const s = estado.obtener();
  const r = datos.resumenDia(n);
  const editando = raiz.dataset.editando === '1';
  const noche = datos.nocheDe(n);
  const paradas = datos.paradasDe(n);

  raiz.innerHTML = `
    <button class="btn btn-peq" data-volver style="margin-bottom:12px">← Todos los días</button>

    <div class="tarjeta">
      ${fotoDia(n)}
      <div class="cab-dia">
        <span class="cab-dia-ilus">${ilustracionDia(n)}</span>
        <span class="crece">
          <span class="suave" style="display:block;font-size:14px;font-weight:600">${esc(d.etiqueta)} · ${esc(fechaLarga(d.fecha))}</span>
          <h2 style="font-size:22px;margin:2px 0 4px">${esc(d.titulo)}</h2>
          <span class="suave" style="display:block;font-size:15px">${esc(d.etapa)}</span>
        </span>
      </div>
      <div class="envuelve" style="margin-top:11px">
        <span class="etiq">${num(r.km)} km${r.estimado ? '*' : ''}</span>
        <span class="etiq ${r.minutos > LIMITE_VOLANTE ? 'etiq-alerta' : ''}">${duracion(r.minutos)} de volante</span>
        <span class="etiq">paradas: ${eur(r.coste)}</span>
        <span class="etiq">día: ${eur(datos.previstoDia(n))}</span>
      </div>
      ${r.estimado ? `<p class="suave" style="font-size:13.5px;margin-top:9px">
        * Día editado. Km y tiempo reestimados sobre el plan original (${num(r.original.km)} km, ${duracion(r.original.minutos)}); son una aproximación, no una ruta recalculada.
      </p>` : ''}
      ${avisoConduccion(n, r)}
      ${panelMargen(n)}
      ${d.aviso ? `<p style="margin-top:9px;padding:9px 11px;border-radius:10px;background:var(--alerta-sua);color:var(--alerta);font-weight:600">${esc(d.aviso)}</p>` : ''}
      <div class="envuelve" style="margin-top:12px">
        <button class="btn btn-peq ${editando ? 'btn-pri' : ''}" data-editar>${editando ? 'Terminar de editar' : 'Editar el día'}</button>
        ${botonLigero(n)}
        ${datos.estaEditado(n) ? '<button class="btn btn-peq btn-peligro" data-reset>Volver al plan original</button>' : ''}
      </div>
    </div>

    ${editando ? panelEdicion(n, paradas) : panelLectura(n, s)}

    ${panelAcceso(n)}
    ${panelConduccion(n)}
    ${panelMasQueVer(n)}

    ${plegable(`dormir-${n}`, 'Dormir',
      noche ? `${esc(noche.nombre)} · ${noche.precio_eur ? eur(noche.precio_eur) : 'gratis'}` : 'Último día: se vuelve en el ferri',
      `${noche ? `
        <div class="fila fila-sep">
          <div class="crece">
            <div style="font-weight:700;font-size:17px">${esc(noche.nombre)}</div>
            <div class="suave" style="font-size:14.5px">${noche.precio_eur ? eur(noche.precio_eur) : 'Gratis'}${noche.servicios?.length ? ' · ' + esc(noche.servicios.join(', ')) : ''}</div>
          </div>
          <button class="btn btn-peq" data-nav="${noche.lat},${noche.lon}" data-nombre="${esc(noche.nombre)}">Navegar</button>
        </div>
        ${noche.nota ? `<p class="suave" style="margin-top:8px;font-size:15px">${esc(noche.nota)}</p>` : ''}` : ''}
      ${extras.dormir_html ? `<div class="prosa" style="margin-top:10px;font-size:15.5px">${extras.dormir_html}</div>` : ''}`)}

    ${extras.coste_html
      ? plegable(`coste-${n}`, 'Coste del día', `${eur(datos.previstoDia(n))} previstos`,
          `<div class="prosa" style="font-size:15.5px">${extras.coste_html}</div>`)
      : ''}

    ${plegable(`nota-${n}`, 'Mi nota',
      s.notas['dia:' + n] ? esc(s.notas['dia:' + n].slice(0, 60)) + '…' : 'Apunta lo que pase de verdad',
      `<textarea id="nota-dia" aria-label="Nota del ${esc(d.etiqueta)}"
        placeholder="Dónde aparcaste, qué cerró, qué merecía la pena…">${esc(s.notas['dia:' + n] || '')}</textarea>
      <button class="btn btn-peq" data-guardar-nota style="margin-top:8px">Guardar nota</button>`)}`;

  recordarPliegues(raiz);
  raiz.onclick = (ev) => manejar(ev, raiz, n);
}

/** Cuánto tiempo queda de verdad para ver cosas, para saber si se va apurado. */
function panelMargen(n) {
  const m = datos.margenDia(n);
  if (!m.visitas) return '';
  const apurado = m.porVisita < 45;
  return `<div class="margen ${apurado ? 'apurado' : ''}">
    <div class="margen-cifra">
      <b>${duracion(m.libre)}</b>
      <span>libres para ${m.visitas} visita${m.visitas === 1 ? '' : 's'}</span>
    </div>
    <p class="suave" style="font-size:13.5px;margin:6px 0 0">
      De ${esc(m.arranca)} a ${esc(m.acaba)} hay ${duracion(m.activo)} de luz; ${duracion(m.conduce)} se van conduciendo.
      Salen <b>${m.porVisita} min por parada</b>${apurado ? ', que es poco: quita alguna «si va bien».' : ', sin agobios.'}
    </p>
  </div>`;
}

/** Un toque para quitarse de encima lo prescindible del día. */
function botonLigero(n) {
  const s = estado.obtener();
  const flojas = datos.paradasDe(n).filter(p => datos.prioridadDe(p) === 'sivabien');
  if (!flojas.length) return '';
  const todasFuera = flojas.every(p => s.lugares_ocultos[p.id]);
  return `<button class="btn btn-peq" data-ligero="${todasFuera ? 'no' : 'si'}">
    ${todasFuera ? `Recuperar las ${flojas.length} opcionales` : `Día ligero (−${flojas.length} paradas)`}
  </button>`;
}

/** Dónde se queda el coche en cada ciudad del día y cuánto tardas en entrar. */
function panelAcceso(n) {
  const accesos = datos.accesoDe(n);
  if (!accesos.length) return '';
  const resumen = accesos.map(a => `${esc(a.ciudad)}${a.total ? ` ${a.total}′` : ''}`).join(' · ');
  return plegable(`acceso-${n}`, 'Entrar en la ciudad', resumen, `
      ${accesos.map(a => `
        <div class="acceso">
          <div class="fila fila-sep" style="align-items:flex-start">
            <div class="crece">
              <div class="acceso-ciudad">
                ${esc(a.ciudad)}
                <span class="etiq ${a.nivel === 'obligatorio' ? 'etiq-peligro' : 'etiq-ok'}">
                  ${a.nivel === 'obligatorio' ? 'coche fuera obligatorio' : 'puedes acercarte'}
                </span>
              </div>
              ${a.motivo ? `<div class="suave" style="font-size:14px;margin-top:2px">${esc(a.motivo)}</div>` : ''}
            </div>
            ${a.total ? `<div class="acceso-tiempo">
              <b>${a.total}</b><span>min</span>
            </div>` : ''}
          </div>
          <div class="prosa" style="font-size:15.5px;margin-top:8px">${a.como_html}</div>
          <div class="envuelve" style="margin-top:8px">
            <span class="etiq ${/gratis|^0 €/i.test(a.coste) ? 'etiq-ok' : 'etiq-acento'}">${esc(a.coste)}</span>
            ${a.park && Number.isFinite(a.park.lat)
              ? `<button class="btn btn-peq" data-nav="${a.park.lat},${a.park.lon}" data-nombre="${esc(a.park.nombre)}">Navegar al aparcamiento</button>`
              : ''}
          </div>
          ${a.total ? `<p class="suave" style="font-size:13.5px;margin-top:8px">
            ${a.minutos} min ${a.enTransporte ? 'de trayecto' : 'andando'}${a.estimado ? ' (estimado sobre el plano)' : ' (según la guía)'}
            + ${10} de aparcar${a.enTransporte ? ' + 10 de esperar el transporte' : ''}.
            <b>Cuenta ${a.total} min desde que apagas el motor.</b>
          </p>` : `<p class="suave" style="font-size:13.5px;margin-top:8px">Sin dato de tiempo: cuenta 30 min de margen.</p>`}
        </div>`).join('')}
      <p class="suave" style="font-size:13px;margin-top:4px">
        Nunca pongas el monumento en el GPS: pon el aparcamiento. Cada entrada en ZTL es una multa
        independiente de 80-330 € que llega a España meses después.
      </p>`);
}

/** Lo que no está en el itinerario, por si sobra tiempo. Datos de la web, no de la guía. */
function panelMasQueVer(n) {
  const ciudades = paraDia(n);
  if (!ciudades.length) return '';
  return ciudades.map(c => plegable(`masver-${c.ciudad}-${n}`, `Más que ver en ${c.ciudad}`,
    `${c.gratis.length} gratis · ${c.pago.length} de pago`, `
    <p class="suave" style="font-size:15px">${esc(c.intro)}</p>
    <div class="seccion-tit">Gratis</div>
    ${c.gratis.map(x => `
      <div class="frase">
        <div class="frase-it" style="color:var(--ok)">${esc(x.nombre)}</div>
        <div class="frase-es">${esc(x.que)}</div>
        ${x.nota ? `<div class="frase-nota">${esc(x.nota)}</div>` : ''}
      </div>`).join('')}
    <div class="seccion-tit">De pago</div>
    ${c.pago.map(x => `
      <div class="frase">
        <div class="fila fila-sep" style="align-items:baseline">
          <span class="frase-it crece">${esc(x.nombre)}</span>
          <span class="etiq ${x.veredicto === 'no' ? 'etiq-peligro' : 'etiq-alerta'}">${esc(x.precio)}</span>
        </div>
        ${x.horario && x.horario !== '—' ? `<div class="frase-es">${esc(x.horario)}</div>` : ''}
        ${x.nota ? `<div class="frase-nota">${esc(x.nota)}</div>` : ''}
      </div>`).join('')}
    <p class="etiq etiq-alerta" style="white-space:normal;line-height:1.45;padding:9px 12px;margin-top:12px">
      Precios y horarios recogidos de webs de turismo, no de la guía verificada.
      <b>Confírmalos antes de pagar.</b>
    </p>`)).join('');
}

function panelConduccion(n) {
  const tramos = datos.tramosConduccion(n);
  if (!tramos.length) return '';
  const total = tramos.reduce((t, x) => t + x.minutos, 0);
  const peor = datos.tramoMasLargo(n);
  return plegable(`conduccion-${n}`, 'Conducción',
    `${tramos.length} tramo${tramos.length === 1 ? '' : 's'} · el mayor ${duracion(peor.minutos)}`, `
      ${tramos.map(t => `
        <div class="tramo ${t.minutos > LIMITE_SEGUIDO ? 'tramo-largo' : ''}">
          <span class="tramo-tiempo mono">${esc(duracion(t.minutos))}</span>
          <span class="crece">
            <span class="tramo-ruta">${esc(t.desde)} → ${esc(t.hasta)}</span>
            <span class="tramo-barra"><i style="width:${Math.min(100, t.minutos / LIMITE_SEGUIDO * 100)}%"></i></span>
          </span>
          <span class="mono suave">${num(t.km)} km</span>
        </div>`).join('')}
      <p class="suave" style="font-size:13px;margin-top:10px">
        Reparto estimado de los ${duracion(total)} del día entre las paradas que no están en la misma
        ciudad. La línea roja marca las 3 h seguidas.
      </p>`);
}

/**
 * Viajando solo lo que cansa no es el total del día, sino el tirón sin parar:
 * el aviso se da sobre el tramo más largo, y el total queda como secundario.
 */
function avisoConduccion(n, r) {
  const peor = datos.tramoMasLargo(n);
  const partes = [];

  if (peor && peor.minutos > LIMITE_SEGUIDO) {
    partes.push(`<p style="margin-top:10px;padding:10px 12px;border-radius:10px;background:var(--peligro-sua);color:var(--peligro);font-weight:700">
      Tirón de ${duracion(peor.minutos)} sin parada entre <b>${esc(peor.desde)}</b> y <b>${esc(peor.hasta)}</b> (${num(peor.km)} km).
      Yendo solo, parte ese tramo por la mitad.
    </p>`);
  } else if (peor) {
    partes.push(`<p class="suave" style="margin-top:9px;font-size:14.5px">
      Tirón más largo: <b>${duracion(peor.minutos)}</b> (${num(peor.km)} km), ${esc(peor.desde)} → ${esc(peor.hasta)}.
    </p>`);
  }

  if (r.minutos > LIMITE_VOLANTE) {
    partes.push(`<p style="margin-top:7px;color:var(--alerta);font-weight:600;font-size:14.5px">
      ${duracion(r.minutos)} de volante en total, aunque repartidos en ${datos.tramosConduccion(n).length} tramos.
    </p>`);
  }
  return partes.join('');
}

function panelLectura(n, s) {
  const grupos = datos.paradasPorFranja(n);
  return `<div class="seccion-tit">Plan del día <span class="cnt">· ${datos.paradasVisibles(n).length} paradas</span></div>
    <div class="tarjeta">
      ${grupos.map(g => `
        <div class="franja">
          ${g.franja ? `<div class="franja-hora">${esc(g.franja.hora)}<span>${esc(g.franja.etiqueta)}</span></div>` : ''}
          <div class="crece">
            ${g.franja ? `<div class="prosa" style="font-size:15.5px;margin-bottom:10px">${g.franja.html}</div>` : ''}
            ${g.paradas.map(p => tarjetaParada(p, s)).join('')}
          </div>
        </div>`).join('')}
    </div>`;
}

function tarjetaParada(p, s) {
  const cat = datos.categoria(p.categoria);
  const hecha = !!s.paradas_hechas[p.id];
  const pri = datos.prioridadDe(p);
  const info = datos.PRIORIDADES[pri];
  return `<div class="parada pri-${pri} ${hecha ? 'hecha' : ''}" style="--pri:${info.color}">
    <span class="parada-barra"></span>
    <div class="crece">
      <div class="parada-nom">${esc(p.nombre)}${p.coords_aproximadas ? ' <span class="etiq" title="Coordenadas aproximadas">≈</span>' : ''}</div>
      ${p.descripcion ? `<div class="parada-desc">${esc(p.descripcion)}</div>` : ''}
      ${p.nota ? `<div class="parada-desc"><i>${esc(p.nota)}</i></div>` : ''}
      <div class="parada-acc">
        <button class="etiq etiq-pri" data-pri="${p.id}"
                aria-label="Prioridad de ${esc(p.nombre)}: ${esc(info.nombre)}. Tocar para cambiar">
          ${esc(info.corto)}${datos.prioridadTocada(p) ? '' : ' ·'}
        </button>
        ${p.precio ? `<span class="etiq ${/gratis/i.test(p.precio) ? 'etiq-ok' : ''}">${esc(p.precio)}</span>` : ''}
        ${Number.isFinite(p.lat) ? `<button class="btn btn-peq" data-nav="${p.lat},${p.lon}" data-nombre="${esc(p.nombre)}">Navegar</button>` : ''}
      </div>
    </div>
    <button class="chk" data-hecha="${p.id}" aria-pressed="${hecha}" aria-label="Marcar ${esc(p.nombre)} como hecha"><i>✓</i></button>
  </div>`;
}

function panelEdicion(n, paradas) {
  return `<div class="seccion-tit">Editando <span class="cnt">· ordena, oculta o mueve paradas</span></div>
    <div class="tarjeta editando">
      ${paradas.map((p, i) => {
        const cat = datos.categoria(p.categoria);
        return `<div class="parada ${p.oculto ? 'oculta' : ''}">
          <span class="parada-punto" style="background:${cat.color}"></span>
          <div class="crece">
            <div class="parada-nom">${esc(p.nombre)}</div>
            <div class="parada-acc">
              <button class="btn btn-peq" data-subir="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
              <button class="btn btn-peq" data-bajar="${i}" ${i === paradas.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button>
              <button class="btn btn-peq" data-ocultar="${p.id}">${p.oculto ? 'Mostrar' : 'Ocultar'}</button>
              <button class="btn btn-peq" data-mover="${p.id}">Mover</button>
              ${p.extra ? `<button class="btn btn-peq btn-peligro" data-borrar="${p.id}">Borrar</button>` : ''}
            </div>
          </div>
        </div>`;
      }).join('')}
      <button class="btn btn-blq" data-anadir style="margin-top:10px">+ Añadir una parada</button>
    </div>`;
}

// ---------- Interacción ----------

function manejar(ev, raiz, n) {
  const t = ev.target;
  const cerca = (sel) => t.closest(sel);

  if (cerca('[data-volver]')) return ir('#/ruta');

  if (cerca('[data-editar]')) {
    raiz.dataset.editando = raiz.dataset.editando === '1' ? '0' : '1';
    return detalle(raiz, n);
  }

  if (cerca('[data-reset]')) {
    return confirmar('Volver al plan original',
      'Se deshacen el orden, las paradas ocultas y las añadidas de este día. Las paradas marcadas como hechas, las notas y los gastos no se tocan.',
      'Restaurar el día',
      () => {
        estado.resetearDia(n, datos.paradasDe(n).map(p => p.id));
        avisar('Día restaurado');
        detalle(raiz, n);
      }, { peligro: true });
  }

  const nav = cerca('[data-nav]');
  if (nav) {
    const [la, lo] = nav.dataset.nav.split(',');
    return hojaNavegar(+la, +lo, nav.dataset.nombre || '');
  }

  const chk = cerca('[data-hecha]');
  if (chk) {
    estado.alternar('paradas_hechas', chk.dataset.hecha);
    return detalle(raiz, n);
  }

  const subir = cerca('[data-subir]'), bajar = cerca('[data-bajar]');
  if (subir || bajar) {
    const i = Number((subir || bajar).dataset[subir ? 'subir' : 'bajar']);
    const ids = datos.paradasDe(n).map(p => p.id);
    const j = subir ? i - 1 : i + 1;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    estado.fijarOrden(n, ids);
    return detalle(raiz, n);
  }

  const pri = cerca('[data-pri]');
  if (pri) {
    const lugar = datos.paradasDe(n).find(p => String(p.id) === pri.dataset.pri);
    const actual = datos.prioridadDe(lugar);
    const i = datos.CICLO_PRIORIDAD.indexOf(actual);
    const siguiente = datos.CICLO_PRIORIDAD[(i + 1) % datos.CICLO_PRIORIDAD.length];
    estado.fijarPrioridad(lugar.id, siguiente);
    avisar(datos.PRIORIDADES[siguiente].nombre);
    return detalle(raiz, n);
  }

  const ligero = cerca('[data-ligero]');
  if (ligero) {
    const flojas = datos.paradasDe(n).filter(p => datos.prioridadDe(p) === 'sivabien');
    // Al ocultar hay que fijar antes el orden vigente, o se pierde.
    if (!estado.obtener().itinerario_editado[n]) estado.fijarOrden(n, datos.paradasDe(n).map(p => p.id));
    estado.cambiar(s => {
      for (const p of flojas) {
        if (ligero.dataset.ligero === 'si') s.lugares_ocultos[p.id] = true;
        else delete s.lugares_ocultos[p.id];
      }
    });
    avisar(ligero.dataset.ligero === 'si' ? `Fuera ${flojas.length} paradas opcionales` : 'Recuperadas');
    return detalle(raiz, n);
  }

  const ocultar = cerca('[data-ocultar]');
  if (ocultar) {
    // Al ocultar por primera vez hay que fijar el orden actual, o se pierde.
    if (!estado.obtener().itinerario_editado[n]) estado.fijarOrden(n, datos.paradasDe(n).map(p => p.id));
    estado.alternar('lugares_ocultos', ocultar.dataset.ocultar);
    return detalle(raiz, n);
  }

  const mover = cerca('[data-mover]');
  if (mover) return hojaMover(raiz, n, Number(mover.dataset.mover));

  const borrar = cerca('[data-borrar]');
  if (borrar) {
    estado.borrarLugarExtra(Number(borrar.dataset.borrar));
    avisar('Parada borrada');
    return detalle(raiz, n);
  }

  if (cerca('[data-anadir]')) return hojaAnadir(raiz, n);

  if (cerca('[data-guardar-nota]')) {
    estado.fijarNota('dia:' + n, raiz.querySelector('#nota-dia').value);
    return avisar('Nota guardada');
  }
}

function hojaMover(raiz, n, id) {
  const lugar = datos.paradasDe(n).find(p => p.id === id);
  const cuerpo = abrirHoja(`Mover «${lugar?.nombre ?? ''}»`, `
    <p class="suave">¿A qué día se va esta parada?</p>
    <div class="apilar" style="margin-top:12px">
      ${datos.dias().filter(d => d.dia !== n).map(d => `
        <button class="btn btn-blq" data-destino="${d.dia}" style="justify-content:flex-start">
          <b>${esc(d.etiqueta)}</b> · ${esc(d.titulo)}
        </button>`).join('')}
    </div>`);

  cuerpo.addEventListener('click', ev => {
    const b = ev.target.closest('[data-destino]');
    if (!b) return;
    const destino = Number(b.dataset.destino);
    const origen = datos.paradasDe(n).map(p => p.id).filter(x => x !== id);
    const llegada = [...datos.paradasDe(destino).map(p => p.id), id];
    estado.reasignar(id, destino);   // sin esto, el destino no sabría de ella
    estado.fijarOrden(n, origen);
    estado.fijarOrden(destino, llegada);
    cerrarHoja();
    avisar(`Movida al ${datos.dia(destino).etiqueta}`);
    detalle(raiz, n);
  });
}

function hojaAnadir(raiz, n) {
  const cats = Object.entries(datos.VIAJE.categorias);
  const cuerpo = abrirHoja('Añadir una parada', `
    <label class="campo"><span>Nombre</span><input type="text" id="np-nombre" placeholder="Trattoria da Enzo"></label>
    <label class="campo"><span>Coordenadas (lat, lon)</span><input type="text" id="np-coords" inputmode="decimal" placeholder="41.8892, 12.4731"></label>
    <label class="campo"><span>Categoría</span>
      <select id="np-cat">${cats.map(([k, v]) => `<option value="${k}">${esc(v.nombre)}</option>`).join('')}</select>
    </label>
    <label class="campo"><span>Nota (opcional)</span><input type="text" id="np-nota" placeholder="Cierra los lunes"></label>
    <p class="suave" style="font-size:14px">Truco: en Google Maps, mantén pulsado un punto y copia las coordenadas que salen arriba.</p>
    <button class="btn btn-pri btn-blq" id="np-ok" style="margin-top:12px">Añadir al ${esc(datos.dia(n).etiqueta)}</button>`);

  cuerpo.querySelector('#np-ok').addEventListener('click', () => {
    const nombre = cuerpo.querySelector('#np-nombre').value.trim();
    const crudo = cuerpo.querySelector('#np-coords').value.trim();
    const m = crudo.match(/(-?\d+[.,]?\d*)\s*[,; ]\s*(-?\d+[.,]?\d*)/);
    if (!nombre) return avisar('Ponle un nombre');
    if (!m) return avisar('Coordenadas no válidas');
    const lat = parseFloat(m[1].replace(',', '.'));
    const lon = parseFloat(m[2].replace(',', '.'));
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return avisar('Coordenadas fuera de rango');

    const nuevo = estado.anadirLugar({ dia: n, nombre, lat, lon, categoria: cuerpo.querySelector('#np-cat').value, nota: cuerpo.querySelector('#np-nota').value.trim() });
    estado.fijarOrden(n, [...datos.paradasDe(n).map(p => p.id).filter(x => x !== nuevo.id), nuevo.id]);
    cerrarHoja();
    avisar('Parada añadida');
    detalle(raiz, n);
  });
}
