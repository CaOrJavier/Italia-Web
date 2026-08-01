// Guía: listas con estado (reservas, equipaje) y las fichas de consulta,
// todas disponibles sin conexión.

import { esc, eur, num, avisar, fechaCorta } from '../util.js';
import * as datos from '../datos.js';
import * as estado from '../estado.js';
import { ir, hojaNavegar, plegable, recordarPliegues } from '../ui.js';

const SECCIONES = [
  { id: 'buscar',   nombre: 'Buscar' },
  { id: 'comer',    nombre: 'Comer' },
  { id: 'reservas', nombre: 'Reservas' },
  { id: 'equipaje', nombre: 'Equipaje' },
  { id: 'fichas',   nombre: 'Fichas' },
  { id: 'antes',    nombre: 'Antes de salir' }
];

// Las fichas de consulta a las que se puede saltar con ?ficha=…
const DIRECTAS = ['ztl', 'abonos', 'comer', 'tours', 'eventos', 'dormir', 'riesgos', 'apps', 'natura', 'peajes'];

export function vistaGuia(raiz, params) {
  const pedido = params.get('ficha') || 'buscar';
  // Idioma se salió de aquí a su propia pestaña; los enlaces viejos siguen valiendo.
  if (pedido === 'idioma') return ir('#/idioma');
  const seccion = SECCIONES.some(s => s.id === pedido) ? pedido
                : DIRECTAS.includes(pedido) ? 'fichas'
                : 'buscar';
  const abrir = DIRECTAS.includes(pedido) ? pedido : null;

  raiz.innerHTML = `
    <div class="sub-nav">${SECCIONES.map(s =>
      `<button class="chip" data-sec="${s.id}" aria-pressed="${s.id === seccion}">${esc(s.nombre)}</button>`).join('')}</div>
    <div id="cuerpo-guia"></div>`;

  const cuerpo = raiz.querySelector('#cuerpo-guia');
  ({ buscar: pintarBuscar, comer: pintarComer, reservas: pintarReservas,
     equipaje: pintarEquipaje, fichas: (c) => pintarFichas(c, abrir), antes: pintarAntes }[seccion])(cuerpo);

  raiz.querySelector('.sub-nav').addEventListener('click', ev => {
    const b = ev.target.closest('[data-sec]');
    if (b) ir(`#/guia?ficha=${b.dataset.sec}`);
  });
}

// ---------- Buscador ----------

function pintarBuscar(caja) {
  caja.innerHTML = `
    <label class="campo">
      <span>Buscar en todo el viaje</span>
      <input type="search" id="q" placeholder="Lugar, día, ZTL, abono…" autocomplete="off" enterkeyhint="search">
    </label>
    <div id="res"></div>`;

  const entrada = caja.querySelector('#q');
  const res = caja.querySelector('#res');

  const pintar = () => {
    const q = entrada.value.trim();
    if (q.length < 2) {
      res.innerHTML = `<div class="vacio">Escribe al menos dos letras.<br>
        <small>Busca en los ${datos.VIAJE.lugares.length} lugares, los 12 días, las ZTL, los abonos, los tours y las reservas.</small></div>`;
      return;
    }
    const filas = datos.buscar(q);
    if (!filas.length) { res.innerHTML = `<div class="vacio">Nada para «${esc(q)}».</div>`; return; }
    res.innerHTML = `<div class="tarjeta">${filas.map(f => `
      <button class="item-lista" data-ruta="${esc(f.ruta)}" style="width:100%;background:none;border:none;border-bottom:1px solid var(--linea);text-align:left;cursor:pointer">
        <span class="crece">
          <span style="display:block;font-weight:700">${esc(f.titulo)}</span>
          <span class="suave" style="display:block;font-size:14px">${esc(f.sub)}</span>
        </span>
        <span class="etiq">${esc(f.tipo)}</span>
      </button>`).join('')}</div>`;
  };

  entrada.addEventListener('input', pintar);
  res.addEventListener('click', ev => {
    const b = ev.target.closest('[data-ruta]');
    if (b) ir(b.dataset.ruta);
  });
  pintar();
  entrada.focus();
}

