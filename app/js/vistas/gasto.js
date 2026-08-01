// Presupuesto: lo previsto contra lo que se gasta de verdad, y el registro
// rápido de gasto (importe + categoría, sin pantalla de confirmación).

import { esc, eur, num, ahora, fechaCorta, avisar } from '../util.js';
import * as datos from '../datos.js';
import * as estado from '../estado.js';
import { abrirHoja, cerrarHoja, repintar, confirmar, plegable, recordarPliegues } from '../ui.js';

export const CATEGORIAS = [
  { id: 'comida',      nombre: 'Comida',      color: '#6b3fa0' },
  { id: 'combustible', nombre: 'Gasolina',    color: '#8c2f22' },
  { id: 'peajes',      nombre: 'Peajes',      color: '#a8600b' },
  { id: 'aparcar',     nombre: 'Aparcar',     color: '#2f6fb5' },
  { id: 'dormir',      nombre: 'Dormir',      color: '#1d5b52' },
  { id: 'transporte',  nombre: 'Transporte',  color: '#0e7c86' },
  { id: 'entradas',    nombre: 'Entradas',    color: '#8a2f6b' },
  { id: 'otros',       nombre: 'Otros',       color: '#5a6270' }
];

const nombreCat = (id) => CATEGORIAS.find(c => c.id === id)?.nombre ?? id;
const colorCat  = (id) => CATEGORIAS.find(c => c.id === id)?.color ?? '#777';

// ---------- Registro rápido: tres toques ----------

export function hojaGastoRapido(fechaPorDefecto) {
  const t = ahora();
  const dias = datos.dias();
  // Fuera de las fechas del viaje se imputa al día más cercano: el presupuesto
  // está organizado por días de viaje y el selector sólo ofrece esos.
  const fecha = fechaPorDefecto
    || (datos.diaPorFecha(t.fecha)?.fecha)
    || (t.fecha < dias[0].fecha ? dias[0].fecha : dias[dias.length - 1].fecha);
  const hoy = datos.diaPorFecha(fecha);
  let importe = '';

  const cuerpo = abrirHoja('Anotar un gasto', `
    <div class="visor" id="visor">0<span style="font-size:26px"> €</span></div>
    <p class="suave centro" style="font-size:14px;margin:8px 0 0">
      ${esc(fechaCorta(fecha))}${hoy ? ` · ${esc(hoy.etiqueta)}` : ''} · lleva ${eur(estado.totalDe(fecha))} hoy
    </p>
    <div class="teclado">
      ${[1,2,3,4,5,6,7,8,9].map(d => `<button class="tecla" data-t="${d}">${d}</button>`).join('')}
      <button class="tecla" data-t=",">,</button>
      <button class="tecla" data-t="0">0</button>
      <button class="tecla" data-t="borrar" aria-label="Borrar">⌫</button>
    </div>
    <p class="suave centro" style="font-size:14px;margin:2px 0 10px">Toca la categoría y queda guardado</p>
    <div class="cats" id="cats">
      ${CATEGORIAS.map(c => `<button class="cat-btn" data-c="${c.id}" disabled>
        <span class="bolita" style="background:${c.color};width:12px;height:12px;border-radius:50%"></span>${esc(c.nombre)}
      </button>`).join('')}
    </div>
    <details style="margin-top:12px">
      <summary class="suave" style="cursor:pointer;min-height:36px">Otra fecha o una nota</summary>
      <label class="campo" style="margin-top:8px"><span>Fecha</span>
        <select id="g-fecha">
          ${datos.dias().map(d => `<option value="${d.fecha}" ${d.fecha === fecha ? 'selected' : ''}>${esc(d.etiqueta)} · ${esc(fechaCorta(d.fecha))}</option>`).join('')}
        </select>
      </label>
      <label class="campo"><span>Nota</span><input type="text" id="g-nota" placeholder="Pizza al taglio en Trastevere"></label>
    </details>`);

  const visor = cuerpo.querySelector('#visor');
  const botonesCat = [...cuerpo.querySelectorAll('.cat-btn')];

  const valor = () => parseFloat(importe.replace(',', '.')) || 0;
  const refrescar = () => {
    visor.innerHTML = `${esc(importe || '0')}<span style="font-size:26px"> €</span>`;
    botonesCat.forEach(b => { b.disabled = valor() <= 0; });
  };

  cuerpo.querySelector('.teclado').addEventListener('click', ev => {
    const b = ev.target.closest('[data-t]');
    if (!b) return;
    const t = b.dataset.t;
    if (t === 'borrar') importe = importe.slice(0, -1);
    else if (t === ',') { if (!importe.includes(',')) importe = (importe || '0') + ','; }
    else if (/^\d$/.test(t)) {
      const [ent, dec] = importe.split(',');
      if (dec !== undefined && dec.length >= 2) return;
      if (dec === undefined && ent.length >= 5) return;
      importe += t;
    }
    refrescar();
  });

  cuerpo.querySelector('#cats').addEventListener('click', ev => {
    const b = ev.target.closest('[data-c]');
    if (!b || b.disabled) return;
    estado.anotarGasto({
      fecha: cuerpo.querySelector('#g-fecha').value,
      categoria: b.dataset.c,
      importe: valor(),
      nota: cuerpo.querySelector('#g-nota').value.trim()
    });
    cerrarHoja();
    avisar(`${eur(valor(), 2)} en ${nombreCat(b.dataset.c).toLowerCase()}`);
    repintar();
  });

  refrescar();
}

