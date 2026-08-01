// Estado del usuario: lo único que se escribe. Vive en localStorage, nunca
// toca datos-viaje.json y se puede exportar/importar como fichero.

const CLAVE = 'italia2026:estado';
const VERSION = 1;

const PLANTILLA = () => ({
  version: VERSION,
  tema_migrado: false,
  gastos: [],              // [{id, fecha, categoria, importe, nota}]
  reservas_estado: {},     // {coliseo: 'pendiente'|'reservada'|'pagada'}
  equipaje_estado: {},     // {"3": true}
  paradas_hechas: {},      // {"12": true}
  itinerario_editado: {},  // {"3": [ids en orden]}
  lugares_ocultos: {},     // {"12": true}
  lugares_extra: [],       // paradas añadidas a mano
  reasignaciones: {},      // {"24": 5} — parada movida a otro día
  variante: null,          // id de la variante de ruta aplicada, si hay alguna
  prioridades: {},         // {"12": "imprescindible"} — decisión del usuario
  notas: {},               // {"12": "texto"}   claves: lugar:ID o dia:N
  // La edad decide qué descuentos aplican: el estatal italiano corta en 25 y
  // la Rolling Venice de Venecia en 29.
  // Tema claro por defecto, no "auto": la app se usa sobre todo a pleno sol,
  // y seguir al sistema la dejaba oscura en móviles con modo noche activado.
  ajustes: { tema: 'claro', combustible: 'gasolina', consumo: 7, edad: 29 }
});

let estado = PLANTILLA();
const oyentes = new Set();

function cargar() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return;
    const guardado = JSON.parse(crudo);
    estado = fusionar(PLANTILLA(), guardado);
  } catch (e) {
    console.warn('No se pudo leer el estado guardado; se empieza en limpio.', e);
  }
}

/** Mezcla superficial por clave: añade campos nuevos sin perder los guardados. */
function fusionar(base, guardado) {
  const salida = { ...base };
  for (const k of Object.keys(base)) {
    const v = guardado?.[k];
    if (v === undefined || v === null) continue;
    salida[k] = (Array.isArray(base[k]) || typeof base[k] !== 'object')
      ? v
      : { ...base[k], ...v };
  }
  // El tema por defecto pasó de "auto" a "claro". A quien nunca lo eligió a
  // mano se le cambia una sola vez; si después pone "auto" a propósito, se
  // respeta, porque la marca ya está puesta.
  if (!guardado?.tema_migrado && salida.ajustes.tema === 'auto') salida.ajustes.tema = 'claro';
  salida.tema_migrado = true;

  salida.version = VERSION;
  return salida;
}

let pendiente = false;
function guardar() {
  if (pendiente) return;
  pendiente = true;
  queueMicrotask(() => {
    pendiente = false;
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado));
    } catch (e) {
      console.error('No se pudo guardar el estado', e);
    }
    oyentes.forEach(f => f(estado));
  });
}

cargar();

export const obtener = () => estado;

/** Aplica un cambio y persiste. `fn` recibe el estado y lo muta. */
export function cambiar(fn) {
  fn(estado);
  guardar();
  return estado;
}

export function alCambiar(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

// ---------- Gastos ----------

export function anotarGasto({ fecha, categoria, importe, nota = '' }) {
  const g = { id: crypto.randomUUID?.() ?? String(Date.now() + Math.random()), fecha, categoria, importe: +importe, nota };
  cambiar(s => { s.gastos.push(g); });
  return g;
}

export function borrarGasto(id) {
  cambiar(s => { s.gastos = s.gastos.filter(g => g.id !== id); });
}

export const gastosDe = (fecha) => estado.gastos.filter(g => g.fecha === fecha);
export const totalGastado = () => estado.gastos.reduce((t, g) => t + (+g.importe || 0), 0);
export const totalDe = (fecha) => gastosDe(fecha).reduce((t, g) => t + (+g.importe || 0), 0);

// ---------- Interruptores ----------

export function alternar(mapa, clave) {
  cambiar(s => {
    if (s[mapa][clave]) delete s[mapa][clave];
    else s[mapa][clave] = true;
  });
}

export function fijarReserva(id, valor) {
  cambiar(s => { s.reservas_estado[id] = valor; });
}

export function fijarPrioridad(id, valor) {
  cambiar(s => { s.prioridades[id] = valor; });
}

/** Devuelve una parada a la prioridad calculada por defecto. */
export function olvidarPrioridad(id) {
  cambiar(s => { delete s.prioridades[id]; });
}

export function fijarNota(clave, texto) {
  cambiar(s => {
    const t = String(texto || '').trim();
    if (t) s.notas[clave] = t; else delete s.notas[clave];
  });
}

export function fijarAjuste(clave, valor) {
  cambiar(s => { s.ajustes[clave] = valor; });
}

// ---------- Itinerario editado ----------

export function fijarOrden(dia, ids) {
  cambiar(s => { s.itinerario_editado[dia] = ids.slice(); });
}

/** Mueve una parada a otro día (o la devuelve al suyo con `null`). */
export function reasignar(id, dia) {
  cambiar(s => {
    if (dia === null) delete s.reasignaciones[id];
    else s.reasignaciones[id] = Number(dia);
  });
}

/** Devuelve el día a su plan original. `ids` son las paradas de ese día. */
export function resetearDia(dia, ids = []) {
  const n = Number(dia);
  cambiar(s => {
    delete s.itinerario_editado[dia];
    s.lugares_extra = s.lugares_extra.filter(l => l.dia !== n);
    for (const id of ids) delete s.lugares_ocultos[id];
    // Las paradas que se trajeron aquí vuelven a su día, y las que se
    // llevaron de aquí a otro sitio también.
    for (const [id, destino] of Object.entries(s.reasignaciones)) {
      if (Number(destino) === n) delete s.reasignaciones[id];
    }
    for (const id of ids) delete s.reasignaciones[id];
  });
}

let siguienteExtra = -1;
export function anadirLugar({ dia, nombre, lat, lon, nota = '', categoria = 'ver' }) {
  const usados = estado.lugares_extra.map(l => l.id);
  while (usados.includes(siguienteExtra)) siguienteExtra--;
  const lugar = { id: siguienteExtra--, dia, nombre, lat: +lat, lon: +lon, nota, categoria, extra: true };
  cambiar(s => { s.lugares_extra.push(lugar); });
  return lugar;
}

export function borrarLugarExtra(id) {
  cambiar(s => {
    s.lugares_extra = s.lugares_extra.filter(l => l.id !== id);
    for (const d of Object.keys(s.itinerario_editado)) {
      s.itinerario_editado[d] = s.itinerario_editado[d].filter(x => x !== id);
    }
  });
}

// ---------- Export / import ----------

export function exportar() {
  return JSON.stringify({ ...estado, exportado: new Date().toISOString() }, null, 2);
}

export function importar(texto) {
  const datos = JSON.parse(texto);
  if (typeof datos !== 'object' || datos === null) throw new Error('El fichero no contiene un objeto JSON.');
  if (!('gastos' in datos) && !('ajustes' in datos)) throw new Error('No parece una copia de seguridad de esta app.');
  estado = fusionar(PLANTILLA(), datos);
  guardar();
  return estado;
}

export function borrarTodo() {
  estado = PLANTILLA();
  guardar();
}
