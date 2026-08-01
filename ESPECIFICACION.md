# Encargo: app interactiva del viaje a Italia (14–25 agosto 2026)

> **Para quien lo lea (Claude Code u otro agente):** este documento es la especificación completa.
> Todos los datos del viaje están en **`datos-viaje.json`** — es la fuente de la verdad, no reescribas
> el contenido a mano ni lo hardcodees en componentes. La guía en PDF/HTML se adjunta solo como
> referencia de contenido y tono, no como código a reutilizar.

---

## 1. El encargo en una frase

Convertir una guía de viaje estática (51 páginas de PDF + un mapa Leaflet) en una **aplicación web
que funcione en el móvil, sin conexión, dentro de un coche, en Italia, en agosto**, y que además
deje **registrar lo que pasa de verdad**: gastos reales, reservas hechas, paradas completadas y
cambios sobre la marcha.

---

## 2. Contexto del viaje

| | |
|---|---|
| Fechas | Llegada en ferri a **Civitavecchia el viernes 14 de agosto a las 22:00**; salida el **martes 25 a las 17:00** |
| Ruta | Anillo de **1.950 km** sin repetir tramo: Roma → Siena (Palio) → Toscana → Cinque Terre → Emilia → Venecia → Rávena → San Marino → Asís → Roma |
| Vehículo | **Renault Modus**. Importante: está matriculado como *autovettura* (turismo), **no** como autocaravana — eso cambia qué normativa italiana le aplica |
| Viajero | **Solo**, primer viaje a Italia, **presupuesto mínimo**, **duerme en el coche** 11 noches |
| Presupuesto | 568 € (mínimo) / **845 € (previsto)** / 1.200 € (holgado) |

---

## 3. Condiciones reales de uso — esto manda sobre cualquier decisión de diseño

Léelas antes de elegir stack o diseñar pantallas. Casi todos los requisitos raros de este documento
salen de aquí.

1. **Va a haber tramos sin datos.** Roaming de la UE, sí, pero en los senderos de Cinque Terre, en
   los Apeninos y en la E45 la cobertura desaparece. **La app tiene que ser útil al 100 % en modo
   avión.** Si algo solo funciona online, no sirve.
2. **Se consulta al sol, a 36 °C, con el móvil a media pantalla.** Nada de gris claro sobre blanco:
   contraste alto de verdad y tipografía grande.
3. **Se consulta también de noche, dentro del coche.** Hace falta un **modo nocturno «rojo»** que no
   destroce la visión nocturna ni ilumine el habitáculo entero.
4. **La batería es un recurso escaso** (se duerme en el coche, se carga por mechero). Sin GPS en
   segundo plano, sin animaciones caras, sin polling.
5. **Se usa con una mano, de pie, andando o en el asiento del conductor.** Navegación en la parte
   inferior, objetivos táctiles de 44 px como mínimo.
6. **La pregunta más frecuente será: «son las 14:30 del día 19, ¿qué hago ahora?»** Esa respuesta
   tiene que estar en la primera pantalla, sin buscar nada.
7. **El dinero importa mucho.** Es un viaje de presupuesto mínimo: registrar un gasto tiene que
   costar **tres toques**, y en todo momento debe saber cuánto le queda al día.
8. **El plan va a cambiar.** Habrá días en que llegue tarde, en que llueva o en que decida saltarse
   algo. La app debe permitir **editar el itinerario** y recalcular sola.

---

## 4. Qué existe ya (inputs del repositorio)

| Archivo | Qué es | Cómo usarlo |
|---|---|---|
| **`datos-viaje.json`** | Todo el viaje estructurado: 12 días, 77 lugares con coordenadas, 7 alojamientos, presupuesto, 9 reservas, 27 ítems de equipaje, abonos de transporte, peajes, reglas de ZTL, eventos, tours, audioguías | **Fuente de la verdad.** Cárgalo, no lo dupliques |
| `Italia-agosto-2026-guia.html` / `.pdf` | La guía completa, 51 páginas | Referencia de contenido y de tono. Puedes extraer texto largo de aquí, pero no reutilices su CSS |
| `Italia-agosto-2026-mapa.html` | Mapa Leaflet ya funcional con los 77 puntos, filtros por día y categoría, Leaflet incrustado | **Punto de partida del módulo de mapa.** La lógica de filtros y los `divIcon` ya están resueltos |