// ---------- Pantalla ----------

export function vistaGasto(raiz) {
  const t = ahora();
  const p = datos.VIAJE.presupuesto;
  const dias = datos.dias();
  const primero = dias[0], ultimo = dias[dias.length - 1];

  const gastado = estado.totalGastado();
  const total = p.totales.recomendado;
  const restan = total - gastado;

  const diasRestantes = t.fecha < primero.fecha ? dias.length
    : t.fecha > ultimo.fecha ? 0
    : dias.filter(d => d.fecha >= t.fecha).length;
  const porDia = diasRestantes > 0 ? restan / diasRestantes : 0;

  const pct = Math.round(gastado / total * 100);
  const diaHoy = datos.diaPorFecha(t.fecha);
  const previstoHastaHoy = diaHoy ? datos.previstoAcumulado(diaHoy.dia) : (t.fecha > ultimo.fecha ? total : 0);
  const desvio = gastado - previstoHastaHoy;

  raiz.innerHTML = `
    <div class="tarjeta">
      <div class="fila fila-sep">
        <div>
          <div class="seccion-tit" style="margin:0 0 4px">Gastado</div>
          <div class="cifra"><b>${eur(gastado)}</b><span>de ${eur(total)}</span></div>
        </div>
        <span class="etiq ${pct > 100 ? 'etiq-peligro' : 'etiq-ok'}">${pct}%</span>
      </div>
      <div class="barra ${pct > 100 ? 'va-mal' : pct > 85 ? 'va-justo' : ''}" style="margin-top:11px">
        <i style="width:${Math.min(100, pct)}%"></i>
      </div>
      ${diaHoy ? `<p style="margin-top:10px;font-weight:700;color:${desvio > 0 ? 'var(--peligro)' : 'var(--ok)'}">
        ${desvio > 0 ? `Vas ${eur(desvio)} por encima` : `Vas ${eur(-desvio)} por debajo`} de lo previsto a estas alturas.
      </p>` : ''}
      ${diasRestantes > 0 ? `<p style="margin-top:8px;font-size:17px">
        Te quedan <b>${eur(restan)}</b> y <b>${diasRestantes} día${diasRestantes === 1 ? '' : 's'}</b> →
        <b style="color:${porDia < 40 ? 'var(--peligro)' : 'var(--ok)'}">${eur(porDia)}/día</b>
      </p>` : ''}
      <button class="btn btn-pri btn-blq" id="b-nuevo" style="margin-top:12px">Anotar un gasto</button>
    </div>

    <div class="seccion-tit">Acumulado</div>
    <div class="tarjeta">${grafico(dias, total)}</div>

    ${plegable('g-cat', 'Por categoría', gastado ? `${eur(gastado)} repartidos` : 'Aún no has anotado nada',
      porCategoria())}

    ${plegable('g-dias', 'Día a día', `Previsto contra real, los 12 días`,
      `<div class="tabla-envoltorio">${tablaDias(dias, t.fecha)}</div>`)}

    ${plegable('g-esc', 'Escenarios', `${eur(p.totales.minimo)} · ${eur(p.totales.recomendado)} · ${eur(p.totales.completo)}`,
      `<div class="tabla-envoltorio">${tablaEscenarios(p, gastado)}</div>`)}

    ${plegable('g-calc', 'Calculadora de combustible', 'Km, consumo y precio del litro',
      `<div id="calc">${calculadora()}</div>`)}

    ${plegable('g-lista', 'Últimos gastos', `${estado.obtener().gastos.length} anotado${estado.obtener().gastos.length === 1 ? '' : 's'}`,
      `<div id="lista-gastos">${listaGastos()}</div>`, { abierto: true })}`;

  recordarPliegues(raiz);

  raiz.querySelector('#b-nuevo').addEventListener('click', () => hojaGastoRapido());

  raiz.querySelector('#lista-gastos').addEventListener('click', ev => {
    const b = ev.target.closest('[data-borrar]');
    if (!b) return;
    const g = estado.obtener().gastos.find(x => x.id === b.dataset.borrar);
    confirmar('Borrar gasto', `${eur(g.importe, 2)} en ${esc(nombreCat(g.categoria).toLowerCase())} del ${esc(fechaCorta(g.fecha))}.`,
      'Borrar', () => { estado.borrarGasto(b.dataset.borrar); repintar(); }, { peligro: true });
  });

  const calc = raiz.querySelector('#calc');
  if (calc) {
    calc.addEventListener('input', () => recalcularCombustible(calc));
    calc.addEventListener('change', () => recalcularCombustible(calc));
    recalcularCombustible(calc);
  }
}