// ---------- Comer ----------

// Una comida típica al día + el resto de supermercado. Es el «mixto» de la
// guía y lo que corresponde a no escatimar en lo característico de cada zona.
const COMIDA_TIPICA_DIA = 22;

function pintarComer(caja) {
  const regiones = datos.regionesConDias();
  const p = datos.VIAJE.presupuesto;
  const partidaComida = p.partidas.find(x => /comida/i.test(x.concepto));
  const dias = datos.dias().length;
  const conTipica = COMIDA_TIPICA_DIA * dias;
  const extra = conTipica - partidaComida.recomendado;

  caja.innerHTML = `
    <div class="tarjeta">
      <h2>Comer lo de cada sitio</h2>
      <p style="margin-top:6px">La regla que hace que esto salga barato sin renunciar a nada:
      <b>una comida de verdad al día</b>, la característica de la región donde estés, y el resto
      del día de supermercado. Casi todo lo imprescindible de Italia es <b>comida de calle</b>
      de 2 a 6 €, no restaurante.</p>
      <div class="tabla-envoltorio" style="margin-top:12px"><table class="tabla">
        <thead><tr><th>Plan de comida</th><th>Al día</th><th>12 días</th></tr></thead>
        <tbody>
          <tr><td>Mínimo (supermercado)</td><td class="mono">${eur(partidaComida.minimo / dias)}</td><td class="mono">${eur(partidaComida.minimo)}</td></tr>
          <tr><td>Previsto</td><td class="mono">${eur(partidaComida.recomendado / dias)}</td><td class="mono">${eur(partidaComida.recomendado)}</td></tr>
          <tr style="background:var(--ok-sua)"><td><b>Una típica al día</b></td><td class="mono"><b>${eur(COMIDA_TIPICA_DIA)}</b></td><td class="mono"><b>${eur(conTipica)}</b></td></tr>
          <tr><td>Holgado</td><td class="mono">${eur(partidaComida.completo / dias)}</td><td class="mono">${eur(partidaComida.completo)}</td></tr>
        </tbody>
      </table></div>
      <p style="margin-top:11px;font-weight:700">
        Comer lo típico cada día cuesta <b style="color:var(--acento)">${eur(extra)} más</b> que el
        plan previsto: el viaje pasa de ${eur(p.totales.recomendado)} a ${eur(p.totales.recomendado + extra)}.
      </p>
      <p class="suave" style="font-size:14px;margin-top:6px">Sigue por debajo del escenario holgado (${eur(p.totales.completo)}).</p>
    </div>

    <div class="seccion-tit">Las seis regiones</div>
    ${regiones.map((r, i) => {
      const destacados = r.platos.filter(x => x.destacado);
      const resto = r.platos.filter(x => !x.destacado);
      return plegable(`comer-${r.region}`, r.region,
        `${r.dias.map(d => d.etiqueta).join(', ')} · ${destacados.map(x => x.nombre.split(/[(·]/)[0].trim()).join(', ')}`,
        `<div class="envuelve" style="margin-bottom:12px">
          ${r.dias.map(d => `<button class="btn btn-peq" data-dia="${d.dia}">${esc(d.etiqueta)} · ${esc(d.fecha.slice(8))} ago</button>`).join('')}
        </div>
        <div class="seccion-tit" style="margin:0 0 6px">Esto no te lo saltes</div>
        ${destacados.map(x => `<div class="plato"><span class="plato-marca">★</span><span class="crece">${esc(x.nombre)}</span></div>`).join('')}
        <p class="mono suave" style="font-size:14.5px;margin-top:8px">${esc(r.precios)}</p>
        ${resto.length ? `<div class="seccion-tit">Y si te apetece</div>
          <p class="suave" style="font-size:15px">${resto.map(x => esc(x.nombre)).join(' · ')}</p>` : ''}
        <div class="seccion-tit">Dónde, con nombre y calle</div>
        <div class="prosa" style="font-size:15.5px">${r.donde_html}</div>`,
        { abierto: i === 0 });
    }).join('')}

    ${plegable('comer-mapa', 'Sitios con coordenadas', `${datos.lugaresComer().length} en el mapa, con botón de navegar`,
      datos.lugaresComer().map(l => `
        <div class="item-lista">
          <div class="crece">
            <div style="font-weight:700">${esc(l.nombre)}</div>
            <div class="suave" style="font-size:14.5px">${esc(l.descripcion)}</div>
            <div class="envuelve" style="margin-top:6px">
              ${l.precio ? `<span class="etiq">${esc(l.precio)}</span>` : ''}
              <span class="etiq">día ${l.dia}</span>
              <button class="btn btn-peq" data-nav="${l.lat},${l.lon}" data-nombre="${esc(l.nombre)}">Navegar</button>
            </div>
          </div>
        </div>`).join(''))}

    ${plegable('comer-trucos', 'Trucos y supermercado', 'Los ocho que de verdad bajan la cuenta',
      `<div class="prosa">${datos.ficha('comer')}</div>`)}`;

  recordarPliegues(caja);
  caja.addEventListener('click', ev => {
    const nav = ev.target.closest('[data-nav]');
    if (nav) {
      const [la, lo] = nav.dataset.nav.split(',');
      return hojaNavegar(+la, +lo, nav.dataset.nombre || '');
    }
    const d = ev.target.closest('[data-dia]');
    if (d) ir(`#/ruta?dia=${d.dataset.dia}`);
  });
}

// ---------- Reservas ----------

const CICLO = { pendiente: 'reservada', reservada: 'pagada', pagada: 'pendiente' };
const ETIQ_ESTADO = { pendiente: '', reservada: 'etiq-info', pagada: 'etiq-ok' };

function pintarReservas(caja) {
  const lista = datos.reservasOrdenadas();
  const hechas = lista.filter(r => datos.estadoReserva(r.id) !== 'pendiente').length;

  caja.innerHTML = `
    <div class="tarjeta">
      <div class="fila fila-sep"><b>${hechas} de ${lista.length} gestionadas</b>
        <span class="etiq">${eur(lista.reduce((t, r) => t + r.precio_eur, 0))} en total</span></div>
      <div class="barra" style="margin-top:9px"><i style="width:${hechas / lista.length * 100}%"></i></div>
    </div>
    ${lista.map(r => {
      const est = datos.estadoReserva(r.id);
      const critica = r.prioridad === 'critica';
      return `<div class="tarjeta ${critica ? (est === 'pendiente' ? 'res-critica' : 'res-critica res-lista') : ''}">
        <div class="fila fila-sep" style="align-items:flex-start">
          <div class="crece">
            <div class="envuelve" style="margin-bottom:6px">
              <span class="etiq ${critica ? 'etiq-peligro' : r.prioridad === 'alta' ? 'etiq-alerta' : ''}">${esc(r.prioridad)}</span>
              <span class="etiq ${ETIQ_ESTADO[est]}">${esc(est)}</span>
            </div>
            <div style="font-weight:700;font-size:17px">${esc(r.que)}</div>
            <div class="suave" style="font-size:14.5px;margin-top:2px">
              ${esc(fechaCorta(r.fecha))}${r.hora ? ' · ' + esc(r.hora) : ''} · ${eur(r.precio_eur)} · día ${r.dia}
            </div>
          </div>
        </div>
        ${r.nota ? `<p style="margin-top:9px;font-size:15px">${esc(r.nota)}</p>` : ''}
        <div class="envuelve" style="margin-top:11px">
          <button class="btn btn-peq ${est === 'pendiente' ? 'btn-pri' : ''}" data-ciclo="${esc(r.id)}">
            Marcar como ${esc(CICLO[est])}
          </button>
          ${r.url ? `<a class="btn btn-peq" href="${esc(r.url)}" target="_blank" rel="noopener">Web oficial</a>` : ''}
          <button class="btn btn-peq" data-dia="${r.dia}">Ver el día</button>
        </div>
      </div>`;
    }).join('')}

    <div class="seccion-tit">Lo que NO hay que reservar</div>
    <div class="tarjeta">
      ${datos.VIAJE.no_reservar.map(x => `<div class="item-lista"><span class="crece">${esc(x)}</span></div>`).join('')}
    </div>`;

  caja.addEventListener('click', ev => {
    const c = ev.target.closest('[data-ciclo]');
    if (c) {
      const id = c.dataset.ciclo;
      const nuevo = CICLO[datos.estadoReserva(id)];
      estado.fijarReserva(id, nuevo);
      avisar(`Reserva ${nuevo}`);
      return pintarReservas(caja);
    }
    const d = ev.target.closest('[data-dia]');
    if (d) ir(`#/ruta?dia=${d.dataset.dia}`);
  });
}

// ---------- Equipaje ----------

function pintarEquipaje(caja) {
  const s = estado.obtener();
  const items = datos.VIAJE.equipaje.map((x, i) => ({ ...x, i }));
  const grupos = [...new Set(items.map(x => x.grupo))];
  const puestos = items.filter(x => s.equipaje_estado[x.i]).length;
  const faltanImprescindibles = items.filter(x => x.imprescindible && !s.equipaje_estado[x.i]).length;

  caja.innerHTML = `
    <div class="tarjeta">
      <div class="fila fila-sep"><b>${puestos} de ${items.length} en el coche</b>
        <span class="etiq ${faltanImprescindibles ? 'etiq-peligro' : 'etiq-ok'}">
          ${faltanImprescindibles ? `faltan ${faltanImprescindibles} imprescindibles` : 'imprescindibles ✓'}
        </span></div>
      <div class="barra ${faltanImprescindibles ? 'va-justo' : ''}" style="margin-top:9px"><i style="width:${puestos / items.length * 100}%"></i></div>
    </div>
    ${grupos.map(g => `
      <div class="seccion-tit">${esc(g)}</div>
      <div class="tarjeta">
        ${items.filter(x => x.grupo === g).map(x => {
          const ok = !!s.equipaje_estado[x.i];
          return `<div class="item-lista">
            <button class="chk" data-eq="${x.i}" aria-pressed="${ok}" aria-label="${esc(x.item)}"><i>✓</i></button>
            <span class="crece" style="${ok ? 'opacity:.55;text-decoration:line-through' : ''}">
              ${esc(x.item)}
              ${x.imprescindible ? ' <span class="etiq etiq-peligro">imprescindible</span>' : ''}
            </span>
          </div>`;
        }).join('')}
      </div>`).join('')}`;

  caja.addEventListener('click', ev => {
    const b = ev.target.closest('[data-eq]');
    if (!b) return;
    estado.alternar('equipaje_estado', b.dataset.eq);
    pintarEquipaje(caja);
  });
}

// ---------- Antes de salir ----------

function pintarAntes(caja) {
  const s = estado.obtener();
  const lista = datos.VIAJE.pendientes_de_verificar;
  const hechos = lista.filter((_, i) => s.equipaje_estado['v' + i]).length;

  caja.innerHTML = `
    <div class="tarjeta">
      <p>Diez datos que dependen de información que todavía no se había publicado o que las fuentes dan con
      discrepancias. <b>Compruébalos antes de salir</b>; la app no los inventa.</p>
      <div class="fila fila-sep" style="margin-top:10px"><b>${hechos} de ${lista.length} comprobados</b></div>
      <div class="barra" style="margin-top:8px"><i style="width:${hechos / lista.length * 100}%"></i></div>
    </div>
    <div class="tarjeta">
      ${lista.map((x, i) => {
        const ok = !!s.equipaje_estado['v' + i];
        const url = (x.match(/(?:https?:\/\/)?([a-z0-9.-]+\.(?:it|com|org|es|php)(?:\/[^\s,]*)?)/i) || [])[1];
        return `<div class="item-lista">
          <button class="chk" data-ver="v${i}" aria-pressed="${ok}" aria-label="Comprobado"><i>✓</i></button>
          <span class="crece" style="${ok ? 'opacity:.55' : ''}">
            ${esc(x)}
            ${url ? `<br><a class="btn btn-peq" style="margin-top:7px" href="https://${esc(url.replace(/^https?:\/\//, ''))}" target="_blank" rel="noopener">Abrir la fuente</a>` : ''}
          </span>
        </div>`;
      }).join('')}
    </div>`;

  caja.addEventListener('click', ev => {
    const b = ev.target.closest('[data-ver]');
    if (!b) return;
    estado.alternar('equipaje_estado', b.dataset.ver);
    pintarAntes(caja);
  });
}

// ---------- Fichas de consulta ----------

const edad = () => Number(estado.obtener().ajustes.edad) || 0;

/**
 * El descuento estatal italiano corta en 25 años inclusive. Anunciarlo en
 * verde a quien no le aplica es peor que no decir nada: si no entras, la
 * ficha dice lo que te va a costar de más.
 */
function fichaDescuentoJoven(dj) {
  const e = edad();
  const dentro = e >= 18 && e <= 25;
  const menor = e > 0 && e < 18;

  if (dentro || menor) {
    return `<div style="padding:11px 13px;border-radius:11px;background:var(--ok-sua);color:var(--ok)">
      <b style="font-size:19px">${menor ? 'Menor de 18 → gratis' : `${esc(dj.rango_edad)} → ${eur(dj.precio_eur, 2)}`}</b>
      <p style="margin:6px 0 0"><b>Requisito:</b> ${menor ? 'cualquier nacionalidad' : esc(dj.requisito)}</p>
      <p style="margin:4px 0 0"><b>Sirve en:</b> ${esc(dj.aplica_a)}</p>
      <p style="margin:4px 0 0"><b>No sirve en:</b> ${esc(dj.no_aplica_a)}</p>
      <p style="margin:4px 0 0"><b>Ahorro estimado:</b> ${eur(dj.ahorro_estimado_eur)}</p>
    </div>`;
  }

  return `<div style="padding:11px 13px;border-radius:11px;background:var(--peligro-sua);color:var(--peligro)">
    <b style="font-size:19px">Con ${e} años no te aplica</b>
    <p style="margin:6px 0 0">
      El precio de ${eur(dj.precio_eur, 2)} en museos estatales es sólo de <b>${esc(dj.rango_edad)}</b>.
      Pagas tarifa completa, unos <b>${eur(dj.ahorro_estimado_eur)} más</b> en todo el viaje.
    </p>
    <p style="margin:6px 0 0">
      Sale en ${esc(dj.aplica_a)}. <b>No existe ninguna tarjeta joven general</b> que lo sustituya:
      el corte está en los 25.
    </p>
  </div>`;
}

function acordeon(id, titulo, contenido, abierto) {
  return `<details class="acordeon" id="f-${id}" ${abierto ? 'open' : ''}>
    <summary>${esc(titulo)}</summary>
    <div>${contenido}</div>
  </details>`;
}

function pintarFichas(caja, abrir) {
  const c = datos.VIAJE.conduccion;
  const t = datos.VIAJE.transporte;

  caja.innerHTML = `
    <div class="tarjeta" style="border:2px solid var(--peligro)">
      <div class="seccion-tit" style="margin:0 0 8px;color:var(--peligro)">Emergencias</div>
      <div class="envuelve">
        <a class="btn btn-pri" href="tel:112">112 · Emergencias</a>
        <a class="btn" href="tel:+390668440401">Consulado España Roma</a>
      </div>
      <p class="suave" style="font-size:14px;margin-top:9px">
        112 europeo · Carabinieri 112 · Policía 113 · Bomberos 115 · Sanitaria 118.
      </p>
    </div>

    ${acordeon('ztl', 'ZTL: la multa que se lleva a casa', `
      <p style="padding:10px 12px;border-radius:10px;background:var(--peligro-sua);color:var(--peligro);font-weight:700">
        ${esc(c.ztl.regla)}
      </p>
      <p style="margin-top:10px"><b>El error de siempre:</b> ${esc(c.ztl.error_frecuente)}</p>
      <p><b>Mito:</b> ${esc(c.ztl.mito)}</p>
      <div class="tabla-envoltorio"><table class="tabla">
        <thead><tr><th>Ciudad</th><th>Riesgo</th><th>Multa</th></tr></thead>
        <tbody>${c.ztl.ciudades.map(x => `<tr>
          <td><b>${esc(x.ciudad)}</b><br><small class="suave">${esc(x.horario)}</small></td>
          <td class="riesgo-${esc(x.riesgo)}">${esc(x.riesgo)}</td>
          <td class="mono">${esc(x.multa_eur)} €</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div class="seccion-tit">Dónde aparcar</div>
      ${datos.VIAJE.lugares.filter(l => l.categoria === 'parking').map(l => `
        <div class="item-lista">
          <div class="crece">
            <div style="font-weight:700">${esc(l.nombre)}</div>
            <div class="suave" style="font-size:14.5px">${esc(l.descripcion)}</div>
            <div class="envuelve" style="margin-top:6px">
              <span class="etiq etiq-acento">${esc(l.precio ?? '—')}</span>
              <span class="etiq">día ${l.dia}</span>
              ${l.coords_aproximadas ? '<span class="etiq etiq-alerta">coords ≈</span>' : ''}
              <button class="btn btn-peq" data-nav="${l.lat},${l.lon}" data-nombre="${esc(l.nombre)}">Navegar</button>
            </div>
          </div>
        </div>`).join('')}
      <div class="prosa" style="margin-top:14px">${datos.ficha('aparcar')}</div>
    `, abrir === 'ztl')}

    ${acordeon('peajes', 'Peajes, combustible y límites', `
      <div class="tabla-envoltorio"><table class="tabla">
        <thead><tr><th>Tramo</th><th>km</th><th>Peaje</th></tr></thead>
        <tbody>${c.peajes.map(p => `<tr>
          <td><b>${esc(p.tramo)}</b>${p.alternativa_gratis ? `<br><small class="suave">Gratis: ${esc(p.alternativa_gratis)}</small>` : ''}</td>
          <td class="mono">${p.km}</td>
          <td class="mono">${p.eur ? eur(p.eur, 2) : '<span class="etiq etiq-ok">0</span>'}</td>
        </tr>`).join('')}
        <tr class="total"><td>Total si los pagas todos</td><td class="mono">${num(c.peajes.reduce((s, p) => s + p.km, 0))}</td>
        <td class="mono">${eur(c.peajes.reduce((s, p) => s + p.eur, 0), 2)}</td></tr></tbody>
      </table></div>
      <p class="etiq etiq-alerta" style="white-space:normal;line-height:1.45;padding:9px 12px;margin-top:12px">${esc(c.combustible.aviso)}</p>
      <div class="tabla-envoltorio" style="margin-top:10px"><table class="tabla">
        <thead><tr><th>Precio €/l</th><th>Gasolina</th><th>Gasóleo</th></tr></thead>
        <tbody>
          <tr><td>Self, carretera</td><td class="mono">${num(c.combustible.gasolina95_self_carretera, 3)}</td><td class="mono">${num(c.combustible.gasoleo_self_carretera, 3)}</td></tr>
          <tr><td>Servito</td><td class="mono">${num(c.combustible.gasolina95_servito, 3)}</td><td class="mono">${num(c.combustible.gasoleo_servito, 3)}</td></tr>
          <tr><td>Self, autopista</td><td class="mono">${num(c.combustible.gasolina95_self_autopista, 3)}</td><td class="mono">${num(c.combustible.gasoleo_self_autopista, 3)}</td></tr>
        </tbody>
      </table></div>
      <div class="envuelve" style="margin-top:12px">
        ${Object.entries(c.limites_kmh).map(([k, v]) => `<span class="etiq">${esc(k)}: ${v} km/h</span>`).join('')}
      </div>
      <div class="seccion-tit">Tráfico en agosto</div>
      <p><b>Bollino rosso:</b> ${c.trafico_agosto_2026.bollino_rosso.map(esc).join(' · ')}</p>
      <p><b>Ventana tranquila:</b> ${esc(c.trafico_agosto_2026.ventana_tranquila)}</p>
      <p><b>Camiones prohibidos:</b> ${c.trafico_agosto_2026.camiones_prohibidos.map(esc).join(' · ')}</p>
      <div class="prosa" style="margin-top:14px">${datos.ficha('conducir')}</div>
    `, abrir === 'peajes')}

    ${acordeon('abonos', 'Abonos, billetes y descuento joven', `
      ${t.abonos.map(a => `<div class="item-lista">
        <div class="crece">
          <div style="font-weight:700">${esc(a.nombre)}</div>
          <div class="suave" style="font-size:14.5px;margin-top:2px">${esc(a.razon)}</div>
        </div>
        <div style="text-align:right">
          <div class="etiq ${a.veredicto === 'comprar' ? 'etiq-ok' : a.veredicto === 'no' ? 'etiq-peligro' : 'etiq-alerta'}">${esc(a.veredicto)}</div>
          <div class="mono suave" style="font-size:13.5px;margin-top:3px">${a.precio_eur != null ? eur(a.precio_eur, 2) : '—'}</div>
        </div>
      </div>`).join('')}
      <div class="seccion-tit">Billetes sueltos</div>
      <div class="tabla-envoltorio"><table class="tabla">
        <thead><tr><th>Ciudad</th><th>Título</th><th>€</th></tr></thead>
        <tbody>${t.billetes_sueltos.map(b => `<tr>
          <td>${esc(b.ciudad)}</td>
          <td>${esc(b.titulo)}${b.nota ? `<br><small class="suave">${esc(b.nota)}</small>` : ''}</td>
          <td class="mono">${num(b.precio_eur, 2)}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div class="seccion-tit">Descuento joven UE</div>
      ${fichaDescuentoJoven(t.descuento_joven)}
    `, abrir === 'abonos')}

    ${acordeon('comer', 'Comer barato', `
      ${datos.VIAJE.lugares.filter(l => l.categoria === 'comer').map(l => `
        <div class="item-lista">
          <div class="crece">
            <div style="font-weight:700">${esc(l.nombre)}</div>
            <div class="suave" style="font-size:14.5px">${esc(l.descripcion)}</div>
          </div>
          <span class="etiq etiq-acento">${esc(l.precio ?? '')}</span>
        </div>`).join('')}
      <div class="prosa" style="margin-top:14px">${datos.ficha('comer')}</div>
    `, abrir === 'comer')}

    ${acordeon('dormir', 'Dormir en el coche', `
      ${datos.VIAJE.noches.map(n => `<div class="item-lista">
        <div class="crece">
          <div style="font-weight:700">${esc(n.nombre)}</div>
          <div class="suave" style="font-size:14.5px">${esc(fechaCorta(n.fecha))} · ${esc(n.nota ?? '')}</div>
          ${n.servicios?.length ? `<div class="envuelve" style="margin-top:5px">${n.servicios.map(s => `<span class="etiq">${esc(s)}</span>`).join('')}</div>` : ''}
        </div>
        <div style="text-align:right">
          <span class="etiq ${n.precio_eur ? '' : 'etiq-ok'}">${n.precio_eur ? eur(n.precio_eur) : 'gratis'}</span>
          <button class="btn btn-peq" style="margin-top:6px" data-nav="${n.lat},${n.lon}" data-nombre="${esc(n.nombre)}">Navegar</button>
        </div>
      </div>`).join('')}
      <div class="prosa" style="margin-top:14px">${datos.ficha('dormir')}</div>
    `, abrir === 'dormir')}

    ${acordeon('tours', 'Tours y audioguías', `
      ${datos.VIAJE.tours.map(x => `<div class="item-lista">
        <div class="crece">
          <div style="font-weight:700">${esc(x.nombre)}</div>
          <div class="suave" style="font-size:14.5px">${esc(x.razon)}</div>
        </div>
        <div style="text-align:right">
          <div class="etiq ${x.veredicto === 'si' ? 'etiq-ok' : 'etiq-peligro'}">${x.veredicto === 'si' ? 'sí' : 'no'}</div>
          <div class="mono suave" style="font-size:13.5px;margin-top:3px">${eur(x.precio_eur)}</div>
        </div>
      </div>`).join('')}
      <div class="seccion-tit">Audioguías</div>
      ${datos.VIAJE.audioguias.map(a => `<div class="item-lista">
        <div class="crece">
          <div style="font-weight:700">${esc(a.nombre)}</div>
          <div class="suave" style="font-size:14.5px">${esc(a.idioma)} · ${esc(a.cubre.join(', '))}</div>
        </div>
        <span class="etiq ${a.offline ? 'etiq-ok' : 'etiq-alerta'}">${a.offline ? 'offline' : 'necesita datos'}</span>
      </div>`).join('')}
      <div class="prosa" style="margin-top:14px">${datos.ficha('tours')}</div>
    `, abrir === 'tours')}

    ${acordeon('eventos', 'Eventos en tus fechas', `
      ${datos.VIAJE.eventos.map(e => `<div class="item-lista">
        <div class="crece">
          <div style="font-weight:700">${esc(e.nombre)}</div>
          <div class="suave" style="font-size:14.5px">
            ${esc(e.lugar)} · ${esc(fechaCorta(e.fecha_inicio))}${e.fecha_fin !== e.fecha_inicio ? ' – ' + esc(fechaCorta(e.fecha_fin)) : ''} · ${esc(e.precio)}
          </div>
        </div>
        <span class="etiq ${e.en_ruta ? 'etiq-ok' : ''}">${e.en_ruta ? 'en ruta' : 'desvío'}</span>
      </div>`).join('')}
    `, abrir === 'eventos')}

    ${acordeon('natura', 'Playas, termas y senderos', `<div class="prosa">${datos.ficha('naturaleza')}</div>`, abrir === 'natura')}
    ${acordeon('riesgos', 'Riesgos y estafas', `<div class="prosa">${datos.ficha('riesgos')}</div>`, abrir === 'riesgos')}
    ${acordeon('apps', 'Apps, webs, teléfonos y frases', `<div class="prosa">${datos.ficha('apps')}</div>`, abrir === 'apps')}`;

  caja.addEventListener('click', ev => {
    const b = ev.target.closest('[data-nav]');
    if (!b) return;
    const [la, lo] = b.dataset.nav.split(',');
    hojaNavegar(+la, +lo, b.dataset.nombre || '');
  });

  if (abrir) caja.querySelector('#f-' + abrir)?.scrollIntoView({ block: 'start' });
}