---

## 5. Alcance

### 5.1 MVP — sin esto no sirve

- **[A] Pantalla «Hoy»** con el «qué toca ahora»
- **[B] Itinerario** día a día, navegable y **editable**
- **[C] Mapa** offline con filtros y navegación externa
- **[D] Presupuesto** con registro de gasto real
- **[E] Listas**: equipaje y reservas, con estado persistente
- **[F] Consulta**: buscador y fichas de referencia (ZTL, aparcamientos, comida, frases, emergencias)
- **Offline total** + persistencia local + exportar/importar estado

### 5.2 Después, si sobra tiempo

Notas y fotos por parada · modo nocturno rojo · widget de amanecer/ocaso · registro de repostajes con
consumo real · «qué tengo cerca» por geolocalización puntual · compartir el día por WhatsApp.

---

## 6. Pantallas

### [A] Hoy / Ahora — pantalla de inicio

Es la pantalla que más se va a mirar. Debe responder en un vistazo, sin scroll, a: *dónde estoy en el
viaje, qué toca ahora, qué viene después y cuánto llevo gastado hoy*.

- **Antes del viaje**: cuenta atrás + las reservas críticas pendientes (Coliseo y Vaticano) en grande.
- **Durante el viaje**: detecta la fecha real y resuelve el día. Bloque grande **«AHORA»** con la
  franja horaria en curso según la hora del sistema, y debajo **«DESPUÉS»** con la siguiente.
- Botón **Navegar** al siguiente punto con coordenadas (abre Google Maps / Waze / Apple Maps).
- **Aviso del día** si lo hay (campo `dias[].aviso`): tráfico bollino rosso, museos cerrados, el
  mercado de Pisa los miércoles…
- Barra de **gasto de hoy vs. previsto** (`presupuesto.diario_recomendado`).
- Amanecer y ocaso del día (`dias[].amanecer` / `.ocaso`), porque el itinerario se organiza alrededor
  de la luz.
- Selector manual de día, por si quiere consultar otro.

### [B] Itinerario

- Lista de los 12 días con cabecera: etiqueta, fecha, título, **km y tiempo de conducción**, dónde
  duerme y coste previsto.
- Al abrir un día: sus lugares en orden, agrupados por franja horaria, con descripción y precio.
- **Marcar parada como hecha** (persistente).
- **Editar**: reordenar paradas dentro del día, ocultarlas, moverlas a otro día o añadir una nueva
  (nombre + coordenadas + nota). Al editar, **recalcula km, tiempo y coste del día** y avisa si el día
  se pasa de ~4 h de volante.
- Botón **«resetear al plan original»** — importante, porque tras trastear querrá volver.

### [C] Mapa

Parte de `Italia-agosto-2026-mapa.html`, que ya funciona.

- Filtros por **día** y por **categoría** (las 6 de `categorias`).
- Polilínea de la ruta (`ruta_polilinea`).
- Ficha de cada punto con descripción, precio y **botón de navegación externa**.
- **Tiles offline**: precachea el corredor de la ruta a zoom 8-13 y las 8 ciudades principales a zoom
  14-16. Descarga bajo demanda desde una pantalla de ajustes («Descargar mapas · ~XX MB»), nunca
  automáticamente. Si no hay tiles, el mapa debe seguir mostrando puntos y ruta sobre fondo liso, con
  un aviso — **nunca una pantalla en blanco**.
- **«Cerca de mí»**: una lectura puntual de GPS bajo demanda (no continua) que ordene los puntos por
  distancia.
- Marca las **coordenadas aproximadas** (`lugares[].coords_aproximadas === true`, los aparcamientos)
  con un indicador visual y el aviso de que la dirección del texto es la buena.

### [D] Presupuesto

La funcionalidad que más valor añade después del «ahora».

- **Previsto vs. real**, global y por día.
- **Registro rápido de gasto: tres toques.** Importe con teclado numérico grande, categoría
  (combustible, peajes, dormir, aparcar, transporte, entradas, comida, otros) y listo — la fecha se
  pone sola.