// ---------- Piezas ----------

function grafico(dias, total) {
  const An = 320, Al = 168, ml = 34, mr = 8, mt = 10, mb = 22;
  const gastos = estado.obtener().gastos;
  const hoy = ahora().fecha;

  let acPrev = 0, acReal = 0;
  const prev = [], real = [];
  for (const d of dias) {
    acPrev += datos.previstoDia(d.dia);
    acReal += gastos.filter(g => g.fecha === d.fecha).reduce((s, g) => s + g.importe, 0);
    prev.push(acPrev);
    if (d.fecha <= hoy) real.push(acReal);
  }
  const tope = Math.max(total, acPrev, ...real, 100) * 1.06;
  const x = (i) => ml + i * (An - ml - mr) / Math.max(1, dias.length - 1);
  const y = (v) => Al - mb - (v / tope) * (Al - mb - mt);

  const linea = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = real.length
    ? `${linea(real)} L${x(real.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`
    : '';

  const marcas = [0, tope / 2, tope].map(v =>
    `<line class="rej" x1="${ml}" x2="${An - mr}" y1="${y(v)}" y2="${y(v)}"/>
     <text x="2" y="${y(v) + 4}">${Math.round(v)}</text>`).join('');

  return `<svg class="grafico" viewBox="0 0 ${An} ${Al}" role="img"
      aria-label="Gasto acumulado real frente al previsto a lo largo de los 12 días">
    ${marcas}
    ${area ? `<path class="relleno" d="${area}"/>` : ''}
    <path class="prev" d="${linea(prev)}"/>
    ${real.length > 1 ? `<path class="real" d="${linea(real)}"/>` : ''}
    ${real.length ? `<circle cx="${x(real.length - 1)}" cy="${y(real[real.length - 1])}" r="4" fill="var(--acento)"/>` : ''}
    ${dias.map((d, i) => i % 2 === 0 ? `<text x="${x(i)}" y="${Al - 6}" text-anchor="middle">${d.etiqueta}</text>` : '').join('')}
  </svg>
  <div class="envuelve" style="margin-top:8px;font-size:13.5px">
    <span class="etiq">— — previsto (${eur(total)})</span>
    <span class="etiq etiq-acento">—— real</span>
  </div>`;
}

