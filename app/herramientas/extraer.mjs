// Extrae de los ficheros de referencia:
//   1. Leaflet 1.9.4 (CSS + JS) -> app/vendor/
//   2. Las franjas horarias de la guia (secciones .day) -> app/datos/franjas.json
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = 'C:/Users/Javier/Desktop/italianweb';
const REF = path.join(RAIZ, 'viaje-italia-2026-paquete_1/brief/referencia');
const APP = path.join(RAIZ, 'app');

fs.mkdirSync(path.join(APP, 'vendor'), { recursive: true });
fs.mkdirSync(path.join(APP, 'datos'), { recursive: true });

// ---------- 1. Leaflet ----------
const mapa = fs.readFileSync(path.join(REF, 'Italia-agosto-2026-mapa.html'), 'utf8');
const css = mapa.slice(mapa.indexOf('<style>') + 7, mapa.indexOf('</style>'));
const js = mapa.slice(mapa.indexOf('<script>') + 8, mapa.indexOf('</script>'));
if (!/leaflet-container/.test(css)) throw new Error('CSS de Leaflet no reconocido');
if (!/Leaflet 1\.9\.4/.test(js)) throw new Error('JS de Leaflet no reconocido');
fs.writeFileSync(path.join(APP, 'vendor/leaflet.css'), css.trim() + '\n');
fs.writeFileSync(path.join(APP, 'vendor/leaflet.js'), js.trim() + '\n');
console.log('leaflet.css', css.length, 'bytes · leaflet.js', js.length, 'bytes');

// ---------- 2. Franjas horarias ----------
const guia = fs.readFileSync(path.join(REF, 'Italia-agosto-2026-guia.html'), 'utf8');

const secciones = [...guia.matchAll(/<section class="day">([\s\S]*?)<\/section>/g)].map(m => m[1]);
console.log('secciones .day encontradas:', secciones.length);

// Las pildoras de la guia aparecen como <span class="pill x"> y como <b class="pill x">.
// Se sacan a marcadores propios antes de tirar los atributos, y se reinyectan al final.
const ETIQUETAS_OK = 'b|i|small|br|p|ul|ol|li|table|thead|tbody|tr|th|td|h3|h4';

const limpiarBien = (html) => {
  let h = html
    .replace(/<(?:span|b) class="pill free">([\s\S]*?)<\/(?:span|b)>/g, '‹GRATIS:$1›')
    .replace(/<(?:span|b) class="pill pay">([\s\S]*?)<\/(?:span|b)>/g, '‹PAGO:$1›')
    .replace(/<(?:span|b) class="pill tip">([\s\S]*?)<\/(?:span|b)>/g, '‹AVISO:$1›')
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, '‹URL:$1|$2›')
    .replace(/<div class="box">/g, '‹CAJA›').replace(/<div class="t">([\s\S]*?)<\/div>/g, '‹CAJAT:$1›')
    .replace(/<\/?(?:div|section|header|span)[^>]*>/g, '')
    .replace(new RegExp(`<(?!\\/?(?:${ETIQUETAS_OK})\\b)[^>]*>`, 'g'), '')
    // El lookahead evita que la alternancia case la "b" de "<br>" y lo destroce.
    .replace(new RegExp(`<(${ETIQUETAS_OK})(?=[\\s>/])[^>]*>`, 'g'), '<$1>');
  h = h
    .replace(/‹GRATIS:([\s\S]*?)›/g, '<em class="p-free">$1</em>')
    .replace(/‹PAGO:([\s\S]*?)›/g, '<em class="p-pay">$1</em>')
    .replace(/‹AVISO:([\s\S]*?)›/g, '<em class="p-tip">$1</em>')
    .replace(/‹URL:([^|]*)\|([\s\S]*?)›/g, '<a href="$1" target="_blank" rel="noopener">$2</a>')
    .replace(/‹CAJAT:([\s\S]*?)›/g, '<b class="caja-t">$1</b>')
    .replace(/‹CAJA›/g, '');
  return h.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
};

