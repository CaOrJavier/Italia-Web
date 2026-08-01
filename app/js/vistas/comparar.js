// Las tres rutas, cara a cara.

import * as datos from '../datos.js';
import { esc, minutosAHoras, numero, euros } from '../util.js';
import { figura, creditos, hayFotos } from '../fotos.js';
import { ir } from '../app.js';

/** Noches en las bases cuyo nombre contiene un texto. */
function nochesEn(ruta, texto) {
  return ruta.bases
    .filter(b => b.sitio.toLowerCase().includes(texto.toLowerCase()))
    .reduce((t, b) => t + b.noches, 0);
}

/** ¿Aparece un lugar en el trazado de la ruta? */
function pasaPor(ruta, texto) {
  return ruta.trazado.some(p => p[2].toLowerCase().includes(texto.toLowerCase()));
}

const FILAS = [
  { k: 'Kilómetros', v: r => numero(r.km), n: r => r.km, mejor: 'min' },
  { k: 'Al volante', v: r => minutosAHoras(r.minutos_volante), n: r => r.minutos_volante, mejor: 'min' },
  { k: 'Coste estimado', v: r => euros(r.coste_estimado), n: r => r.coste_estimado, mejor: 'min' },
  { k: 'Día más largo', v: r => `${datos.diaMasLargo(r).km} km`, n: r => datos.diaMasLargo(r).km, mejor: 'min' },
  { k: 'Días apretados', v: r => String(datos.apretadosDe(r).length), n: r => datos.apretadosDe(r).length, mejor: 'min' },
  { k: 'Días con dos ciudades', v: r => String(datos.diasConDosCiudades(r).length), n: r => datos.diasConDosCiudades(r).length, mejor: 'min' },
  { k: 'Noches sin cambiar de base', v: r => `${datos.nochesEnBaseLarga(r)} de 11`, n: r => datos.nochesEnBaseLarga(r), mejor: 'max' },
  { k: 'Noches en Roma (Bracciano)', v: r => String(nochesEn(r, 'Bracciano')), n: r => nochesEn(r, 'Bracciano'), mejor: 'max' },
  { k: 'Noches en Florencia', v: r => String(nochesEn(r, 'Florencia')), n: r => nochesEn(r, 'Florencia'), mejor: 'max' },
  { k: 'Noches en Cinque Terre', v: r => String(nochesEn(r, 'Spezia')), n: r => nochesEn(r, 'Spezia'), mejor: 'max' },
  { k: 'Noches en Saturnia', v: r => String(nochesEn(r, 'Saturnia')), n: r => nochesEn(r, 'Saturnia'), mejor: 'max' },
  { k: 'Palio de Siena', v: r => (pasaPor(r, 'Palio') ? 'Sí' : 'No'), n: r => (pasaPor(r, 'Palio') ? 1 : 0), mejor: null },
  { k: 'Pueblos toscanos', v: r => (pasaPor(r, 'Gimignano') ? 'Sí' : 'No'), n: r => (pasaPor(r, 'Gimignano') ? 1 : 0), mejor: null },
  { k: 'Emilia (Parma, Módena, Bolonia)', v: r => (pasaPor(r, 'Bolonia') ? 'Sí' : 'No'), n: r => (pasaPor(r, 'Bolonia') ? 1 : 0), mejor: null },
  { k: 'Umbría (Asís)', v: r => (pasaPor(r, 'Asís') ? 'Sí' : 'No'), n: r => (pasaPor(r, 'Asís') ? 1 : 0), mejor: null },
  { k: 'Playa', v: r => (pasaPor(r, 'Castiglione') ? 'Sí' : 'Monterosso'), n: r => (pasaPor(r, 'Castiglione') ? 1 : 0), mejor: null }
];

export function pintar(main) {
  const rutas = datos.RUTAS.rutas;

  main.innerHTML = `
    <p class="intro">Las tres llevan a Roma, Florencia, Cinque Terre y Saturnia con días enteros,
    y las tres cuestan casi lo mismo, porque dormir es gratis en casi todas las noches. Lo que
    de verdad cambia entre ellas no es el dinero: es el tiempo y lo cansado que acabas.</p>

    ${tarjetas(rutas)}
    <h2 class="seccion">Fila a fila</h2>
    ${tabla(rutas)}
    ${decidir(rutas)}
    ${galeria(rutas)}
  `;

  main.querySelectorAll('[data-ver]').forEach(b => {
    b.addEventListener('click', () => ir('rutas', new URLSearchParams({ r: b.dataset.ver })));
  });
}

function tarjetas(rutas) {
  const maxKm = Math.max(...rutas.map(r => r.km));
  const maxMin = Math.max(...rutas.map(r => r.minutos_volante));
  const maxEur = Math.max(...rutas.map(r => r.coste_estimado));

  return `<div class="vs">${rutas.map(r => `
    <div class="tarjeta vs-r" style="--barra:${esc(r.color)}">
      <div class="tarjeta-c">
        <h3>${r.numero}. ${esc(r.nombre)}</h3>
        <p class="lema">${esc(r.lema)}</p>
        <div class="barras">
          ${barra('Kilómetros', numero(r.km), r.km / maxKm)}
          ${barra('Al volante', minutosAHoras(r.minutos_volante), r.minutos_volante / maxMin)}
          ${barra('Coste', euros(r.coste_estimado), r.coste_estimado / maxEur)}
        </div>
        <p style="font-size:14px">${esc(r.resumen)}</p>
        <button type="button" class="etiq etiq-gris" data-ver="${esc(r.id)}"
                style="cursor:pointer;min-height:36px;padding:8px 12px;font-size:13px">
          Ver los doce días →
        </button>
      </div>
    </div>`).join('')}</div>`;
}