- Gráfico de **gasto acumulado** contra la línea del presupuesto previsto (845 €).
- **«Te quedan X € y N días → Y €/día»**, recalculado con lo gastado de verdad.
- Comparador de escenarios: mínimo / previsto / holgado (`presupuesto.escenarios`).
- Calculadora de combustible: km × consumo × precio/l, con gasolina y gasóleo (ojo: en Italia el
  gasóleo es **más caro**).

### [E] Listas

- **Equipaje**: 27 ítems agrupados, con los `imprescindible: true` destacados y contador de progreso.
- **Reservas**: 9 entradas con `prioridad` (crítica / alta / media / opcional), precio, URL y nota.
  Estado por reserva: *pendiente → reservada → pagada*. Las críticas deben **cantar** hasta marcarse.
  Muestra también la lista `no_reservar`, que evita gastos innecesarios.

### [F] Consulta

- **Buscador** sobre lugares, días y fichas.
- Fichas de referencia, todas offline:
  - **ZTL y aparcamientos** (`conduccion.ztl`) — la información que evita multas de 80-330 €
  - **Abonos de transporte** con el veredicto ya calculado (`transporte.abonos`)
  - **Descuento joven UE 18-25**: 2 € en museos estatales (`transporte.descuento_joven`)
  - **Comer barato**, sitios con nombre y calle
  - **Tours**: qué pagar y qué no (`tours`)
  - **Frases útiles en italiano**
  - **Emergencias**: 112, consulado, seguro
- **`pendientes_de_verificar`**: 10 datos que hay que comprobar antes de salir, con enlace. Muéstralos
  como una checklist previa al viaje.

---

## 7. Modelo de datos

Estructura de `datos-viaje.json`:

```
meta                    · fechas, vehículo, km, presupuesto global
categorias              · 6 categorías con color
dias[12]                · dia, etiqueta, fecha, dia_semana, titulo, etapa, km,
                          minutos_conduccion, dormir_ref, amanecer, ocaso, aviso, lugares[]
lugares[77]             · id, dia, categoria, nombre, lat, lon, descripcion,
                          precio, coords_aproximadas
ruta_polilinea[26]      · [lat, lon] en orden de recorrido
noches[7]               · id, fecha, nombre, lat, lon, precio_eur, servicios[], nota
presupuesto             · partidas[] × 3 escenarios, totales, por_dia,
                          diario_recomendado[12]
reservas[9]             · id, prioridad, que, dia, fecha, hora, precio_eur, url, nota
no_reservar[]           · lista de cosas que NO hay que reservar
equipaje[27]            · grupo, item, imprescindible
transporte              · abonos[] con veredicto y razón, billetes_sueltos[],
                          descuento_joven
conduccion              · combustible, peajes[], ztl (regla + ciudades), trafico_agosto_2026
eventos[8]              · fecha_inicio, fecha_fin, nombre, lugar, precio, en_ruta
tours[8]                · nombre, dia, precio_eur, veredicto, razon
audioguias[3]           · nombre, precio, idioma, offline, cubre[]
pendientes_de_verificar · 10 avisos con lo que hay que confirmar antes de salir
```

**Estado del usuario** (aparte, en almacenamiento local, nunca dentro del JSON de origen):

```json
{
  "version": 1,
  "gastos":            [{"id","fecha","categoria","importe","nota"}],
  "reservas_estado":   {"coliseo": "reservada"},
  "equipaje_estado":   {"3": true},
  "paradas_hechas":    {"12": true},
  "itinerario_editado":{"3": [ids en orden]},
  "notas":             {"12": "texto"},
  "ajustes":           {"tema":"auto|claro|oscuro|nocturno-rojo","combustible":"gasolina|gasoleo"}
}
```

Con **exportar / importar en JSON**, porque perder el registro de gastos a mitad de viaje sería un
fastidio y no hay backend que lo recupere.

---

## 8. Requisitos no funcionales

- **Offline-first de verdad**: PWA instalable, service worker con precache de todo el shell y los
  datos. Probado en modo avión desde un arranque en frío.
- **Sin backend, sin cuentas, sin login.** Todo local.
- **Sin dependencias externas en tiempo de ejecución** salvo los tiles del mapa (y esos, cacheados).
  Nada de CDN: empaquétalo todo.
