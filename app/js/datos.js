// Carga de datos-viaje.json (fuente de la verdad, sólo lectura) y franjas.json
// (el plan hora a hora extraído de la guía). Aquí viven también los cálculos
// derivados: qué paradas tiene cada día tras editarlo y cuánto suman.

import * as estado from './estado.js';
import { haversine, largoCadena, precioEur, aMinutos, soloTexto } from './util.js';

export let VIAJE = null;      // datos-viaje.json
export let FRANJAS = [];      // franjas.json: el plan hora a hora
export let FICHAS = [];       // fichas.json: secciones largas de la guía
export let COMER = [];        // comer.json: qué comer en cada región
export let ACCESO = [];       // acceso.json: dónde dejar el coche en cada ciudad
export let RUTAS = null;      // rutas.json: las tres rutas comparadas
export let ALTERNATIVAS = null; // alternativas.json: las dos variantes del itinerario
export let IMAGENES = [];     // imagenes.json: la foto de cada día y su crédito
export let LUGAR = new Map(); // id -> lugar del JSON
export let NOCHE = new Map(); // id -> noche

export async function cargar() {
  const opcional = (u) => fetch(u).then(r => r.ok ? r.json() : []).catch(() => []);
  const [viaje, franjas, fichas, comer, acceso, rutas, alternativas, imagenes] = await Promise.all([
    fetch('datos/datos-viaje.json').then(r => { if (!r.ok) throw new Error('datos-viaje.json: ' + r.status); return r.json(); }),
    opcional('datos/franjas.json'),
    opcional('datos/fichas.json'),
    opcional('datos/comer.json'),
    opcional('datos/acceso.json'),
    opcional('datos/rutas.json'),
    opcional('datos/alternativas.json'),
    opcional('datos/imagenes.json')
  ]);
  VIAJE = viaje;
  FRANJAS = franjas;
  FICHAS = fichas;
  COMER = comer;
  ACCESO = acceso;
  IMAGENES = Array.isArray(imagenes) ? imagenes : [];
  RUTAS = rutas && rutas.rutas ? rutas : null;
  ALTERNATIVAS = alternativas && alternativas.opciones ? alternativas : null;
  LUGAR = new Map(viaje.lugares.map(l => [l.id, l]));
  NOCHE = new Map(viaje.noches.map(n => [n.id, n]));
  return viaje;
}

export const ficha = (id) => FICHAS.find(f => f.id === id)?.html ?? '';

// ---------- Entrar en la ciudad: aparcar y llegar al centro ----------

const VELOCIDAD_PIE = 4.5;   // km/h andando, con calor y cuesta arriba
const RODEO = 1.3;           // las calles no van en línea recta
const MARGEN_APARCAR = 10;   // buscar hueco, maniobrar, sacar el ticket
const MARGEN_ESPERA = 10;    // esperar el metro, el bus o el tranvía

// Palabras demasiado comunes para identificar un aparcamiento: sin esto,
// "Parco Nord" (Bolonia) casaba con "Parco San Giuliano" (Mestre).
const GENERICAS = new Set([
  'parco', 'campo', 'porta', 'villa', 'piazza', 'viale', 'centro', 'antico',
  'stazione', 'estacion', 'parcheggio', 'parking', 'aparcamiento', 'metro'
]);

/**
 * Cómo se entra en cada ciudad de un día: dónde queda el coche, cómo se sigue
 * y cuánto tardas de verdad.
 *
 * Los minutos salen de la guía cuando los da (Florencia 22 en tranvía, Lucca
 * 15 a pie, Siena 10). Cuando no, se estiman a pie desde las coordenadas del
 * aparcamiento hasta la primera visita del día — y se marcan como estimados.
 * Al total se le suma margen: nunca se llega andando en el tiempo teórico.
 */
