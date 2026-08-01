// Las cuatro rutas, cara a cara.

import * as datos from '../datos.js';
import { esc, minutosAHoras, numero, euros } from '../util.js';
import { figura, creditos, hayFotos } from '../fotos.js';
import { marca, leyenda } from '../marcas.js';
import { ir } from '../app.js';

/** Noches en las bases cuyo nombre contiene un texto. */
function nochesEn(ruta, texto) {
  return ruta.bases
    .filter(b => b.sitio.toLowerCase().includes(texto.toLowerCase()))
    .reduce((t, b) => t + b.noches, 0);
}

/** Cuántos lugares de un tipo toca la ruta. */
function cuantos(ruta, tipo) {
  return datos.lugaresDe(ruta.id).filter(l => l.tipo === tipo).length;
}

/** ¿La ruta pasa por un sitio concreto? */
const tiene = (ruta, id) => datos.lugaresDe(ruta.id).some(l => l.id === id);
const si = b => (b ? 'Sí' : '—');

const FILAS = [
  { k: 'Kilómetros', v: r => numero(r.km), n: r => r.km, mejor: 'min' },
  { k: 'Al volante', v: r => minutosAHoras(r.minutos_volante), n: r => r.minutos_volante, mejor: 'min' },
  { k: 'Coste estimado', v: r => euros(r.coste_estimado), n: r => r.coste_estimado, mejor: 'min' },
  { k: 'Día más largo', v: r => `${datos.diaMasLargo(r).km} km`, n: r => datos.diaMasLargo(r).km, mejor: 'min' },
  { k: 'Días apretados', v: r => String(datos.apretadosDe(r).length), n: r => datos.apretadosDe(r).length, mejor: 'min' },
  { k: 'Sitios que solo ves aquí', v: r => String(datos.exclusivosDe(r.id).length), n: r => datos.exclusivosDe(r.id).length, mejor: 'max' },
  { k: 'Noches en Florencia', v: r => String(nochesEn(r, 'Florencia')), n: r => nochesEn(r, 'Florencia'), mejor: 'max' },
  { k: 'Noches en Cinque Terre', v: r => String(nochesEn(r, 'Spezia')), n: r => nochesEn(r, 'Spezia'), mejor: 'max' },
  { k: 'Termas naturales gratis', v: r => String(cuantos(r, 'termas')), n: r => cuantos(r, 'termas'), mejor: 'max' },
  { k: 'Playas', v: r => String(cuantos(r, 'playa')), n: r => cuantos(r, 'playa'), mejor: 'max' },
  { k: 'Siena y los pueblos de torres', v: r => si(tiene(r, 'san-gimignano')), n: r => (tiene(r, 'san-gimignano') ? 1 : 0), mejor: null },
  { k: 'Pisa', v: r => si(tiene(r, 'pisa')), n: r => (tiene(r, 'pisa') ? 1 : 0), mejor: null },
  { k: 'Emilia: Parma, Módena, Bolonia', v: r => si(tiene(r, 'bolonia')), n: r => (tiene(r, 'bolonia') ? 1 : 0), mejor: null },
  { k: 'Umbría y Asís', v: r => si(tiene(r, 'asis')), n: r => (tiene(r, 'asis') ? 1 : 0), mejor: null },
  { k: 'Etruscos y pueblos de toba', v: r => si(tiene(r, 'civita-bagnoregio')), n: r => (tiene(r, 'civita-bagnoregio') ? 1 : 0), mejor: null }
];