const texto = (h) => h.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const dias = secciones.map((sec, i) => {
  const cab = sec.match(/<header>([\s\S]*?)<\/header>/);
  const spans = cab ? [...cab[1].matchAll(/<span class="(d|h|km)">([\s\S]*?)<\/span>/g)] : [];
  const cabecera = Object.fromEntries(spans.map(s => [s[1], texto(s[2])]));

  const franjas = [...sec.matchAll(
    /<div class="slot">\s*<div class="when">([\s\S]*?)<\/div>\s*<div>([\s\S]*?)<\/div>\s*<\/div>/g
  )].map(m => {
    const when = m[1];
    const hora = texto(when.replace(/<span>[\s\S]*?<\/span>/, ''));
    const etiq = texto((when.match(/<span>([\s\S]*?)<\/span>/) || [, ''])[1]);
    return { hora, etiqueta: etiq, html: limpiarBien(m[2]) };
  });

  const sleep = sec.match(/<div class="sleep">([\s\S]*?)(?=<div class="cost">|<\/div>\s*<\/div>\s*$)/);
  const cost = sec.match(/<div class="cost">([\s\S]*?)<\/div>/);

  return {
    dia: i,
    cabecera_dia: cabecera.d || '',
    cabecera_titulo: cabecera.h || '',
    cabecera_km: cabecera.km || '',
    franjas,
    dormir_html: sleep ? limpiarBien(sleep[1]) : '',
    coste_html: cost ? limpiarBien(cost[1]) : ''
  };
});

const sinFranjas = dias.filter(d => d.franjas.length === 0);
console.log('dias sin franjas:', sinFranjas.map(d => d.dia).join(',') || 'ninguno');
console.log('franjas por dia:', dias.map(d => `${d.dia}:${d.franjas.length}`).join(' '));

fs.writeFileSync(path.join(APP, 'datos/franjas.json'), JSON.stringify(dias, null, 1), 'utf8');

// ---------- 3. Fichas de referencia (secciones <h2> de la guia) ----------
// Sólo las que aportan texto que NO está en datos-viaje.json. Las demás
// (ruta, presupuesto, eventos, reservas, equipaje) se leen del JSON.
const QUIERO = {
  dormir:     'Dormir en el coche',
  aparcar:    'Aparcar, ZTL y abonos',
  conducir:   'Conducir en Italia',
  comer:      'Comer barato',
  tours:      'Tours y audioguías',
  naturaleza: 'Playas, termas y senderos',
  riesgos:    'Riesgos y estafas',
  apps:       'Apps, webs y teléfonos'
};

const trozos = [...guia.matchAll(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)];
const fichas = [];
trozos.forEach((m, i) => {
  const id = m[1];
  if (!QUIERO[id]) return;
  const desde = m.index + m[0].length;
  const hasta = i + 1 < trozos.length ? trozos[i + 1].index : guia.indexOf('<hr style="margin:50px');
  fichas.push({ id, titulo: QUIERO[id], html: limpiarBien(guia.slice(desde, hasta)) });
});
console.log('fichas:', fichas.map(f => `${f.id}(${Math.round(f.html.length / 1024)}k)`).join(' '));
fs.writeFileSync(path.join(APP, 'datos/fichas.json'), JSON.stringify(fichas, null, 1), 'utf8');

// ---------- 4. Comer: la tabla "Qué probar en cada región" ----------
// El viajero quiere comer lo típico de cada zona, así que esto pasa de ser
// prosa dentro de una ficha a datos con los que montar un plan por días.
const bloqueComer = guia.slice(
  guia.indexOf('<h3>Qué probar en cada región'),
  guia.indexOf('<h3>Los ocho trucos')
);

