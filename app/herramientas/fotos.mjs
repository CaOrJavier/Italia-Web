// Baja una foto por lugar de Wikimedia Commons, con su autor y su licencia.
//
//   node app/herramientas/fotos.mjs            (solo mira, no escribe)
//   node app/herramientas/fotos.mjs --escribir (baja las fotos y escribe el JSON)
//
// Por qué así y no eligiendo fotos a mano: cada imagen tiene que venir con autor,
// licencia y enlace al original, o no se puede publicar. Pidiéndoselo a la API de
// Wikipedia eso viene de serie y se puede volver a ejecutar si algo caduca.
//
// Solo se aceptan licencias libres. Las portadas de Wikipedia que son de uso
// legítimo (fair use) se descartan: no se pueden republicar.

import { mkdir, writeFile, readFile, rename, rm, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const AQUI = dirname(fileURLToPath(import.meta.url));
const APP = join(AQUI, '..');
const DESTINO = join(APP, 'imagenes');
// 760 px de ancho: da para verse bien en la rejilla de tres columnas del ordenador
// y en el móvil a doble densidad, sin que la página pese lo que no debe.
const ANCHO = 760;
const UA = 'italia-2026-web/1.0 (viaje personal; https://github.com/CaOrJavier/Italia-Web)';

// Candidatos por lugar, en orden de preferencia: [idioma, artículo].
// Se prueba uno por uno hasta que sale una foto con licencia libre.
const CANDIDATOS = {
  civitavecchia: [['it', 'Civitavecchia'], ['es', 'Civitavecchia']],
  tolfa: [['it', 'Tolfa'], ['es', 'Tolfa']],
  bracciano: [['es', 'Lago de Bracciano'], ['it', 'Lago di Bracciano']],

  coliseo: [['es', 'Coliseo'], ['it', 'Colosseo']],
  vaticano: [['es', 'Capilla Sixtina'], ['es', 'Museos Vaticanos'], ['it', 'Musei Vaticani']],
  panteon: [['es', 'Panteón de Agripa'], ['it', 'Pantheon (Roma)']],
  testaccio: [['it', 'Testaccio'], ['es', 'Testaccio']],
  trastevere: [['es', 'Trastevere'], ['it', 'Trastevere']],
  appia: [['es', 'Vía Apia'], ['it', 'Via Appia']],
  anagnina: [['it', 'Anagnina (metropolitana di Roma)'], ['it', 'Metropolitana di Roma']],
  cornelia: [['it', 'Cornelia (metropolitana di Roma)'], ['it', 'Metropolitana di Roma']],

  siena: [['es', 'Piazza del Campo'], ['it', 'Piazza del Campo'], ['es', 'Siena']],
  'siena-parking': [['es', 'Siena'], ['it', 'Siena']],
  monteriggioni: [['es', 'Monteriggioni'], ['it', 'Monteriggioni']],
  'san-gimignano': [['es', 'San Gimignano'], ['it', 'San Gimignano']],

  'villa-costanza': [['it', 'Linea 1 (tranvia di Firenze)'], ['it', 'Scandicci']],
  'florencia-duomo': [['es', 'Catedral de Santa María del Fiore'], ['it', 'Cattedrale di Santa Maria del Fiore']],
  'piazzale-michelangelo': [['it', 'Piazzale Michelangelo'], ['es', 'Piazzale Michelangelo']],
  'mercato-centrale': [['it', 'Mercato Centrale (Firenze)'], ['it', 'San Lorenzo (Firenze)']],
  santambrogio: [['it', "Mercato di Sant'Ambrogio"], ['it', 'Firenze']],

  lucca: [['es', 'Lucca'], ['it', 'Lucca']],
  pisa: [['es', 'Piazza dei Miracoli'], ['it', 'Piazza dei Miracoli'], ['es', 'Torre de Pisa']],

  'la-spezia': [['es', 'La Spezia'], ['it', 'La Spezia']],
  riomaggiore: [['es', 'Riomaggiore'], ['it', 'Riomaggiore']],
  manarola: [['es', 'Manarola'], ['it', 'Manarola']],
  corniglia: [['es', 'Corniglia'], ['it', 'Corniglia']],
  vernazza: [['es', 'Vernazza'], ['it', 'Vernazza']],
  monterosso: [['es', 'Monterosso al Mare'], ['it', 'Monterosso al Mare']],
  portovenere: [['es', 'Porto Venere'], ['it', 'Porto Venere']],

  bolgheri: [['it', 'Bolgheri']],
  castiglione: [['es', 'Castiglione della Pescaia'], ['it', 'Castiglione della Pescaia']],
  alberese: [['it', 'Parco naturale della Maremma'], ['es', 'Parque natural de la Maremma']],

  saturnia: [['it', 'Cascate del Mulino'], ['it', 'Saturnia'], ['es', 'Saturnia']],
  'saturnia-pueblo': [['it', 'Saturnia'], ['es', 'Saturnia']],
  pitigliano: [['es', 'Pitigliano'], ['it', 'Pitigliano']],
  sovana: [['it', 'Sovana'], ['es', 'Sovana']],

  parma: [['es', 'Parma'], ['it', 'Parma']],
  modena: [['es', 'Módena'], ['it', 'Modena']],
  bolonia: [['it', 'Piazza Maggiore'], ['es', 'Bolonia']],
  quadrilatero: [['it', 'Quadrilatero (Bologna)'], ['it', 'Bologna']],
  'bolonia-parking': [['es', 'Bolonia'], ['it', 'Bologna']],

  asis: [['es', 'Basílica de San Francisco de Asís'], ['it', "Basilica di San Francesco d'Assisi"], ['es', 'Asís']],
  carceri: [['it', 'Monte Subasio']],
  orvieto: [['es', 'Orvieto'], ['it', 'Orvieto']]
};

// Cuando la portada del artículo no vale (no existe, o ya la usa otro lugar), se
// busca directamente en Commons con estos términos. Sobre todo para los sitios que
// no tienen artículo propio: unas cascadas, un mercado, un aparcamiento.
const BUSQUEDA = {
  civitavecchia: 'Civitavecchia porto',
  tolfa: 'Tolfa Roma paese veduta',
  bracciano: 'Castello Orsini-Odescalchi Bracciano lago',
  appia: 'Via Appia Antica basolato',
  coliseo: 'Colosseo Roma esterno',
  quadrilatero: 'Quadrilatero Bologna mercato',
  modena: 'Duomo di Modena Ghirlandina',
  saturnia: 'Cascate del Mulino Saturnia',
  'saturnia-pueblo': 'Saturnia Grosseto borgo',
  'bolonia-parking': 'Bologna portici',
  santambrogio: "Mercato Sant'Ambrogio Firenze",
  'villa-costanza': 'Villa Costanza tramvia Firenze',
  'siena-parking': 'Porta Camollia Siena',
  testaccio: 'Mercato Testaccio Roma',
  'mercato-centrale': 'Mercato Centrale Firenze interno',
  alberese: 'Marina di Alberese spiaggia',
  bolgheri: 'Viale dei cipressi Bolgheri',
  castiglione: 'Castiglione della Pescaia spiaggia',
  cornelia: 'Cornelia stazione metropolitana Roma',
  carceri: 'Eremo delle Carceri Assisi'
};

/** Con --forzar se vuelven a bajar todas; si no, las que ya están se dejan como
 *  están y solo se rehace el JSON. Cada pasada son 90 llamadas a la API. */
const FORZAR = process.argv.includes('--forzar');

// Fotos elegidas a mano tras mirarlas una por una. Van aquí porque el automatismo
// se equivocaba de lleno: para Testaccio devolvía un solar en obras, para el Mercato
// Centrale el capitel de una columna y para el Eremo delle Carceri un árbol. Buscar
// por texto no distingue «foto del sitio» de «foto hecha en el sitio».
const FIJAS = {
  testaccio: 'Testaccio - il nuovo mercato 1280317.jpg',
  'mercato-centrale': 'Mercato centrale di san lorenzo 02.jpg',
  carceri: 'Eremo-delle-Carceri-Assisi.JPG',
  // La que devuelve la búsqueda por «Quadrilatero» es en realidad la Biblioteca
  // Salaborsa, que está al lado pero no es el mercado. Esta sí es la calle.
  quadrilatero: 'Bologna Via Pescherie Vecchie.jpg'
};

/** La portada de los artículos de pueblos italianos suele ser la bandera o el escudo
 *  del municipio, y la de las vías romanas, un mapa. Nada de eso es una foto del
 *  sitio, así que se descarta por el nombre del fichero. */
// Ojo con el guion bajo: en los nombres de Commons hace de espacio, pero para una
// expresión regular es un carácter de palabra, así que \bmap\b NO casa en
// "Via_Appia_map.jpg". Hay que listar los separadores a mano.
const SEP = '[_ .()-]';
const NO_ES_FOTO = new RegExp(
  `(\\.svg$)|flag|bandiera|stemma|coat${SEP}of${SEP}arms|logo|relief|location|collage|diagram`
  + `|(^|${SEP})(mapp?a?s?|carta|plan|schema)(${SEP}|$)`, 'i');

const pareceFoto = f => /\.(jpe?g|png)$/i.test(f) && !NO_ES_FOTO.test(f);

/** Licencias que sí se pueden republicar. Todo lo demás se descarta. */
function esLibre(licencia) {
  if (!licencia) return false;
  const l = licencia.toLowerCase();
  if (l.includes('fair use') || l.includes('non-free') || l.includes('uso legítimo')) return false;
  return l.startsWith('cc') || l.includes('public domain') || l.startsWith('pd') || l.includes('cc0');
}

const limpia = s => (s || '')
  .replace(/<[^>]*>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/\s+/g, ' ')
  .trim();

/** El campo Artist de Commons es texto libre: unos ponen su nombre y otros pegan
 *  medio párrafo de condiciones. Para el crédito al pie hace falta solo el nombre. */
function autorCorto(bruto) {
  let a = limpia(bruto);
  if (!a) return 'Wikimedia Commons';

  const patrones = [
    /photo (?:was )?taken by ([^.,;]{2,60})/i,
    /No machine-readable author provided\.\s*([^\s]{2,40}) assumed/i,
    /^([^.,;(]{2,60})/
  ];
  for (const p of patrones) {
    const m = a.match(p);
    if (m && m[1].trim()) { a = m[1].trim(); break; }
  }
  a = a.replace(/\s+at\s+(the\s+)?(english|italian|spanish|german)\s+wikipedia$/i, '')
       .replace(/[\s.,;:_-]+$/, '');
  return a.length > 60 ? a.slice(0, 57).trimEnd() + '…' : (a || 'Wikimedia Commons');
}

async function api(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
  if (!r.ok) throw new Error(`${r.status} en ${url}`);
  return r.json();
}

/** Foto de portada de un artículo de Wikipedia, ya recortada al ancho que queremos. */
async function portada(lang, titulo) {
  const u = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2`
    + `&prop=pageimages&piprop=thumbnail%7Cname&pithumbsize=${ANCHO}&redirects=1`
    + `&titles=${encodeURIComponent(titulo)}`;
  const d = await api(u);
  const p = d?.query?.pages?.[0];
  if (!p || p.missing || !p.thumbnail || !p.pageimage) return null;
  if (!pareceFoto(p.pageimage)) return null;
  return { url: p.thumbnail.source, fichero: p.pageimage, articulo: p.title, lang };
}

/** Busca fotos en Commons por texto. Devuelve varias, para poder saltar duplicados. */
async function buscaEnCommons(termino) {
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2'
    + '&generator=search&gsrnamespace=6&gsrlimit=8'
    + `&gsrsearch=${encodeURIComponent(termino)}`
    + `&prop=imageinfo&iiprop=extmetadata%7Curl&iiurlwidth=${ANCHO}`;
  const d = await api(u);
  const paginas = d?.query?.pages || [];
  return paginas
    .filter(p => pareceFoto(p.title.replace(/^File:/, '')))
    .map(p => {
      const info = p.imageinfo?.[0];
      if (!info) return null;
      const m = info.extmetadata || {};
      return {
        url: info.thumburl || info.url,
        fichero: p.title.replace(/^File:/, ''),
        articulo: p.title,
        lang: 'commons',
        autor: autorCorto(m.Artist?.value),
        licencia: limpia(m.LicenseShortName?.value),
        licencia_url: limpia(m.LicenseUrl?.value),
        origen: info.descriptionurl
      };
    })
    .filter(Boolean);
}

/** Un fichero concreto de Commons, por nombre. Para las fotos elegidas a mano. */
async function porFichero(nombre) {
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2'
    + `&prop=imageinfo&iiprop=extmetadata%7Curl&iiurlwidth=${ANCHO}`
    + `&titles=${encodeURIComponent('File:' + nombre)}`;
  const d = await api(u);
  const p = d?.query?.pages?.[0];
  const info = p?.imageinfo?.[0];
  if (!info || p.missing) return null;
  const m = info.extmetadata || {};
  return {
    url: info.thumburl || info.url,
    fichero: nombre,
    articulo: 'File:' + nombre,
    lang: 'commons',
    autor: autorCorto(m.Artist?.value),
    licencia: limpia(m.LicenseShortName?.value),
    licencia_url: limpia(m.LicenseUrl?.value),
    origen: info.descriptionurl
  };
}

/** Autor, licencia y enlace al original, desde Commons. */
async function ficha(fichero) {
  const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2'
    + '&prop=imageinfo&iiprop=extmetadata%7Curl'
    + `&titles=${encodeURIComponent('File:' + fichero)}`;
  const d = await api(u);
  const info = d?.query?.pages?.[0]?.imageinfo?.[0];
  if (!info) return null;
  const m = info.extmetadata || {};
  return {
    autor: autorCorto(m.Artist?.value),
    licencia: limpia(m.LicenseShortName?.value),
    licencia_url: limpia(m.LicenseUrl?.value),
    origen: info.descriptionurl
  };
}

/** Baja la foto y la deja en JPEG de ANCHO px y calidad 70. Sin recomprimir son
 *  9,5 MB para 44 fotos, que en el móvil y con datos italianos es una barbaridad;
 *  recomprimidas bajan a un tercio y a este tamaño no se nota. */
async function baja(url, destino) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} bajando ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());

  const bruto = destino + '.bruto';
  await writeFile(bruto, buf);
  try {
    await ejecuta('magick', [bruto, '-resize', `${ANCHO}x>`, '-strip',
      '-interlace', 'Plane', '-quality', '70', destino]);
    await rm(bruto, { force: true });
  } catch {
    // Sin ImageMagick se queda el original: pesa más, pero la web funciona igual.
    await rename(bruto, destino);
  }
  return (await stat(destino)).size;
}

function ejecuta(cmd, args) {
  return new Promise((ok, mal) => {
    const p = spawn(cmd, args, { stdio: 'ignore', shell: process.platform === 'win32' });
    p.on('error', mal);
    p.on('close', c => (c === 0 ? ok() : mal(new Error(`${cmd} salió con ${c}`))));
  });
}

const espera = ms => new Promise(r => setTimeout(r, ms));

/** node fotos.mjs --buscar "termino"  → lista candidatos para elegir a mano.
 *  Hace falta porque la primera foto que devuelve Commons a veces es un solar en
 *  obras o el capitel de una columna: hay que mirarlas. */
async function soloBuscar(termino) {
  const cands = await buscaEnCommons(termino);
  cands.filter(c => esLibre(c.licencia)).forEach((c, i) =>
    console.log(`${i}. ${c.fichero}\n   ${c.licencia} · ${c.autor}\n   ${c.url}`));
  if (!cands.length) console.log('Nada.');
}

async function main() {
  const iBuscar = process.argv.indexOf('--buscar');
  if (iBuscar !== -1) return soloBuscar(process.argv[iBuscar + 1]);

  const escribir = process.argv.includes('--escribir');
  const lugares = JSON.parse(await readFile(join(APP, 'datos', 'lugares.json'), 'utf8')).lugares;

  if (escribir) await mkdir(DESTINO, { recursive: true });

  const salida = [];
  const fallos = [];
  const usadas = new Set();   // ninguna foto se repite en dos lugares distintos
  let bytes = 0;

  for (const lugar of lugares) {
    let hecho = null;

    // 0. La elegida a mano, si la hay, manda sobre todo lo demás.
    if (FIJAS[lugar.id]) {
      hecho = await porFichero(FIJAS[lugar.id]).catch(() => null);
      if (hecho && !esLibre(hecho.licencia)) hecho = null;
      await espera(120);
    }

    // 1. La búsqueda dirigida, cuando la hay: suele dar la foto del sitio exacto
    //    y no la de la ciudad entera. Solo si el paso 0 no ha resuelto ya.
    const buscar = !hecho && BUSQUEDA[lugar.id]
      ? await buscaEnCommons(BUSQUEDA[lugar.id]).catch(() => [])
      : [];
    for (const c of buscar) {
      if (usadas.has(c.fichero) || !esLibre(c.licencia) || !c.url) continue;
      hecho = c;
      break;
    }
    await espera(120);

    // 2. Si no, la portada del artículo de Wikipedia.
    for (const [lang, titulo] of hecho ? [] : (CANDIDATOS[lugar.id] || [])) { // eslint-disable-line
      let p;
      try { p = await portada(lang, titulo); } catch (e) { console.error(`  ! ${titulo}: ${e.message}`); continue; }
      await espera(120);
      if (!p || usadas.has(p.fichero)) continue;

      const f = await ficha(p.fichero).catch(() => null);
      await espera(120);
      if (!f || !esLibre(f.licencia)) {
        console.error(`  · ${lugar.id}: ${titulo} descartado (licencia: ${f?.licencia || 'desconocida'})`);
        continue;
      }
      hecho = { ...p, ...f };
      break;
    }

    // 3. Y de último recurso, buscar en Commons por el nombre del sitio.
    if (!hecho) {
      for (const c of await buscaEnCommons(lugar.nombre.replace(/·.*/, '') + ' Italia').catch(() => [])) {
        if (usadas.has(c.fichero) || !esLibre(c.licencia) || !c.url) continue;
        hecho = c;
        break;
      }
    }

    if (!hecho) { fallos.push(lugar.id); console.error(`  ✗ ${lugar.id}: sin foto libre`); continue; }
    usadas.add(hecho.fichero);

    // Todas acaban en JPEG, venga el original como venga.
    const archivo = `${lugar.id}.jpg`;

    if (escribir) {
      const ruta = join(DESTINO, archivo);
      const ya = FORZAR ? null : await stat(ruta).catch(() => null);
      bytes += ya?.size ? ya.size : await baja(hecho.url, ruta);
    }

    salida.push({
      id: lugar.id,
      archivo,
      pie: lugar.nombre,
      autor: hecho.autor,
      licencia: hecho.licencia,
      licencia_url: hecho.licencia_url,
      origen: hecho.origen,
      articulo: hecho.lang === 'commons'
        ? hecho.origen
        : `https://${hecho.lang}.wikipedia.org/wiki/${encodeURIComponent(hecho.articulo)}`
    });
    console.log(`  ✓ ${lugar.id.padEnd(22)} ${hecho.licencia.padEnd(14)} ${hecho.fichero.slice(0, 60)}`);
  }

  console.log(`\n${salida.length} de ${lugares.length} lugares con foto libre.`);
  if (fallos.length) console.log(`Sin foto: ${fallos.join(', ')}`);
  if (escribir) {
    await writeFile(join(APP, 'datos', 'imagenes.json'),
      JSON.stringify({ nota: 'Generado por herramientas/fotos.mjs. Todas de Wikimedia Commons con licencia libre.', fotos: salida }, null, 1) + '\n');
    console.log(`Bajados ${(bytes / 1024 / 1024).toFixed(2)} MB en app/imagenes/.`);
  } else {
    console.log('Prueba en seco. Vuelve a lanzarlo con --escribir para bajar las fotos.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