function barra(et, valor, fraccion) {
  return `<div class="barra-fila">
    <span class="et"><span>${esc(et)}</span><span>${esc(valor)}</span></span>
    <span class="barra-pista"><span class="barra-val" style="width:${Math.round(fraccion * 100)}%"></span></span>
  </div>`;
}

function tabla(rutas) {
  return `<div class="scroll-x"><table>
    <caption class="peq" style="text-align:left;padding:9px 11px">
      En verde, la mejor de las tres en cada fila.</caption>
    <thead><tr><th scope="col">&nbsp;</th>${rutas.map(r =>
      `<th scope="col"><span class="leyenda-ruta" style="--barra:${esc(r.color)}">
        <i></i>${r.numero}. ${esc(r.nombre)}</span></th>`).join('')}</tr></thead>
    <tbody>${FILAS.map(f => {
      const nums = rutas.map(f.n);
      const objetivo = f.mejor === 'min' ? Math.min(...nums) : f.mejor === 'max' ? Math.max(...nums) : null;
      const empate = objetivo !== null && nums.filter(n => n === objetivo).length === rutas.length;
      return `<tr><th scope="row">${esc(f.k)}</th>${rutas.map((r, i) =>
        `<td class="num${!empate && nums[i] === objetivo ? ' gana' : ''}">${esc(f.v(r))}</td>`).join('')}</tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

/** La comparación en fotos. Se parte en dos: lo que sale en las tres (que no ayuda
 *  a decidir, pero es el suelo que tienes garantizado) y lo que solo tiene cada una,
 *  que es exactamente lo que estás eligiendo. */
function galeria(rutas) {
  if (!hayFotos()) return '';

  const todos = datos.LUGARES.lugares;
  const comunes = todos.filter(l => l.rutas.length === rutas.length);
  const propios = new Map(rutas.map(r => [r.id, todos.filter(l =>
    l.rutas.includes(r.id) && l.rutas.length < rutas.length)]));

  return `
  <h2 class="seccion">Lo que solo ve cada ruta</h2>
  <p class="intro">Aquí está la decisión en fotos: estos sitios no salen en las tres.
  Lo que elijas es esto.</p>
  <div class="vs">${rutas.map(r => `
    <div class="tarjeta vs-r" style="--barra:${esc(r.color)}">
      <div class="cab-tarjeta">
        <h3>${r.numero}. ${esc(r.nombre)}</h3>
        <span class="etiq etiq-gris">${propios.get(r.id).length} sitios propios</span>
      </div>
      <div class="rejilla">${propios.get(r.id).map(l => tarjetaLugar(l)).join('')}</div>
    </div>`).join('')}
  </div>

  <h2 class="seccion">Lo que ves vayas por donde vayas</h2>
  <p class="intro">${comunes.length} sitios que salen en las tres rutas: Roma, Florencia,
  Cinque Terre y Saturnia con días enteros. Esto no se negocia.</p>
  <div class="tarjeta"><div class="rejilla">
    ${comunes.map(l => tarjetaLugar(l)).join('')}
  </div></div>

  ${creditos()}`;
}

function tarjetaLugar(l) {
  const tipo = datos.LUGARES.tipos[l.tipo];
  const f = figura(l.id, { alto: 110, pie: l.nombre });
  return `<div class="lugar-mini" style="--c:${esc(tipo.color)}">
    ${f || '<div class="foto foto-falta" style="--alto:110px" aria-hidden="true"></div>'}
    <span class="lugar-tipo">${esc(tipo.icono)} ${esc(tipo.nombre)}${l.precio ? ' · ' + esc(l.precio) : ''}</span>
  </div>`;
}

function decidir(rutas) {
  const [r1, r2, r3] = rutas;
  return `
  <h2 class="seccion">Cómo elegir</h2>
  <div class="tarjeta"><div class="tarjeta-c">
    <p><b style="color:var(--verde-txt)">Si no lo tienes claro, la ${r1.numero}.</b>
    Es la que reparte mejor: cabe el Palio, cabe la Toscana de los pueblos, y aun así deja
    tres noches en Florencia y tres en Cinque Terre. No destaca en nada y no falla en nada.</p>

    <p><b style="color:var(--azul-txt)">La ${r2.numero} si vas justo de energía o de ganas de conducir.</b>
    Nunca hace dos ciudades el mismo día, te da un segundo día entero de Roma y dos noches en
    las termas. Es la que aguanta que llueva, que duermas mal o que un día no te apetezca nada.</p>

    <p><b style="color:var(--rojo-txt)">La ${r3.numero} si lo que te llevas de un viaje es haber comido.</b>
    Es la única que sube a Emilia-Romaña, que es donde están el jamón de Parma, el Parmigiano de
    36 meses, el balsámico y los tortellini. Se paga con 180 km más y con un día menos de
    Florencia y dos menos de Cinque Terre.</p>

    <div class="caja caja-ojo" style="margin-top:14px">
      <b class="caja-t">Lo que ninguna arregla</b>
      Cinque Terre y Saturnia están en los dos extremos de la costa tirrena. Cualquier ruta que
      quiera las dos paga una vez un día de más de 300 km. Aparece en las tres y no hay forma
      de esquivarlo: solo se puede elegir qué día cae y si duermes al llegar.
    </div>
  </div></div>`;
}
