// La hoja de ruta, para papel.
//
// El resto de la web es para decidir; esto es para llevar en la guantera cuando
// no hay cobertura. Es la misma pantalla que se ve y que se imprime: no hay un
// PDF aparte que se quede viejo en cuanto se toque un dato.
//
// Lo que cambia respecto a las demás pantallas, todo por el papel:
//
//   · nada se pliega. En una web un <details> cerrado ahorra espacio; en papel
//     lo único que hace es no salir impreso.
//   · cada día es un bloque que no se puede partir por la mitad. Un día repartido
//     entre dos hojas es un día que hay que leer dos veces.
//   · sin fotos, sin mapas y sin colores de fondo. Una tinta, y el color se
//     sustituye por el peso de la letra y por las rayas.
//   · solo lo que se consulta en el coche: por dónde vas, a qué hora, dónde
//     aparcas, dónde duermes y qué se come. Lo demás sobra en papel.

import * as datos from '../datos.js';
import { esc, fechaLarga, minutosAHoras, numero, euros } from '../util.js';
import { NIVELES } from '../cadena.js';

export function pintar(main) {
  const r = datos.RUTAS.rutas[0];
  const f = datos.VIAJE.ferri;

  main.className = 'hoja';
  main.innerHTML = `
    <div class="no-papel">
      <p class="intro">La hoja de ruta para llevar en la guantera: los doce días con sus
      paradas, aparcamientos, dónde duermes y qué comer. Dale a imprimir y elige
      <b>«Guardar como PDF»</b> en el destino.</p>
      <label class="opcion-papel">
        <input type="checkbox" id="con-horas">
        <span><b>Añadir el hora a hora completo</b>
          <small>La ruta del día ya lleva la hora de cada parada. Esto mete además todo el
          detalle, y pasa de ocho hojas A4 a diez.</small></span>
      </label>
      <button type="button" id="imprimir" class="btn-imprimir">Imprimir o guardar como PDF</button>
    </div>

    <div class="papel" id="papel">
      ${portada(r, f)}
      ${r.dias.map(dia).join('')}
      ${comida()}
      ${reservas()}
    </div>
  `;

  const papel = main.querySelector('#papel');
  main.querySelector('#con-horas').addEventListener('change', e =>
    papel.classList.toggle('con-horas', e.target.checked));
  main.querySelector('#imprimir').addEventListener('click', () => print());
}

function portada(r, f) {
  return `
  <header class="pl-cab">
    <h1>Italia en coche · ${esc(r.lema.toLowerCase())}</h1>
    <p class="pl-sub">${esc(fechaLarga(f.llegada.fecha))} a ${esc(fechaLarga(f.salida.fecha))}
      · ${numero(r.km)} km · ${minutosAHoras(r.minutos_volante)} al volante
      · ${euros(r.coste_estimado)} estimados · ${f.noches} noches en el coche</p>
    <ul class="pl-fijo">${datos.RUTAS.fijo.puntos.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
    <p class="pl-clave"><b>Las marcas de cada parada:</b>
      ${Object.values(NIVELES).map(n => `${n.simbolo} ${esc(n.nombre.toLowerCase())}`).join(' · ')}</p>
  </header>`;
}

/** Un día: la cadena de paradas, el hora a hora y la ficha de dormir, aparcar y
 *  comer. Es lo que se mira en el coche, en ese orden. */