- **Persistencia**: IndexedDB (o localStorage si el volumen lo permite), con export/import manual.
- **Rendimiento**: primer render por debajo de 2 s en un móvil modesto; bundle sin tiles por debajo
  de 500 KB.
- **Accesibilidad y legibilidad**: contraste mínimo AA, cuerpo de texto ≥16 px, objetivos táctiles
  ≥44 px, funciona en vertical a 360 px de ancho.
- **Idioma**: español. Los topónimos y nombres de sitios, en italiano tal y como están en el JSON —
  son los que verá en los carteles.
- **Zona horaria**: Europe/Rome.

---

## 9. Stack sugerido

Sugerencia, no imposición: si tienes un motivo mejor, aplícalo y explícalo en el README.

- **Vite + React + TypeScript** · **Tailwind** · **Leaflet** (ya en uso, sin dependencia de tiles
  propietarios) · **vite-plugin-pwa** (Workbox) · **Dexie** para IndexedDB · **Recharts** para el
  gráfico de gasto acumulado.
- Alternativa igual de válida: **una sola página HTML sin build**, como el mapa actual. Es más fácil
  de abrir desde cualquier sitio y de guardar en el móvil sin instalar nada. Si el proyecto se
  complica poco, esta opción es mejor que un framework.

---

## 10. Criterios de aceptación

Verificables uno a uno:

1. En **modo avión**, arranque en frío: cargan todas las pantallas, el itinerario completo, los 77
   puntos del mapa y las fichas de consulta.
2. La pantalla **Hoy** muestra la franja correcta al cambiar la hora del sistema al 19 de agosto a
   las 14:30.
3. Registrar un gasto de 12 € en «comida» son **tres toques** y aparece en el acumulado al instante.
4. Reordenar dos paradas del día 3 **recalcula** los km y el coste del día, y sobrevive a recargar.
5. **Exportar** el estado, borrar los datos del navegador, **importar** el archivo: todo vuelve.
6. En un móvil de 360 px de ancho no hay scroll horizontal en ninguna pantalla.
7. Sin tiles cacheados, el mapa **muestra puntos y ruta** sobre fondo liso con un aviso, no una
   pantalla en blanco.
8. Pulsar **Navegar** en cualquier punto abre la app de mapas del sistema con esas coordenadas.
9. Las reservas de prioridad **crítica** aparecen destacadas en Hoy hasta marcarlas como hechas.
10. Lighthouse: PWA instalable, y accesibilidad ≥ 90.

---

## 11. Fuera de alcance

No hagas nada de esto sin preguntar antes:

- Backend, base de datos remota, cuentas de usuario o sincronización entre dispositivos.
- Reservar o comprar entradas desde la app (solo enlazar a las webs oficiales).
- Integrar el tiempo, tráfico o precios en vivo: rompe el modo offline y añade claves de API.
- Traducir la app a otros idiomas.
- Cambiar la ruta o el contenido del viaje. **El itinerario está cerrado y verificado**: si detectas
  un error de datos, anótalo en el README, no lo corrijas por tu cuenta.

---

## 12. Lo que aún no está confirmado

El campo `pendientes_de_verificar` del JSON trae 10 datos que dependen de información que todavía no
se ha publicado (el horario definitivo del Palio sale entre el 10 y el 13 de agosto) o que las
fuentes dan con discrepancias. **No los inventes ni los "arregles"**: la app debe mostrarlos como
avisos, con su enlace, para comprobarlos antes de salir.

---

## Prompt de arranque

Para pegar tal cual en Claude Code:

```
Lee ESPECIFICACION.md y datos-viaje.json.

Construye la app descrita, empezando por el MVP de la sección 5.1 y en este orden:
1. Estructura del proyecto + carga de datos + estado persistente con export/import
2. Pantalla Hoy
3. Itinerario (primero solo lectura, después edición)
4. Mapa (parte de Italia-agosto-2026-mapa.html, que ya funciona)
5. Presupuesto
6. Listas y Consulta
7. PWA, service worker y tiles offline

Después de cada bloque, para y enséñame qué has hecho antes de seguir.
Al terminar, recorre los 10 criterios de aceptación de la sección 10 y dime cuáles cumple
y cuáles no.
```