const regiones = [...bloqueComer.matchAll(/<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td class="n">([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g)]
  .map(m => {
    const region = texto((m[1].match(/<b>([\s\S]*?)<\/b>/) || [, ''])[1]);
    const zonas = texto((m[1].match(/<small>([\s\S]*?)<\/small>/) || [, ''])[1])
      .split(/,\s*/).map(s => s.trim()).filter(Boolean);
    // Lo que la guía pone en negrita es lo que define a la región.
    const platos = m[2].split('·').map(t => ({
      nombre: texto(t).replace(/^[\s·]+|[\s·]+$/g, ''),
      destacado: /<b>/.test(t)
    })).filter(p => p.nombre);
    return {
      region, zonas, platos,
      precios: texto(m[3].replace(/<br>/g, ' · ')),
      donde_html: limpiarBien(m[4])
    };
  });

console.log('regiones de comida:', regiones.map(r => `${r.region}(${r.platos.length} platos, ${r.platos.filter(p => p.destacado).length} destacados)`).join(' '));
if (regiones.length !== 6) throw new Error('Se esperaban 6 regiones y salieron ' + regiones.length);
fs.writeFileSync(path.join(APP, 'datos/comer.json'), JSON.stringify(regiones, null, 1), 'utf8');

// ---------- 5. Acceso a cada ciudad: dónde dejar el coche y cómo entrar ----------
const bloqueAcceso = guia.slice(
  guia.indexOf('<h3>La regla: dónde el coche se queda fuera'),
  guia.indexOf('<h3>Cuatro reglas prácticas')
);

const tablasAcceso = [...bloqueAcceso.matchAll(/<table>([\s\S]*?)<\/table>/g)].map(m => m[1]);
const acceso = [];
tablasAcceso.forEach((tabla, i) => {
  const nivel = i === 0 ? 'obligatorio' : 'cerca';
  for (const f of tabla.matchAll(/<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td class="n">([\s\S]*?)<\/td>\s*<\/tr>/g)) {
    const ciudad = texto((f[1].match(/<b>([\s\S]*?)<\/b>/) || [, ''])[1]);
    if (!ciudad) continue;
    const como = texto(f[2]);
    // Minutos que la propia guía menciona; si no dice nada, se deja en null y
    // la app avisa de que no hay dato en vez de inventarse uno.
    const mins = [...como.matchAll(/(\d+)(?:\s*-\s*(\d+))?\s*min/g)].map(x => +(x[2] || x[1]));
    acceso.push({
      ciudad, nivel,
      motivo: texto(f[1]).replace(ciudad, '').replace(/^[\s—–-]+/, ''),
      como_html: limpiarBien(f[2]),
      como_texto: como,
      coste: texto(f[3]),
      minutos: mins.length ? Math.max(...mins) : null
    });
  }
});
console.log('acceso a ciudades:', acceso.length, '·', acceso.map(a => `${a.ciudad}${a.minutos ? '(' + a.minutos + 'min)' : ''}`).join(' '));
if (acceso.length < 14) throw new Error('Faltan filas en las tablas de aparcamiento');
fs.writeFileSync(path.join(APP, 'datos/acceso.json'), JSON.stringify(acceso, null, 1), 'utf8');

// ---------- 6. Las tres rutas comparadas ----------
const bloqueRutas = guia.slice(
  guia.indexOf('<h2 id="ruta">'),
  guia.indexOf('<h2 id="mapa">')
);

const rutas = [...bloqueRutas.matchAll(
  /<tr>\s*<td>([\s\S]*?)<\/td>\s*<td class="n">([\s\S]*?)<\/td>\s*<td class="n">([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g
)].map(m => {
  const titulo = texto((m[1].match(/<b>([\s\S]*?)<\/b>/) || [, ''])[1]);
  return {
    letra: titulo.split('·')[0].trim(),
    nombre: titulo.split('·').slice(1).join('·').trim() || titulo,
    trazado: texto((m[1].match(/<small>([\s\S]*?)<\/small>/) || [, ''])[1]),
    km: parseInt(texto(m[2]).replace(/\./g, ''), 10),
    coste: texto(m[3]),
    ve_html: limpiarBien(m[4]),
    veredicto_html: limpiarBien(m[5]),
    elegida: /ELEGIDA/i.test(texto(m[5])),
    descartada: /Descartada/i.test(texto(m[5]))
  };
});

// Los párrafos de razonamiento que hay bajo la tabla
const parrafos = [...bloqueRutas.matchAll(/<p>([\s\S]*?)<\/p>/g)]
  .map(m => limpiarBien(m[1]))
  .filter(h => /Por qué la A|Cuándo elegiría la B/.test(h));
// La caja llega hasta el final del bloque; su </div> de cierre no es
// adyacente al del título, así que no vale un match perezoso.
const iCaja = bloqueRutas.indexOf('<div class="box">');
const caja = iCaja >= 0 ? [, bloqueRutas.slice(iCaja + 17).replace(/<\/div>\s*$/, '')] : null;

const salidaRutas = {
  rutas,
  razonamiento: parrafos,
  decision_html: caja ? limpiarBien(caja[1]) : '',
  intro: texto((bloqueRutas.match(/<p>([\s\S]*?)<\/p>/) || [, ''])[1])
};

console.log('rutas:', rutas.map(r => `${r.letra} ${r.km}km ${r.coste}${r.elegida ? ' ELEGIDA' : ''}${r.descartada ? ' descartada' : ''}`).join(' · '));
if (rutas.length !== 3) throw new Error('Se esperaban 3 rutas y salieron ' + rutas.length);
fs.writeFileSync(path.join(APP, 'datos/rutas.json'), JSON.stringify(salidaRutas, null, 1), 'utf8');

// ---------- 7. datos-viaje.json ----------
fs.copyFileSync(path.join(RAIZ, 'datos-viaje.json'), path.join(APP, 'datos/datos-viaje.json'));
console.log('datos-viaje.json copiado');