export function accesoDe(n) {
  const d = dia(n);
  if (!d) return [];
  const sinT = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const paradas = paradasVisibles(n);
  const parkings = paradas.filter(p => p.categoria === 'parking' && Number.isFinite(p.lat));

  // Una ciudad cuenta para el día si la nombra el título o alguna de sus
  // paradas. La etapa NO vale: incluye la ciudad de la que se sale.
  const nombres = paradas.map(p => sinT(p.nombre));
  const titulo = sinT(d.titulo);

  return ACCESO
    .filter(a => {
      const c = sinT(a.ciudad);
      return titulo.includes(c) || nombres.some(x => x.includes(c));
    })
    .map(a => {
      const c = sinT(a.ciudad);
      // El nombre del aparcamiento casi nunca lleva el de la ciudad ("P&R
      // Magliana" no dice "Roma"), pero el texto de la guía sí lo nombra:
      // se cruzan por las palabras distintivas del aparcamiento.
      const comoTexto = sinT(a.como_texto);
      const park = parkings.find(p => sinT(p.nombre).includes(c))
        ?? parkings.find(p => sinT(p.nombre)
              .split(/[^a-z0-9]+/)
              .filter(w => w.length > 4 && !GENERICAS.has(w))
              .some(w => comoTexto.includes(w)))
        ?? null;

      let minutos = a.minutos, estimado = false;
      const enTransporte = /metro|tranv|\bbus\b|lanzadera|tren|ascensor|escaleras/i.test(a.como_texto);

      // A pie se puede estimar sobre el plano. En metro, tranvía o lanzadera no:
      // depende de frecuencias que no están en los datos, así que no se estima.
      if (!minutos && !enTransporte && park) {
        const destino = paradas
          .filter(p => ['ver', 'mirador'].includes(p.categoria) && Number.isFinite(p.lat))
          .map(p => ({ p, km: haversine([park.lat, park.lon], [p.lat, p.lon]) }))
          .sort((x, y) => x.km - y.km)[0];
        // Más de 3 km no es una caminata al centro: es otra ciudad.
        if (destino && destino.km < 3) {
          minutos = Math.round(destino.km * RODEO / VELOCIDAD_PIE * 60);
          estimado = true;
        }
      }

      const total = minutos ? minutos + MARGEN_APARCAR + (enTransporte ? MARGEN_ESPERA : 0) : null;
      return { ...a, park, minutos, estimado, enTransporte, total };
    });
}

/**
 * En qué días cae cada región gastronómica.
 *
 * La correspondencia no se escribe a mano: cada región de `comer.json` trae
 * sus ciudades (el `<small>` de la tabla de la guía) y se buscan esos nombres
 * en la etapa y el título de cada día.
 */
export function regionesConDias() {
  const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return COMER.map(r => {
    const claves = r.zonas.map(norm);
    const dias = VIAJE.dias.filter(d => {
      const texto = norm(`${d.etapa} ${d.titulo}`);
      return claves.some(c => texto.includes(c));
    });
    return { ...r, dias };
  }).filter(r => r.dias.length)
    .sort((a, b) => a.dias[0].dia - b.dias[0].dia);
}

/** Los sitios de comer del JSON, que sí traen coordenadas para navegar. */
export const lugaresComer = () => VIAJE.lugares.filter(l => l.categoria === 'comer');

export const dias = () => VIAJE.dias;
export const dia = (n) => VIAJE.dias.find(d => d.dia === Number(n));
export const diaPorFecha = (f) => VIAJE.dias.find(d => d.fecha === f);
export const franjasDe = (n) => (FRANJAS.find(f => f.dia === Number(n))?.franjas) ?? [];
export const extrasDe = (n) => (FRANJAS.find(f => f.dia === Number(n))) ?? { dormir_html: '', coste_html: '' };
export const nocheDe = (n) => NOCHE.get(dia(n)?.dormir_ref) ?? null;
/**
 * Los colores de categoría del JSON son seis tonos sueltos que no comparten
 * familia y chocaban con los de prioridad y los de estado. Se sustituyen por
 * los mismos pigmentos italianos del resto de la app. El nombre y todo lo
 * demás sale del JSON sin tocar: esto es presentación, no dato del viaje.
 */