function porCategoria() {
  const gastos = estado.obtener().gastos;
  if (!gastos.length) return '<p class="vacio" style="padding:10px">Todavía no has anotado nada.</p>';
  const suma = new Map();
  for (const g of gastos) suma.set(g.categoria, (suma.get(g.categoria) || 0) + g.importe);
  const total = [...suma.values()].reduce((a, b) => a + b, 0);
  return [...suma.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => `
    <div style="margin-bottom:10px">
      <div class="fila fila-sep" style="font-size:15px">
        <b>${esc(nombreCat(c))}</b>
        <span class="mono">${eur(v, 2)} · ${Math.round(v / total * 100)}%</span>
      </div>
      <div class="barra" style="margin-top:5px"><i style="width:${v / total * 100}%;background:${colorCat(c)}"></i></div>
    </div>`).join('');
}

function tablaDias(dias, hoy) {
  return `<table class="tabla">
    <thead><tr><th>Día</th><th>Previsto</th><th>Real</th><th>Dif.</th></tr></thead>
    <tbody>
      ${dias.map(d => {
        const prev = datos.previstoDia(d.dia);
        const real = estado.totalDe(d.fecha);
        const dif = real - prev;
        const futuro = d.fecha > hoy;
        return `<tr${d.fecha === hoy ? ' style="background:var(--acento-sua)"' : ''}>
          <td><b>${esc(d.etiqueta)}</b> <span class="suave">${esc(fechaCorta(d.fecha))}</span></td>
          <td class="mono">${eur(prev)}</td>
          <td class="mono">${futuro && !real ? '<span class="suave">—</span>' : eur(real)}</td>
          <td class="mono" style="color:${!real ? 'var(--tinta-2)' : dif > 0 ? 'var(--peligro)' : 'var(--ok)'}">
            ${!real ? '—' : (dif > 0 ? '+' : '') + eur(dif)}
          </td>
        </tr>`;
      }).join('')}
      <tr class="total">
        <td>Total</td>
        <td class="mono">${eur(datos.VIAJE.presupuesto.totales.recomendado)}</td>
        <td class="mono">${eur(estado.totalGastado())}</td>
        <td class="mono">${eur(estado.totalGastado() - datos.VIAJE.presupuesto.totales.recomendado)}</td>
      </tr>
    </tbody>
  </table>`;
}

function tablaEscenarios(p, gastado) {
  const nombres = { minimo: 'Mínimo', recomendado: 'Previsto', completo: 'Holgado' };
  return `<table class="tabla">
    <thead><tr><th>Partida</th>${p.escenarios.map(e => `<th>${nombres[e]}</th>`).join('')}</tr></thead>
    <tbody>
      ${p.partidas.map(x => `<tr>
        <td>${esc(x.concepto)}</td>
        ${p.escenarios.map(e => `<td class="mono">${eur(x[e])}</td>`).join('')}
      </tr>`).join('')}
      <tr class="total"><td>Total</td>${p.escenarios.map(e => `<td class="mono">${eur(p.totales[e])}</td>`).join('')}</tr>
      <tr class="total" style="border-top:none">
        <td class="suave">Por día</td>
        ${p.escenarios.map(e => `<td class="mono suave">${eur(p.por_dia[e])}</td>`).join('')}
      </tr>
    </tbody>
  </table>
  <p class="suave" style="font-size:14px;margin-top:10px">
    Llevas <b>${eur(gastado)}</b>: ${
      gastado <= p.totales.minimo ? 'por debajo incluso del escenario mínimo.'
      : gastado <= p.totales.recomendado ? 'entre el mínimo y el previsto.'
      : gastado <= p.totales.completo ? 'entre el previsto y el holgado.'
      : 'por encima del escenario holgado.'}
  </p>`;
}

