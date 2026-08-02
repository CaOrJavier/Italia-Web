// La ruta en seco: una línea por día con las paradas, los kilómetros y dónde
// duermes. Sin explicaciones, para copiar y pegar en otro sitio.
//
// El formato usa separadores « · » y no columnas con espacios a propósito: pegado
// en WhatsApp o en un correo, la fuente no es de ancho fijo y las columnas se
// descuadrarían. Así se lee igual de bien en cualquier parte.

import * as datos from '../datos.js';
import { esc, fechaCorta, minutosAHoras, numero, euros } from '../util.js';
import { ir } from '../app.js';

export function pintar(main, params) {
  const idRuta = datos.RUTA.has(params.get('r')) ? params.get('r') : datos.RUTAS.rutas[0].id;
  const ruta = datos.RUTA.get(idRuta);

  main.innerHTML = `
    <p class="intro">La ruta en seco, para copiar y pegar donde quieras.</p>

    <div class="filtros" id="f-rutas" role="group" aria-label="Ruta">
      ${datos.RUTAS.rutas.map(r => `<button type="button" data-r="${esc(r.id)}"
        aria-pressed="${r.id === idRuta}" style="--c:${esc(r.color)}">
        <span class="raya"></span>${r.numero}. ${esc(r.nombre)}</button>`).join('')}
    </div>

    <div class="tarjeta">
      <div class="cab-tarjeta">
        <h3>${ruta.numero}. ${esc(ruta.nombre)}</h3>
        <button type="button" id="copiar" class="btn-copiar">Copiar</button>
      </div>
      <pre class="seco" id="seco">${esc(texto(ruta))}</pre>
    </div>

    <details class="tarjeta">
      <summary class="cab-tarjeta" style="cursor:pointer">
        <h3>Solo los kilómetros</h3>
        <span class="etiq etiq-gris">Aún más corto</span>
      </summary>
      <div class="cab-tarjeta" style="border-top:1px solid var(--linea)">
        <span class="peq" style="flex:1">Sin paradas ni sitios donde dormir.</span>
        <button type="button" id="copiar-km" class="btn-copiar">Copiar</button>
      </div>
      <pre class="seco" id="seco-km">${esc(soloKm(ruta))}</pre>
    </details>

    <details class="tarjeta">
      <summary class="cab-tarjeta" style="cursor:pointer">
        <h3>Las seis rutas seguidas</h3>
        <span class="etiq etiq-gris">Para comparar en otro sitio</span>
      </summary>
      <div class="cab-tarjeta" style="border-top:1px solid var(--linea)">
        <span class="peq" style="flex:1">Los seis bloques, uno detrás de otro.</span>
        <button type="button" id="copiar-todas" class="btn-copiar">Copiar</button>
      </div>
      <pre class="seco" id="seco-todas">${esc(datos.RUTAS.rutas.map(texto).join('\n\n\n'))}</pre>
    </details>
  `;

  main.querySelectorAll('#f-rutas button').forEach(b => {
    b.addEventListener('click', () => ir('resumen', new URLSearchParams({ r: b.dataset.r })));
  });

  enlazarCopia(main, 'copiar', 'seco');
  enlazarCopia(main, 'copiar-km', 'seco-km');
  enlazarCopia(main, 'copiar-todas', 'seco-todas');
}

/** Una línea por día: día, fecha, paradas, kilómetros y dónde se duerme. */
function texto(r) {
  const f = datos.VIAJE.ferri;
  const l = [];
  l.push(`RUTA ${r.numero} · ${r.nombre.toUpperCase()} (${r.lema.toLowerCase()})`);
  l.push(`${numero(r.km)} km · ${minutosAHoras(r.minutos_volante)} al volante · ${euros(r.coste_estimado)} estimados`);
  l.push(`Del ${tramoFechas(f.llegada.fecha, f.salida.fecha)} · ${f.noches} noches durmiendo en el coche`);
  l.push('');

  r.dias.forEach(d => {
    const cama = datos.camaDe(d);
    const donde = cama ? cama.nombre.split('·')[0].trim() : `Ferri ${f.salida.hora}`;
    l.push(`D${d.n} ${fechaCorta(d.fecha)} · ${d.etapa} · ${d.km} km · ${donde}`);
  });

  l.push('');
  l.push(`TOTAL ${numero(r.km)} km y ${minutosAHoras(r.minutos_volante)} de volante en ${r.dias.length} días`);
  return l.join('\n');
}

/** La versión mínima: día y kilómetros, nada más. */
function soloKm(r) {
  const l = [`RUTA ${r.numero} · ${numero(r.km)} km`];
  r.dias.forEach(d => l.push(`D${d.n} ${fechaCorta(d.fecha)} · ${d.km} km`));
  l.push(`TOTAL ${numero(r.km)} km`);
  return l.join('\n');
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Dentro del mismo mes no se repite: '14 al 25 de agosto de 2026'. */
function tramoFechas(desde, hasta) {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  if (a1 === a2 && m1 === m2) return `${d1} al ${d2} de ${MESES[m1 - 1]} de ${a1}`;
  return `${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]} de ${a2}`;
}

function enlazarCopia(main, idBoton, idTexto) {
  const boton = main.querySelector(`#${idBoton}`);
  const bloque = main.querySelector(`#${idTexto}`);
  if (!boton || !bloque) return;

  boton.addEventListener('click', async e => {
    // Dentro de un <summary>, pulsar el botón plegaría el desplegable.
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(bloque.textContent);
      avisar(boton, 'Copiado ✓');
    } catch {
      // Sin permiso de portapapeles (o sin https) queda seleccionarlo para que
      // el copiar a mano sea un solo gesto.
      const sel = getSelection();
      sel.removeAllRanges();
      const r = document.createRange();
      r.selectNodeContents(bloque);
      sel.addRange(r);
      avisar(boton, 'Seleccionado: Ctrl+C');
    }
  });
}

function avisar(boton, txt) {
  const antes = boton.textContent;
  boton.textContent = txt;
  boton.classList.add('ok');
  setTimeout(() => { boton.textContent = antes; boton.classList.remove('ok'); }, 2000);
}