const COLOR_CATEGORIA = {
  ver:     '#a63a28',  // rosso pompeiano
  parking: '#2a6ba3',  // azzurro adriatico
  dormir:  '#3d6b2f',  // verde oliva
  mirador: '#96601a',  // terra di Siena
  comer:   '#7a4a6d',  // melanzana
  natura:  '#157f79'   // verde acqua
};

export const categoria = (c) => {
  const base = VIAJE.categorias[c] ?? { nombre: c, color: '#777' };
  return { ...base, color: COLOR_CATEGORIA[c] ?? base.color };
};

/**
 * Todos los lugares de un día: los suyos del JSON, los que se hayan movido
 * aquí desde otro día y los añadidos a mano.
 *
 * Sin la parte de `reasignaciones`, mover una parada a otro día la hacía
 * desaparecer: el destino sólo miraba sus propios ids y el id venido de fuera
 * no resolvía a nada.
 */
function lugaresBase(n) {
  const d = dia(n);
  if (!d) return [];
  const num = Number(n);
  const s = estado.obtener();

  const propios = d.lugares
    .filter(id => (s.reasignaciones[id] ?? num) === num)
    .map(id => LUGAR.get(id))
    .filter(Boolean);

  const venidos = Object.entries(s.reasignaciones)
    .filter(([id, destino]) => Number(destino) === num && LUGAR.get(Number(id))?.dia !== num)
    .map(([id]) => LUGAR.get(Number(id)))
    .filter(Boolean);

  const extra = s.lugares_extra.filter(l => l.dia === num);
  return [...propios, ...venidos, ...extra];
}

/**
 * Paradas del día en el orden vigente (con las ediciones aplicadas).
 * Incluye las ocultas: cada una lleva `oculto` para que la vista decida.
 */
export function paradasDe(n) {
  const s = estado.obtener();
  const base = lugaresBase(n);
  const porId = new Map(base.map(l => [l.id, l]));
  const orden = s.itinerario_editado[n];
  let lista;
  if (Array.isArray(orden) && orden.length) {
    const vistos = new Set();
    lista = orden.map(id => { vistos.add(id); return porId.get(id); }).filter(Boolean);
    // Las que no estén en el orden guardado (p. ej. añadidas después) van al final.
    lista.push(...base.filter(l => !vistos.has(l.id)));
  } else {
    lista = base;
  }
  return lista.map(l => ({ ...l, oculto: !!s.lugares_ocultos[l.id] }));
}

/** Las que cuentan: visibles. */
export const paradasVisibles = (n) => paradasDe(n).filter(p => !p.oculto);

/** ¿Se ha tocado este día? */
export function estaEditado(n) {
  const s = estado.obtener();
  const num = Number(n);
  if (s.itinerario_editado[n]?.length) return true;
  if (s.lugares_extra.some(l => l.dia === num)) return true;
  if (Object.entries(s.reasignaciones).some(([id, destino]) =>
        Number(destino) === num || LUGAR.get(Number(id))?.dia === num)) return true;
  return lugaresBase(n).some(l => s.lugares_ocultos[l.id]);
}

const punto = (l) => [l.lat, l.lon];

/** Cadena de puntos que se conduce en un día: dormir anterior → paradas → dormir. */
function cadena(n, paradas) {
  const pts = [];
  const anterior = nocheDe(Number(n) - 1);
  if (anterior) pts.push([anterior.lat, anterior.lon]);
  pts.push(...paradas.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon)).map(punto));
  const propia = nocheDe(n);
  if (propia) pts.push([propia.lat, propia.lon]);
  return pts;
}

const cacheFactor = new Map();

/**
 * Los km del JSON son de carretera; la cadena de puntos da línea recta.
 * El cociente entre ambos (factor de sinuosidad) permite reestimar el día
 * cuando se reordenan paradas, manteniendo la escala del plan original.
 */
function factorSinuosidad(n) {
  if (cacheFactor.has(n)) return cacheFactor.get(n);
  const d = dia(n);
  const recta = largoCadena(cadena(n, d.lugares.map(id => LUGAR.get(id)).filter(Boolean)));
  const f = recta > 1 ? d.km / recta : 1.3;
  cacheFactor.set(n, f);
  return f;
}

