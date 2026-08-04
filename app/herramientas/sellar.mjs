// Le pone el sello del commit a cada URL interna, para que el navegador no sirva
// la versión de ayer.
//
// El problema: GitHub Pages manda los ficheros con Cache-Control de diez minutos
// y sin nada que diga cuándo caducan de verdad, así que el navegador se los queda
// y los módulos ES los guarda con más ganas todavía. En el ordenador se arregla
// con Ctrl+Shift+R; en un móvil no hay Ctrl+Shift+R.
//
// La solución de siempre: que la URL cambie cuando cambia el contenido. Aquí se
// hace reescribiendo cada referencia interna con «?v=<sello>» antes de publicar:
//
//   <script src="js/app.js">        →  <script src="js/app.js?v=a1b2c3d">
//   import { esc } from './util.js' →  import { esc } from './util.js?v=a1b2c3d'
//   json('datos/rutas.json')        →  json('datos/rutas.json?v=a1b2c3d')
//
// Hay que tocar también los import de dentro de los módulos: el navegador guarda
// cada módulo por su URL completa, así que sellar solo el de entrada dejaría los
// otros doce igual de rancios.
//
// Corre en el despliegue, sobre la copia que se sube, y nunca sobre los fuentes:
// en local no hace falta y ensuciaría los ficheros de trabajo.
//
//   node app/herramientas/sellar.mjs <carpeta> <sello>

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const [carpeta, sello] = process.argv.slice(2);
if (!carpeta || !sello) {
  console.error('uso: node sellar.mjs <carpeta> <sello>');
  process.exit(1);
}

const v = sello.slice(0, 12);

/** Todo lo que apunte a un fichero nuestro y pueda cambiar entre despliegues.
 *  Las fotos se quedan fuera a propósito: pesan, no cambian y llevan su nombre
 *  desde que se bajaron. */
const REFERENCIAS = /(["'])((?:\.{1,2}\/|(?:js|css|datos)\/)[^"'?]+\.(?:js|json|css))\1/g;

function sellarTexto(t) {
  return t.replace(REFERENCIAS, (_, comilla, ruta) => `${comilla}${ruta}?v=${v}${comilla}`);
}

let tocados = 0, referencias = 0;
function recorrer(dir) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) { recorrer(ruta); continue; }
    if (!['.js', '.html', '.mjs'].includes(extname(nombre))) continue;
    if (ruta.includes('herramientas')) continue;      // no se publican

    const antes = readFileSync(ruta, 'utf8');
    const despues = sellarTexto(antes);
    if (antes === despues) continue;
    referencias += [...antes.matchAll(REFERENCIAS)].length;
    writeFileSync(ruta, despues);
    tocados++;
  }
}

recorrer(carpeta);
console.log(`Sellado con ?v=${v}: ${referencias} referencias en ${tocados} ficheros.`);