function dia(d) {
  const cama = datos.camaDe(d);
  const parkings = datos.parkingsDe(d);

  return `
  <section class="pl-dia">
    <h2><span class="pl-n">D${d.n}</span> ${esc(d.titulo)}
      <small>${esc(fechaLarga(d.fecha))} · ${d.km} km · ${minutosAHoras(d.minutos)} al volante</small></h2>
    <p class="pl-etapa">${esc(d.etapa)}</p>

    ${(d.paradas || []).length ? `<ol class="pl-paradas">${d.paradas.map(p => {
      const n = NIVELES[p.nivel];
      const l = p.lugar ? datos.lugar(p.lugar) : null;
      return `<li>
        <span class="pl-hora">${esc(p.hora)}</span>
        <span class="pl-marca">${n.simbolo}</span>
        <span><b>${esc(l ? l.nombre : p.nombre)}</b>${p.dura ? ` <em>${minutosAHoras(p.dura)}</em>` : ''}${
          p.salta ? `<br><span class="pl-salta">Si vas tarde: ${esc(p.salta)}</span>` : ''}</span>
      </li>`;
    }).join('')}</ol>` : ''}

    <ul class="pl-horas">${(d.plan || []).map(p =>
      `<li><span>${esc(p.hora)}</span> ${esc(p.que)}</li>`).join('')}</ul>

    <dl class="pl-ficha">
      ${parkings.length ? `<dt>Aparcar</dt><dd>${parkings.map(p =>
        `<b>${esc(p.parking)}</b> · ${esc(p.precio)} · ${p.minutos_centro} min al centro${
          p.billete && p.billete !== '—' ? ` · ${esc(p.billete)}` : ''}`).join('<br>')}</dd>` : ''}
      <dt>Dormir</dt><dd>${cama
        ? `<b>${esc(cama.nombre)}</b> · ${cama.precio === 0 ? 'gratis' : esc(cama.precio) + ' €'} · ${cama.altitud} m`
        : `<b>En el ferri</b> · sale a las ${esc(datos.VIAJE.ferri.salida.hora)}`}</dd>
      <dt>Comer</dt><dd>${esc(d.comer)}</dd>
      ${d.aviso ? `<dt>Ojo</dt><dd>${esc(d.aviso)}</dd>` : ''}
    </dl>
  </section>`;
}

/** La chuleta de comida: qué pedir en cada zona y cuánto cuesta. Los platos
 *  marcados como imprescindibles van primero y en negrita. */
function comida() {
  const c = datos.COMER;
  return `
  <section class="pl-dia pl-corte">
    <h2>Qué comer, zona por zona</h2>
    ${c.regiones.map(r => `
      <div class="pl-region">
        <h3>${esc(r.region)} <small>${esc(r.cuando)} · ${esc(r.presupuesto_dia)}</small></h3>
        <p class="pl-salta">${esc(r.resumen)}</p>
        <ul class="pl-platos">${r.platos.map(p => `
          <li${p.imprescindible ? ' class="pl-must"' : ''}>
            <b>${esc(p.nombre)}</b> <span class="pl-precio">${esc(p.precio)}</span>
            ${p.imprescindible
              // Los imprescindibles llevan su explicación; los demás, el nombre y
              // dónde pedirlos. En papel una chuleta de veintiún platos con
              // párrafo cada uno no se lee: se hojea buscando un nombre.
              ? `<br>${esc(p.que_es)}${p.donde ? `<br><span class="pl-salta">Dónde: ${esc(p.donde)}</span>` : ''}`
              : p.donde ? ` <span class="pl-salta">· ${esc(p.donde)}</span>` : ''}
          </li>`).join('')}</ul>
        ${r.donde_comer ? `<p class="pl-salta">${esc(r.donde_comer)}</p>` : ''}
      </div>`).join('')}
    <div class="pl-region">
      <h3>Reglas que no fallan</h3>
      <ul class="pl-platos">${c.trucos.map(t => `
        <li><b>${esc(t.titulo)}</b><br>${esc(t.texto)}</li>`).join('')}</ul>
    </div>
  </section>`;
}

/** Lo que hay que llevar sacado de casa. En papel va como lista de comprobación,
 *  que es para lo que sirve una hoja impresa. */
function reservas() {
  const R = datos.RESERVAS;
  const criticas = R.reservas.filter(x => x.prioridad === 'critica');
  const resto = R.reservas.filter(x => x.prioridad !== 'critica');

  const fila = x => `<li><span class="pl-casilla"></span>
    <b>${esc(x.que)}</b> · ${esc(x.precio_txt)}${x.abre_dias_antes
      ? ` · se abre ${x.abre_dias_antes} días antes` : ''}
    <br><span class="pl-salta">${esc(x.como)}</span></li>`;

  return `
  <section class="pl-dia pl-corte">
    <h2>Antes de salir de casa</h2>
    <p class="pl-etapa">${esc(R.aviso_franja)}</p>
    <div class="pl-region">
      <h3>Sin esto no entras</h3>
      <ul class="pl-lista">${criticas.map(fila).join('')}</ul>
    </div>
    <div class="pl-region">
      <h3>Lo demás</h3>
      <ul class="pl-lista">${resto.map(fila).join('')}</ul>
    </div>
    <div class="pl-region">
      <h3>Papeleo</h3>
      <ul class="pl-lista">${R.papeleo.map(x => `<li><span class="pl-casilla"></span>
        <b>${esc(x.que)}</b><br><span class="pl-salta">${esc(x.detalle)}</span></li>`).join('')}</ul>
    </div>
  </section>`;
}