export function pintar(main) {
  const rutas = datos.RUTAS.rutas;

  main.innerHTML = `
    <p class="intro">Las cuatro llevan a Florencia, Cinque Terre, Saturnia y Roma con días
    enteros, y las cuatro acaban igual: Roma los días 23, 24 y 25. Lo que de verdad cambia
    entre ellas no es el dinero —se llevan 66 € de la más barata a la más cara— sino qué
    Italia ves y lo cansado que acabas.</p>

    ${tarjetas(rutas)}
    <h2 class="seccion">Fila a fila</h2>
    ${tabla(rutas)}
    ${decidir(rutas)}
    ${galeria(rutas)}
  `;

  main.querySelectorAll('[data-ver]').forEach(b => {
    b.addEventListener('click', () => ir('rutas', new URLSearchParams({ v: 'una', r: b.dataset.ver })));
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
      En verde, la mejor de las cuatro en cada fila.</caption>
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

/** La comparación en fotos, partida en dos: lo que solo tiene cada ruta —que es
 *  justo lo que estás eligiendo— y lo que sale en las cuatro. */
function galeria(rutas) {
  if (!hayFotos()) return '';

  const comunes = datos.LUGARES.lugares.filter(l => l.rutas.length === rutas.length);

  return `
  <h2 class="seccion">Lo que solo ve cada ruta</h2>
  <p class="intro">Aquí está la decisión en fotos: estos sitios no salen en las cuatro.
  Lo que elijas es esto.</p>
  ${leyenda()}
  <div class="vs">${rutas.map(r => {
    const propios = datos.propiosDe(r.id);
    const solos = datos.exclusivosDe(r.id).length;
    return `
    <div class="tarjeta vs-r" style="--barra:${esc(r.color)}">
      <div class="cab-tarjeta">
        <h3>${r.numero}. ${esc(r.nombre)}</h3>
        <span class="marca marca-solo" style="--m:${esc(r.color)}">
          <span class="marca-s" aria-hidden="true">★</span><span>${solos} solo aquí</span></span>
        <span class="etiq etiq-gris">${propios.length} propios</span>
      </div>
      <div class="rejilla">${propios.map(tarjetaLugar).join('')}</div>
    </div>`;
  }).join('')}
  </div>

  <h2 class="seccion">Lo que ves vayas por donde vayas</h2>
  <p class="intro">${comunes.length} sitios que salen en las cuatro rutas: Florencia,
  Cinque Terre, Saturnia y los tres días de Roma del final. Esto no se negocia.</p>
  <div class="tarjeta"><div class="rejilla">
    ${comunes.map(tarjetaLugar).join('')}
  </div></div>

  ${creditos()}`;
}

function tarjetaLugar(l) {
  const tipo = datos.LUGARES.tipos[l.tipo];
  const f = figura(l.id, { alto: 110, pie: l.nombre });
  return `<div class="lugar-mini" style="--c:${esc(tipo.color)}">
    ${f || '<div class="foto foto-falta" style="--alto:110px" aria-hidden="true"></div>'}
    <span class="lugar-tipo">${esc(tipo.icono)} ${esc(tipo.nombre)}${l.precio ? ' · ' + esc(l.precio) : ''}</span>
    ${marca(l, { largo: true })}
  </div>`;
}

function decidir(rutas) {
  const [r1, r2, r3, r4] = rutas;
  return `
  <h2 class="seccion">Cómo elegir</h2>
  <div class="tarjeta"><div class="tarjeta-c">
    <p><b style="color:${esc(r1.color)}">Si no lo tienes claro, la ${r1.numero}.</b>
    Es la que reparte mejor y la que menos kilómetros hace: cabe Siena, caben los pueblos de
    torres, cabe Pitigliano, y aun así deja dos días de Florencia, dos de Cinque Terre y
    Lucca con noche propia. No destaca en nada y no falla en nada.</p>

    <p><b style="color:${esc(r2.color)}">La ${r2.numero} si lo que te apetece es meterte en el agua.</b>
    Tres termas naturales gratis y abiertas las 24 horas en vez de una, la Val d'Orcia de por
    medio y dos tardes de playa. Es además la más barata de las cuatro. El precio: los pueblos
    de torres se quedan fuera enteros.</p>

    <p><b style="color:${esc(r3.color)}">La ${r3.numero} si lo que te llevas de un viaje es haber comido.</b>
    Es la única que sube a Emilia-Romaña, donde están el jamón de Parma, el Parmigiano de
    36 meses, el balsámico y los tortellini. Se paga con 300 km más que la ruta 1 y con la
    Toscana recortada.</p>

    <p><b style="color:${esc(r4.color)}">La ${r4.numero} si ya has visto lo de siempre o te aburre.</b>
    Pueblos enteros excavados en la toba, necrópolis etruscas, una ciudad que se cae por un
    precipicio y un bosque del XVI lleno de monstruos de piedra. Todo eso está a menos de dos
    horas del puerto y no lo pisa ninguna de las otras tres. El precio: 290 km el primer día,
    de un tirón, para quitarse el norte de encima.</p>

    <div class="caja caja-ojo" style="margin-top:14px">
      <b class="caja-t">Lo que ninguna arregla</b>
      Cinque Terre está en el extremo norte y el puerto en el sur. Cualquier ruta que quiera
      las dos cosas paga una vez un día de más de 200 km seguidos. Aparece en las cuatro y no
      hay forma de esquivarlo: solo se puede elegir qué día cae.
    </div>
  </div></div>`;
}