function calculadora() {
  const c = datos.VIAJE.conduccion.combustible;
  const a = estado.obtener().ajustes;
  return `
    <div class="fila" style="gap:8px;margin-bottom:10px">
      <button class="chip" data-fuel="gasolina" aria-pressed="${a.combustible !== 'gasoleo'}">Gasolina 95</button>
      <button class="chip" data-fuel="gasoleo" aria-pressed="${a.combustible === 'gasoleo'}">Gasóleo</button>
    </div>
    <p class="etiq etiq-alerta" style="white-space:normal;line-height:1.45;padding:8px 11px;margin-bottom:12px">
      ${esc(c.aviso)}
    </p>
    <label class="campo"><span>Kilómetros</span><input type="number" id="c-km" inputmode="numeric" value="${datos.VIAJE.meta.km_totales}"></label>
    <label class="campo"><span>Consumo (l/100 km)</span><input type="number" id="c-cons" inputmode="decimal" step="0.1" value="${a.consumo ?? 7}"></label>
    <label class="campo"><span>Precio por litro (€)</span><input type="number" id="c-precio" inputmode="decimal" step="0.001" value="${a.combustible === 'gasoleo' ? c.gasoleo_self_carretera : c.gasolina95_self_carretera}"></label>
    <div class="fila fila-sep" style="margin-top:6px">
      <span class="suave">Total estimado</span>
      <b class="mono" id="c-total" style="font-size:26px">—</b>
    </div>
    <p class="suave" style="font-size:13.5px;margin-top:8px" id="c-detalle"></p>`;
}

function recalcularCombustible(caja) {
  const km = parseFloat(caja.querySelector('#c-km')?.value) || 0;
  const cons = parseFloat(caja.querySelector('#c-cons')?.value) || 0;
  const precio = parseFloat(caja.querySelector('#c-precio')?.value) || 0;
  const litros = km * cons / 100;
  caja.querySelector('#c-total').textContent = eur(litros * precio);
  caja.querySelector('#c-detalle').textContent =
    `${num(litros, 1)} litros · ${num(km)} km · unos ${Math.ceil(litros / 40)} repostajes de 40 l.`;

  caja.querySelectorAll('[data-fuel]').forEach(b => {
    b.onclick = () => {
      const tipo = b.dataset.fuel;
      const c = datos.VIAJE.conduccion.combustible;
      estado.fijarAjuste('combustible', tipo);
      estado.fijarAjuste('consumo', tipo === 'gasoleo' ? 5.3 : 7);
      caja.querySelectorAll('[data-fuel]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      caja.querySelector('#c-precio').value = tipo === 'gasoleo' ? c.gasoleo_self_carretera : c.gasolina95_self_carretera;
      caja.querySelector('#c-cons').value = tipo === 'gasoleo' ? 5.3 : 7;
      recalcularCombustible(caja);
    };
  });
}

function listaGastos() {
  const gastos = [...estado.obtener().gastos].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
  if (!gastos.length) {
    return `<p class="vacio">Ningún gasto anotado.<br><small>Con el botón «Gasto» de abajo son tres toques: importe, categoría y listo.</small></p>`;
  }
  return gastos.slice(0, 60).map(g => `
    <div class="item-lista">
      <span class="parada-punto" style="background:${colorCat(g.categoria)};margin-top:6px"></span>
      <div class="crece">
        <div style="font-weight:700">${esc(nombreCat(g.categoria))}</div>
        <div class="suave" style="font-size:14px">${esc(fechaCorta(g.fecha))}${g.nota ? ' · ' + esc(g.nota) : ''}</div>
      </div>
      <b class="mono">${eur(g.importe, 2)}</b>
      <button class="btn btn-peq btn-peligro" data-borrar="${esc(g.id)}" aria-label="Borrar gasto">✕</button>
    </div>`).join('')
    + (gastos.length > 60 ? `<p class="suave centro" style="margin-top:10px">y ${gastos.length - 60} más</p>` : '');
}
