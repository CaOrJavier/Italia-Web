// Service worker: la app entera vive en caché para que arranque en frío
// dentro de un coche sin cobertura.
//
// IMPORTANTE: cada generación de la caché es coherente consigo misma. Los
// ficheros SÓLO se escriben durante `install`, nunca al vuelo: si se
// refrescara fichero a fichero, una recarga a medias podría mezclar módulos
// de dos versiones y la app no arrancaría.
//
// => Si tocas cualquier fichero de la lista SHELL, sube VERSION.

const VERSION = 'v33';
const CACHE_APP = `italia2026-app-${VERSION}`;
const CACHE_TILES = 'italia2026-tiles-v1';   // lo comparte js/tiles.js
const HOST_TILES = 'tile.openstreetmap.org';

// Una foto por día. Van al precaché igual que el resto: una foto que hay que
// bajar cuando la miras no sirve de nada en los Apeninos sin cobertura.
// Los créditos y los pies viven en datos/imagenes.json.
const FOTOS = [
  'imagenes/d00-civitavecchia.jpg',
  'imagenes/d01-coliseo.jpg',
  'imagenes/d02-siena.jpg',
  'imagenes/d03-sangimignano.jpg',
  'imagenes/d04-florencia.jpg',
  'imagenes/d05-pisa.jpg',
  'imagenes/d06-cinqueterre.jpg',
  'imagenes/d07-bolonia.jpg',
  'imagenes/d08-venecia.jpg',
  'imagenes/d09-ravena.jpg',
  'imagenes/d10-asis.jpg',
  'imagenes/d11-vaticano.jpg'
];

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/estilos.css',
  'vendor/leaflet.css',
  'vendor/leaflet.js',
  'js/app.js',
  'js/ui.js',
  'js/util.js',
  'js/datos.js',
  'js/estado.js',
  'js/tiles.js',
  'js/ilustraciones.js',
  'js/fotos.js',
  'js/idioma.js',
  'js/mas-que-ver.js',
  'js/vistas/hoy.js',
  'js/vistas/ruta.js',
  'js/vistas/mapa.js',
  'js/vistas/gasto.js',
  'js/vistas/guia.js',
  'js/vistas/alternativas.js',
  'js/vistas/lengua.js',
  'js/vistas/ajustes.js',
  'datos/datos-viaje.json',
  'datos/franjas.json',
  'datos/fichas.json',
  'datos/comer.json',
  'datos/acceso.json',
  'datos/rutas.json',
  'datos/alternativas.json',
  'datos/imagenes.json',
  'iconos/icono-192.png',
  'iconos/icono-512.png',
  ...FOTOS
];

// Lo que puede faltar sin romper nada. Las fotos son decorativas: si una no
// se descarga, la app arranca igual y ese día se queda sin banner. Al revés
// —tirar el precaché entero por una foto— sí sería un problema de verdad.
const PRESCINDIBLES = new Set([
  'iconos/icono-192.png', 'iconos/icono-512.png', 'manifest.webmanifest', ...FOTOS
]);

self.addEventListener('install', (ev) => {
  ev.waitUntil((async () => {
    const cache = await caches.open(CACHE_APP);
    const fallos = [];
    await Promise.all(SHELL.map(async (u) => {
      try { await cache.add(new Request(u, { cache: 'reload' })); }
      catch (e) { fallos.push(u); console.warn('[sw] no se pudo precachear', u, e); }
    }));
    // Si falta algo esencial, mejor no activar: se queda la versión anterior,
    // que al menos es coherente, en vez de una a medio hacer.
    const graves = fallos.filter(u => !PRESCINDIBLES.has(u));
    if (graves.length) {
      await caches.delete(CACHE_APP);
      throw new Error('Precaché incompleto: ' + graves.join(', '));
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres
      .filter(n => n.startsWith('italia2026-app-') && n !== CACHE_APP)
      .map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Teselas del mapa: primero la caché; si no hay y hay red, se guarda al vuelo.
  if (url.hostname === HOST_TILES) {
    ev.respondWith((async () => {
      const cache = await caches.open(CACHE_TILES);
      const guardada = await cache.match(req);
      if (guardada) return guardada;
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return new Response('', { status: 504, statusText: 'Sin conexión y sin tesela guardada' });
      }
    })());
    return;
  }

  if (url.origin !== location.origin) return;

  // Navegación: siempre el shell, para que los enlaces con hash funcionen offline.
  if (req.mode === 'navigate') {
    ev.respondWith((async () => {
      const cache = await caches.open(CACHE_APP);
      return (await cache.match('index.html')) || (await cache.match('./')) || fetch(req);
    })());
    return;
  }

  // Resto de ficheros propios: lo que esté precacheado se sirve tal cual,
  // sin revalidar, para no mezclar versiones. Lo que no esté, de la red.
  ev.respondWith((async () => {
    const cache = await caches.open(CACHE_APP);
    const guardada = await cache.match(req, { ignoreSearch: true });
    if (guardada) return guardada;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      return new Response('Sin conexión y sin copia guardada', { status: 504 });
    }
  })());
});