// ---------- Prioridades ----------

export const PRIORIDADES = {
  imprescindible: { nombre: 'Imprescindible', corto: 'Imprescindible', color: '#a63a28', orden: 0 },
  recomendable:   { nombre: 'Recomendable',   corto: 'Recomendable',   color: '#96601a', orden: 1 },
  sivabien:       { nombre: 'Si va bien de tiempo', corto: 'Si va bien', color: '#157f79', orden: 2 },
  logistica:      { nombre: 'Logística',      corto: 'Logística',      color: '#6d6558', orden: 3 }
};

export const CICLO_PRIORIDAD = ['imprescindible', 'recomendable', 'sivabien', 'logistica'];

const sinTildes = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Prioridad **por defecto** de una parada.
 *
 * Ojo: `datos-viaje.json` no trae prioridad por lugar, así que esto es una
 * heurística, no un dato. Se apoya en las tres únicas señales fiables que hay:
 * la categoría, si la parada tiene una reserva asociada y su prioridad, y si
 * el nombre aparece en el título del día (o sea, si el día existe por ella).
 *
 * Se queda corta a propósito en los casos dudosos: el usuario la cambia de un
 * toque y su decisión se guarda en `estado.prioridades`.
 */
function prioridadPorDefecto(lugar) {
  if (['parking', 'dormir'].includes(lugar.categoria)) return 'logistica';

  const nombre = sinTildes(lugar.nombre);
  const clave = nombre.split(/[·(—-]/)[0].trim();

  const reserva = VIAJE.reservas.find(r => {
    const q = sinTildes(r.que);
    return (clave.length > 3 && q.includes(clave)) || nombre.includes(q.split(/[·(+]/)[0].trim());
  });
  if (reserva && ['critica', 'alta'].includes(reserva.prioridad)) return 'imprescindible';

  const d = dia(lugar.dia);
  if (d && clave.length > 3 && sinTildes(d.titulo).includes(clave)) return 'imprescindible';

  if (reserva) return 'sivabien';
  if (['mirador', 'natura', 'comer'].includes(lugar.categoria)) return 'sivabien';
  return 'recomendable';
}

/** Prioridad vigente: lo que haya decidido el usuario, o la de por defecto. */
export function prioridadDe(lugar) {
  if (!lugar) return 'recomendable';
  const guardada = estado.obtener().prioridades[lugar.id];
  return PRIORIDADES[guardada] ? guardada : prioridadPorDefecto(lugar);
}

export const colorPrioridad = (lugar) => PRIORIDADES[prioridadDe(lugar)].color;

/** ¿Ha tocado el usuario la prioridad de esta parada? */
export const prioridadTocada = (lugar) => !!PRIORIDADES[estado.obtener().prioridades[lugar.id]];

/**
 * Margen del día: luz aprovechable menos lo que se pasa conduciendo.
 * Responde a «¿voy apurado?» sin inventar duraciones de visita, que no están
 * en los datos.
 */
export function margenDia(n) {
  const d = dia(n);
  const f = franjasDe(n);
  const arranca = f.length ? aMinutos(f[0].hora) : aMinutos(d.amanecer);
  const acaba = Math.max(aMinutos(d.ocaso), f.length ? aMinutos(f[f.length - 1].hora) + 60 : 0);
  const activo = Math.max(0, acaba - arranca);
  const conduce = resumenDia(n).minutos;
  const visitas = paradasVisibles(n).filter(p => prioridadDe(p) !== 'logistica').length;
  const libre = activo - conduce;
  return {
    arranca: f.length ? f[0].hora : d.amanecer,
    acaba: d.ocaso,
    activo, conduce, libre, visitas,
    porVisita: visitas ? Math.round(libre / visitas) : 0
  };
}

/** Minutos seguidos al volante a partir de los cuales el día se hace duro viajando solo. */
export const LIMITE_SEGUIDO = 180;

/** Paradas a menos de esta distancia se consideran la misma ciudad: se anda, no se conduce. */
const RADIO_CIUDAD_KM = 15;

/**
 * Los tramos de conducción **seguida** de un día, en orden.
 *
 * Los minutos del JSON son el total del día, pero lo que cansa viajando solo
 * es el tirón sin parar. Se agrupan las paradas cercanas entre sí (dentro de
 * una ciudad se va a pie) y lo que queda entre grupo y grupo son los trayectos
 * reales; se reparten los km y los minutos del día en proporción.
 *
 * Se calcula sobre las paradas vigentes, así que al editar el día cambia.
 */
export function tramosConduccion(n) {
  const d = dia(n);
  if (!d) return [];

  const puntos = [];
  const anterior = nocheDe(Number(n) - 1);
  if (anterior) puntos.push({ nombre: anterior.nombre, pt: [anterior.lat, anterior.lon] });
  for (const p of paradasVisibles(n)) {
    if (Number.isFinite(p.lat)) puntos.push({ nombre: p.nombre, pt: [p.lat, p.lon] });
  }
  const propia = nocheDe(n);
  if (propia) puntos.push({ nombre: propia.nombre, pt: [propia.lat, propia.lon] });

  const grupos = [];
  for (const p of puntos) {
    const g = grupos[grupos.length - 1];
    if (g && haversine(g.ultimo, p.pt) < RADIO_CIUDAD_KM) { g.ultimo = p.pt; g.hasta = p.nombre; }
    else grupos.push({ desde: p.nombre, hasta: p.nombre, primero: p.pt, ultimo: p.pt });
  }

  const saltos = [];
  for (let i = 1; i < grupos.length; i++) {
    saltos.push({
      desde: grupos[i - 1].hasta,
      hasta: grupos[i].desde,
      recta: haversine(grupos[i - 1].ultimo, grupos[i].primero)
    });
  }

  const resumen = resumenDia(n);
  const suma = saltos.reduce((t, s) => t + s.recta, 0);
  const escala = suma > 0 ? resumen.km / suma : 0;
  return saltos.map(s => {
    const km = Math.round(s.recta * escala);
    return { desde: s.desde, hasta: s.hasta, km, minutos: resumen.km > 0 ? Math.round(km / resumen.km * resumen.minutos) : 0 };
  });
}

/** El tirón más largo del día, o null si no se conduce. */
export function tramoMasLargo(n) {
  return tramosConduccion(n).reduce((m, t) => (!m || t.minutos > m.minutos) ? t : m, null);
}

/** Coste de las entradas/aparcamientos de una lista de paradas, en euros. */
export const costeParadas = (paradas) => paradas.reduce((t, p) => t + precioEur(p.precio), 0);

/**
 * Km, minutos de volante y coste del día con las ediciones aplicadas.
 * Si el día no se ha tocado devuelve los valores originales del JSON, sin estimar.
 */
export function resumenDia(n) {
  const d = dia(n);
  const paradas = paradasVisibles(n);
  const original = {
    km: d.km,
    minutos: d.minutos_conduccion,
    coste: costeParadas(d.lugares.map(id => LUGAR.get(id)).filter(Boolean)),
    estimado: false
  };
  if (!estaEditado(n)) return { ...original, original };

  const recta = largoCadena(cadena(n, paradas));
  const km = Math.round(recta * factorSinuosidad(n));
  const velocidad = d.minutos_conduccion > 0 ? d.km / d.minutos_conduccion : 0.75; // km/min
  const minutos = velocidad > 0 ? Math.round(km / velocidad) : d.minutos_conduccion;
  return { km, minutos, coste: costeParadas(paradas), estimado: true, original };
}

/**
 * Parte `ruta_polilinea` en un tramo por día.
 *
 * El JSON trae la ruta como una sola línea de 26 puntos sin marcar a qué día
 * pertenece cada uno, pero cada punto coincide exactamente con un lugar o una
 * noche del viaje: basta con buscar el más cercano. Después se fuerza que el
 * día no retroceda (la ruta es un anillo y el último punto vuelve al origen) y
 * se encadenan los tramos compartiendo el punto de unión.
 */
let cacheTramos = null;
export function tramosPorDia() {
  if (cacheTramos) return cacheTramos;

  const referencias = [
    ...VIAJE.lugares.map(l => ({ dia: l.dia, pt: [l.lat, l.lon] })),
    ...VIAJE.noches.map(n => {
      const d = VIAJE.dias.find(x => x.dormir_ref === n.id);
      return d ? { dia: d.dia, pt: [n.lat, n.lon] } : null;
    }).filter(Boolean)
  ];

  let ultimo = 0;
  const deQuien = VIAJE.ruta_polilinea.map(p => {
    let mejor = null;
    for (const r of referencias) {
      const d = haversine(p, r.pt);
      if (!mejor || d < mejor.d) mejor = { d, dia: r.dia };
    }
    ultimo = Math.max(ultimo, mejor.dia);
    return ultimo;
  });

  const tramos = VIAJE.dias.map(d => ({ dia: d.dia, puntos: [] }));
  VIAJE.ruta_polilinea.forEach((p, i) => {
    const t = tramos.find(x => x.dia === deQuien[i]);
    // El primer punto de un tramo es el último del anterior, para que la línea no se corte.
    if (!t.puntos.length && i > 0) t.puntos.push(VIAJE.ruta_polilinea[i - 1]);
    t.puntos.push(p);
  });

  cacheTramos = tramos;
  return tramos;
}

/** Totales del viaje: lo que suman las 12 etapas. */
export const totalesRuta = () => ({
  km: VIAJE.dias.reduce((t, d) => t + d.km, 0),
  minutos: VIAJE.dias.reduce((t, d) => t + d.minutos_conduccion, 0),
  kmDeclarados: VIAJE.meta.km_totales,
  kmEtapas: VIAJE.meta.km_etapas
});

/** Gasto previsto para un día según el escenario recomendado. */
export const previstoDia = (n) =>
  VIAJE.presupuesto.diario_recomendado.find(x => x.dia === Number(n))?.total ?? 0;

export const previstoAcumulado = (n) =>
  VIAJE.presupuesto.diario_recomendado
    .filter(x => x.dia <= Number(n))
    .reduce((t, x) => t + x.total, 0);

/** La franja en curso y la siguiente, dada una hora 'HH:MM'. */
export function franjaEnCurso(n, hhmm) {
  const lista = franjasDe(n);
  if (!lista.length) return { actual: null, siguiente: null, indice: -1 };
  const m = aMinutos(hhmm);
  let i = -1;
  lista.forEach((f, k) => { if (aMinutos(f.hora) <= m) i = k; });
  return { actual: i >= 0 ? lista[i] : null, siguiente: lista[i + 1] ?? null, indice: i };
}

/** Reparte las paradas del día entre sus franjas, proporcionalmente al orden. */
export function paradasPorFranja(n) {
  const franjas = franjasDe(n);
  const paradas = paradasVisibles(n);
  if (!franjas.length) return [{ franja: null, paradas }];
  const grupos = franjas.map(f => ({ franja: f, paradas: [] }));
  paradas.forEach((p, i) => {
    const k = Math.min(grupos.length - 1, Math.floor(i * grupos.length / Math.max(1, paradas.length)));
    grupos[k].paradas.push(p);
  });
  return grupos;
}

/** Reservas ordenadas por urgencia. */
const PESO = { critica: 0, alta: 1, media: 2, opcional: 3 };
export const reservasOrdenadas = () =>
  [...VIAJE.reservas].sort((a, b) => (PESO[a.prioridad] ?? 9) - (PESO[b.prioridad] ?? 9) || a.dia - b.dia);

export const estadoReserva = (id) => estado.obtener().reservas_estado[id] ?? 'pendiente';

export const reservasCriticasPendientes = () =>
  VIAJE.reservas.filter(r => r.prioridad === 'critica' && estadoReserva(r.id) === 'pendiente');

/** Los N puntos más cercanos a unas coordenadas. */
export function cercaDe(lat, lon, limite = 12) {
  return VIAJE.lugares
    .map(l => ({ lugar: l, dist: haversine([lat, lon], [l.lat, l.lon]) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limite);
}

// ---------- Buscador ----------

let indice = null;

const normalizar = (s) => String(s ?? '')
  .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function construirIndice() {
  const filas = [];
  for (const l of VIAJE.lugares) {
    filas.push({
      tipo: 'lugar', id: l.id, titulo: l.nombre,
      sub: `Día ${l.dia} · ${categoria(l.categoria).nombre}${l.precio ? ' · ' + l.precio : ''}`,
      texto: normalizar(`${l.nombre} ${l.descripcion} ${l.precio}`),
      ruta: `#/mapa?lugar=${l.id}`
    });
  }
  for (const d of VIAJE.dias) {
    const fr = soloTexto(franjasDe(d.dia).map(f => f.html).join(' '));
    filas.push({
      tipo: 'día', id: d.dia, titulo: `${d.etiqueta} · ${d.titulo}`,
      sub: `${d.etapa} · ${d.km} km`,
      texto: normalizar(`${d.titulo} ${d.etapa} ${d.aviso} ${fr}`),
      ruta: `#/ruta?dia=${d.dia}`
    });
  }
  for (const c of VIAJE.conduccion.ztl.ciudades) {
    filas.push({
      tipo: 'ZTL', id: c.ciudad, titulo: `ZTL de ${c.ciudad}`,
      sub: `Riesgo ${c.riesgo} · multa ${c.multa_eur} €`,
      texto: normalizar(`ztl ${c.ciudad} ${c.horario} multa aparcar`),
      ruta: `#/guia?ficha=ztl`
    });
  }
  for (const a of VIAJE.transporte.abonos) {
    filas.push({
      tipo: 'abono', id: a.nombre, titulo: a.nombre,
      sub: `${a.veredicto.toUpperCase()} · ${a.razon}`,
      texto: normalizar(`${a.nombre} ${a.razon} abono tarjeta`),
      ruta: `#/guia?ficha=abonos`
    });
  }
  for (const t of VIAJE.tours) {
    filas.push({
      tipo: 'tour', id: t.nombre, titulo: t.nombre,
      sub: `${t.veredicto === 'si' ? 'Sí' : 'No'} · ${t.precio_eur} €`,
      texto: normalizar(`${t.nombre} ${t.razon} tour guia`),
      ruta: `#/guia?ficha=tours`
    });
  }
  for (const r of VIAJE.reservas) {
    filas.push({
      tipo: 'reserva', id: r.id, titulo: r.que,
      sub: `${r.fecha} · ${r.precio_eur} € · ${r.prioridad}`,
      texto: normalizar(`${r.que} ${r.nota} reserva entrada`),
      ruta: `#/guia?ficha=reservas`
    });
  }
  for (const n of VIAJE.noches) {
    filas.push({
      tipo: 'dormir', id: n.id, titulo: n.nombre,
      sub: `${n.fecha} · ${n.precio_eur ? n.precio_eur + ' €' : 'gratis'}`,
      texto: normalizar(`${n.nombre} ${n.nota} dormir noche`),
      ruta: `#/guia?ficha=dormir`
    });
  }
  for (const e of VIAJE.eventos) {
    filas.push({
      tipo: 'evento', id: e.nombre, titulo: e.nombre,
      sub: `${e.lugar} · ${e.fecha_inicio}`,
      texto: normalizar(`${e.nombre} ${e.lugar} evento fiesta`),
      ruta: `#/guia?ficha=eventos`
    });
  }
  return filas;
}

export function buscar(consulta) {
  if (!indice) indice = construirIndice();
  const q = normalizar(consulta).trim();
  if (q.length < 2) return [];
  const palabras = q.split(/\s+/);
  return indice
    .map(f => {
      let p = 0;
      for (const w of palabras) {
        if (!f.texto.includes(w)) return null;
        p += normalizar(f.titulo).includes(w) ? 3 : 1;
      }
      return { ...f, peso: p };
    })
    .filter(Boolean)
    .sort((a, b) => b.peso - a.peso)
    .slice(0, 40);
}
