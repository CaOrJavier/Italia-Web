# Italia 2026 — app del viaje

App web del viaje en coche por Italia del **14 al 25 de agosto de 2026**. Funciona
entera **sin conexión**, se instala en la pantalla de inicio y no tiene servidor ni cuentas:
todo lo que registres vive en tu móvil.

Implementa el encargo de [`../ESPECIFICACION.md`](../ESPECIFICACION.md).

---

## Arrancarla

Necesita un servidor local (con doble clic sobre `index.html` no funciona: los módulos
de JavaScript y el service worker lo impiden).

```bash
python -m http.server 8123 --directory app
```

Y abre <http://localhost:8123>. Con Node en vez de Python:

```bash
npx --yes serve app -l 8123
```

## Ponerla en el móvil

Es lo que hay que hacer antes de salir de viaje:

1. Sube la carpeta `app/` a cualquier hosting estático (Netlify Drop, GitHub Pages,
   Cloudflare Pages). Tiene que ser **HTTPS**, si no el service worker no arranca.
2. Abre la dirección en el móvil → menú del navegador → **Añadir a pantalla de inicio**.
3. Dentro de la app: **Ajustes → Mapas sin conexión → Descargar**. Con wifi, y con tiempo.
4. Comprueba que funciona: pon el móvil en **modo avión**, ciérrala del todo y ábrela.

---

## Qué hay dentro

| Pantalla | Qué resuelve |
|---|---|
| **Hoy** | «Son las 14:30 del día 19, ¿qué hago ahora?». Bloque AHORA con la franja horaria en curso y DESPUÉS con la siguiente, aviso del día, amanecer/ocaso, gasto de hoy y botón Navegar a la siguiente parada. Antes de salir, cuenta atrás y reservas críticas |
| **Ruta** | Los 12 días con km, tiempo de volante y coste. Al abrir uno, el plan hora a hora con sus paradas. Se marcan como hechas, se reordenan, se ocultan, se mueven de día o se añaden nuevas, y el día se recalcula |
| **Mapa · Puntos** | Los puntos del viaje con filtros por día y categoría, la polilínea de la ruta, ficha de cada punto y navegación externa. «Qué tengo cerca» con una única lectura de GPS |
| **Mapa · Trayecto** | Resumen del anillo completo: salida y llegada con fecha y hora, totales (km, horas de volante, días, noches) y las 12 etapas con sus km, tiempo y acumulado. La ruta va coloreada por día; al tocar una etapa el mapa se acerca a ella y atenúa el resto |
| **Mapa · Puntos** (filtro de ruta) | Sobre los puntos del itinerario cargado, un selector de ruta: al elegir una, la línea pasa a ser la suya y **los puntos que quedan fuera se apagan en gris** en vez de desaparecer — así se ve lo que se pierde. El contador dice cuántos entran («47 de 70 en la ruta») y la ficha de un punto apagado avisa de que con esa ruta no se visita |
| **Mapa · Las 3 rutas** | Las tres rutas alternativas dibujadas sobre el mismo mapa, cada una de su color, más el itinerario cargado a trazos grises para compararlas contra él. Se ven las tres a la vez o una sola con todas sus paradas, y desde la pestaña Alternativas se enlaza directo a cada una |
| **Gasto** | Registro en tres toques, previsto contra real, gráfico de acumulado, «te quedan X € → Y €/día», comparador de escenarios y calculadora de combustible |
| **Guía** | Buscador sobre todo el viaje, reservas con estado, equipaje, checklist de «antes de salir» y las fichas de consulta: ZTL, peajes, abonos, dormir, tours, eventos, riesgos, apps y teléfonos |
| **Guía · Comer** | Qué comer en cada una de las 6 regiones, marcando lo que no hay que saltarse, con precios y sitios con nombre y calle. Cada región muestra en qué días cae, y arriba está el coste de comer lo típico a diario frente al plan previsto |
| **Alternativas** | Pestaña propia arriba a la izquierda, fuera de la navegación de abajo. Las **tres rutas alternativas** al itinerario cargado, construidas sobre lo innegociable (Roma, Florencia y Cinque Terre) y con Saturnia en las tres: día a día, con coste, balance de qué ganas y qué pierdes y qué falta por verificar. Es de lectura: no toca el itinerario ni el estado hasta que se elija una |
| **Alternativas · Cara a cara** | Los 12 días de las tres rutas en columnas, sin subir y bajar: cabecera fija, borde del color de la ruta en lo que cada una hace distinto, ▼/▲ en quién conduce menos y más ese día, botón para ver solo las filas que difieren, y cada celda abre el día entero con lo que hacen las otras dos |
| **Idioma** | La otra pestaña de la cabecera. Ocho reglas de pronunciación, el catalán como atajo, falsos amigos, frases por situación y números. Estaba dentro de Guía, pero es lo que se abre de pie delante de un mostrador: llegar costaba tres toques y un scroll horizontal |

Tres temas: claro, oscuro y **nocturno rojo** (sólo rojos sobre negro, para consultarla
de noche dentro del coche sin quemarse la visión).

---

## Decisiones

### Sin build

La especificación proponía Vite + React + Tailwind o «una sola página HTML sin build», y
recomendaba lo segundo si el proyecto no se complicaba. Está hecho **sin build**: HTML,
CSS y módulos ES nativos.

- No hay `node_modules`, ni paso de compilación, ni nada que se rompa dentro de un año.
- Se despliega copiando la carpeta.
- Todo el peso está a la vista: **472 KB** sin comprimir (el límite del encargo era 500 KB),
  y Leaflet (145 KB) sólo se descarga al abrir el mapa.
- No hay ni una dependencia en tiempo de ejecución más allá de las teselas del mapa.
  Leaflet 1.9.4 está vendorizado en `vendor/`, extraído del mapa de referencia.

El gráfico de gasto acumulado es SVG escrito a mano en vez de Recharts, y la persistencia
es `localStorage` en vez de IndexedDB: el estado completo de un viaje de 12 días son unos
pocos KB. Las teselas del mapa, que sí pesan, van por la Cache API del service worker.

### Los datos derivados de la guía

`datos-viaje.json` es la fuente de la verdad y no se toca. Pero le faltaban dos cosas que
el encargo pedía y que **sí estaban en la guía en PDF/HTML**, así que se extraen de ahí en
vez de inventarlas:

| Fichero | De dónde sale | Para qué |
|---|---|---|
| `datos/franjas.json` | Los bloques `.slot` de la guía | Las franjas horarias reales de los 12 días (06:15 Salida, 09:00 Mañana…). Es lo que da de comer al bloque AHORA |
| `datos/fichas.json` | 8 secciones `<h2>` de la guía | Las fichas de consulta largas: dormir, aparcar, conducir, comer, tours, naturaleza, riesgos y apps/teléfonos/frases |
| `datos/comer.json` | La tabla «Qué probar en cada región» | Platos por región, cuáles son imprescindibles (los que la guía pone en negrita), precios y dónde comerlos. La correspondencia región → días se calcula buscando las ciudades de cada región en la etapa de cada día |
| `datos/acceso.json` | Las dos tablas de park&ride de la sección 6 | Dónde dejar el coche en cada ciudad, cómo se sigue hasta el centro y cuánto cuesta |

**Los tiempos de acceso a cada ciudad** (`accesoDe` en `datos.js`) salen de la guía cuando
los da (Florencia 22 min en tranvía, Lucca 15 a pie, Siena 10). Cuando no los da y el
trayecto es andando, se estiman con las coordenadas del aparcamiento y la visita más
cercana (×1,3 de rodeo, 4,5 km/h) y se marcan como estimados. **Cuando hay metro, tranvía o
lanzadera no se estima nada**: la frecuencia no está en los datos y un número inventado ahí
haría perder un tren. Al total se le suman 10 min de aparcar y 10 más de esperar el
transporte, porque nadie llega en el tiempo teórico.

Ambos se regeneran con:

```bash
node app/herramientas/extraer.mjs
```

Ese script también extrae Leaflet a `vendor/` y copia `datos-viaje.json`. Los iconos PNG
se generan con `node app/herramientas/iconos.mjs`. **Nada está escrito a mano**: si la guía
o el JSON cambian, se vuelve a lanzar el extractor.

### Partir la ruta por días

`ruta_polilinea` viene como **una sola línea de 26 puntos**, sin marcar a qué día
pertenece cada uno, así que no se podía colorear el trayecto por etapas. Resulta que cada
punto **coincide exactamente** (0,00 km de distancia) con un lugar o una noche del viaje,
así que cada uno se asigna al día de su punto más cercano. Como la ruta es un anillo y el
último punto vuelve al origen, se fuerza además que el día no retroceda. Los 12 días salen
cubiertos, sin huecos.

### La variante «Roma al final»

El plan original parte Roma entre el día 1 y el 11 porque **los Museos Vaticanos cierran el
14, el 15 y todos los domingos**: bajo ese plan, la mañana del 25 era la única ventana.
Comprobado que abren **de lunes a sábado, 08:00-20:00, última entrada a las 18:00**, el
lunes 24 por la tarde también sirve, y Roma cabe entera en los dos últimos días seguidos.

La variante se aplica desde *Itinerario* con un botón y **no toca `datos-viaje.json`**: se
escribe como edición del usuario (`reasignaciones` + `itinerario_editado` + `lugares_ocultos`)
y se deshace igual de fácil.

### Mover paradas entre días

`paradasDe(n)` construía la lista sólo con los ids que el JSON asigna a ese día, así que una
parada movida desde otro día **no resolvía a nada y desaparecía**: la función «Mover» llevaba
varios commits rota sin que se notara. Se arregló con `reasignaciones` en el estado, que
`lugaresBase` consulta en los dos sentidos — qué se ha ido de este día y qué ha venido.

### Densidad: lo secundario se pliega

Al ir añadiendo funciones la app se volvió difícil de leer. Medido antes de tocarla: la
lista de días tenía **66 etiquetas de colores** en una pantalla, el detalle de un día
ocupaba **5,6 pantallas** de scroll y la de comer **10,6**.

Lo que se hizo, por orden de impacto:

| Cambio | Efecto |
|---|---|
| Bloques secundarios plegados (`plegable()` en `ui.js`) con el titular y un resumen siempre visibles | Comer 10,6 → 2,6 pantallas · Presupuesto 3,9 → 1,9 |
| Datos del día como texto corrido en vez de una fila de pastillas | Lista de días de 66 → 6 etiquetas |
| Títulos de sección de VERSALITAS con tracking a frase normal de 15 px | Menos ruido, se leen antes |
| En Hoy, el bloque «AHORA» sube al principio | Visible sin scroll, que es lo que pide el encargo |

Los pliegues **recuerdan lo que dejas abierto** mientras dure la sesión (en memoria, no en
el estado guardado): sin eso, cada vez que marcas una parada como hecha se te cerraban.

### Prioridades: por qué las decide el usuario

`datos-viaje.json` **no trae prioridad por parada**, y probé a deducirla de tres señales
distintas antes de rendirme:

| Señal | Resultado |
|---|---|
| Reserva asociada + nombre en el título del día | 3 imprescindibles de 58 — inútil |
| Negritas de la guía en el relato de cada día | 41 de 58, y marcaba la Loggia dei Lanzi pero no el Duomo de Florencia |

Ninguna es fiable, porque «imprescindible» depende del viajero, no del dato. Así que la app
usa un **valor de partida deliberadamente conservador** (imprescindible sólo si hay reserva
crítica o alta; miradores, playas y sitios de comer como «si va bien»; el resto
recomendable) y ofrece una pantalla de triaje —*Itinerario → Poner mis prioridades*— con
las 58 visitas y tres botones cada una. Se hace una vez.

El pago está en el botón **Día ligero** de cada día: oculta de golpe todas las «si va bien»
y recalcula km, tiempo y coste con el motor de edición que ya existía. Es reversible.

### El margen del día

Para responder a «¿voy apurado?» sin inventar duraciones de visita (que no están en los
datos): **luz aprovechable − tiempo de volante = tiempo libre**, dividido entre las paradas
no logísticas. Se avisa por debajo de 45 min por parada. Con el plan original ningún día
baja de ese umbral.

### Los tramos de conducción seguida

Viajando solo, lo que cansa no es el total del día sino el tirón sin parar. El JSON sólo
trae `minutos_conduccion` por día, así que la app deduce los tramos: agrupa las paradas
que están a menos de **15 km** entre sí (dentro de una ciudad se va a pie, no en coche) y
lo que queda entre grupo y grupo son los trayectos reales; los km y los minutos del día se
reparten en proporción.

El aviso salta a partir de **3 h seguidas** (`LIMITE_SEGUIDO` en `datos.js`), no del total
del día. Con el plan original **ningún día lo supera**: el peor es el D2, Bracciano → Siena,
195 km y 2 h 30 del tirón. Se recalcula al editar el día, que es donde está la gracia:
mover una parada puede convertir dos tramos cortos en uno largo.

### Descuentos por edad

`ajustes.edad` (Ajustes → Tu edad) decide qué se muestra. Sólo queda un corte en los datos:

- **Museos estatales italianos**: 2 € de 18 a 25 inclusive. Por encima, tarifa completa.

La ficha de *Guía → Fichas → Abonos* se adapta: si la edad queda fuera del tramo 18-25 no
anuncia el descuento en verde, sino que dice **cuánto se paga de más** (los 55 € que el
propio JSON estima). Anunciar un descuento a quien no le aplica es peor que no decir nada.

### El recálculo al editar un día

Cuando reordenas, ocultas o añades paradas hay que recalcular km y tiempo, pero la app no
tiene servicio de rutas (rompería el modo offline y necesitaría clave de API). Lo que hace:

1. Mide la cadena en línea recta del plan original: dormir anterior → paradas → dormir.
2. La compara con los km reales del JSON y saca un **factor de sinuosidad** de ese día.
3. Aplica el mismo factor al orden nuevo, y el tiempo con la velocidad media del día.

Es una estimación, y la app lo dice: los km editados salen con asterisco y con el valor
original al lado. Sirve para decidir («esto me añade una hora»), no para navegar.

Si el día pasa de **4 h de volante** avisa. **«Volver al plan original»** deshace el orden,
las paradas ocultas y las añadidas de ese día, sin tocar gastos, notas ni paradas hechas.

### El service worker no revalida fichero a fichero

Cada generación de caché se escribe **entera durante `install`** y nunca se actualiza pieza
a pieza. Con la estrategia habitual de «caché primero, refresco en segundo plano» una
recarga a destiempo mezcla módulos de dos versiones y la app no arranca — pasó durante el
desarrollo. Si falta algo esencial al precachear, la instalación falla a propósito y se
queda la versión anterior, que al menos es coherente.

> **Si tocas cualquier fichero de la app, sube `VERSION` en `sw.js`.** Es lo único que
> dispara la actualización.

### Teselas offline

`Ajustes → Mapas sin conexión` descarga el corredor de la ruta (zoom 8-12) y 10 ciudades
donde se anda a pie (zoom 13-15). Nunca se descarga sola. Va con concurrencia 3 y una
pausa entre peticiones: las teselas de OpenStreetMap son un servicio donado y su política
pide no hacer descargas masivas agresivas.

**Si no hay teselas, el mapa no se queda en blanco**: sigue mostrando todos los puntos y la
ruta sobre fondo liso, con un aviso.

---

## Estado del usuario

En `localStorage`, bajo `italia2026:estado`. Exportable e importable como JSON desde Ajustes.

```jsonc
{
  "version": 1,
  "gastos":             [{ "id", "fecha", "categoria", "importe", "nota" }],
  "reservas_estado":    { "coliseo": "reservada" },   // pendiente | reservada | pagada
  "equipaje_estado":    { "3": true },                // y "v0".."v9" para "antes de salir"
  "paradas_hechas":     { "12": true },
  "itinerario_editado": { "3": [24, 23, 25] },
  "lugares_ocultos":    { "12": true },               // añadido sobre el esquema del encargo
  "lugares_extra":      [{ "id": -1, "dia": 3, "nombre", "lat", "lon", "nota" }],  // ídem
  "notas":              { "dia:3": "texto" },
  "ajustes":            { "tema", "combustible", "consumo" }
}
```

`lugares_ocultos` y `lugares_extra` no estaban en el esquema del encargo, pero ocultar y
añadir paradas —que sí se pedían— no se pueden guardar sólo con un array de orden. Los ids
de las paradas añadidas son **negativos**, para no chocar nunca con los 0-76 del JSON.

---

## Los 10 criterios de aceptación

Probados uno a uno en el navegador, no de memoria.

| # | Criterio | Resultado |
|---|---|---|
| 1 | Modo avión, arranque en frío: cargan todas las pantallas, itinerario, puntos del mapa y fichas | **Cumple.** Probado parando el servidor y recargando: las pantallas, los puntos, la ruta y el buscador funcionan |
| 2 | Hoy muestra la franja correcta el 19 de agosto a las 14:30 | **Cumple.** Con el reloj puesto a esa hora resuelve D5, AHORA = 10:45 Mediodía, DESPUÉS = 15:00 Tarde |
| 3 | Anotar 12 € en comida son tres toques y aparece al instante | **Cumple.** Botón Gasto → «1», «2» → «Comida». La categoría guarda y cierra: no hay botón de confirmar |
| 4 | Reordenar dos paradas del día 3 recalcula km y coste, y sobrevive a recargar | **Cumple.** 165 km → 218 km, 3 h → 3 h 58, marcado como estimación. Persiste tras recargar |
| 5 | Exportar, borrar los datos, importar: todo vuelve | **Cumple.** Gastos, reservas e itinerario editado vuelven idénticos |
| 6 | A 360 px no hay scroll horizontal en ninguna pantalla | **Cumple.** Comprobado en las 10 rutas: `scrollWidth == clientWidth` |
| 7 | Sin teselas, el mapa muestra puntos y ruta con aviso, no una pantalla en blanco | **Cumple.** Probado apuntando las teselas a un host inalcanzable: todos los puntos + ruta + aviso |
| 8 | Navegar abre la app de mapas con esas coordenadas | **Cumple.** Ofrece Google Maps, Waze, Apple Maps, el esquema `geo:` y copiar coordenadas |
| 9 | Las reservas críticas se ven en Hoy hasta marcarlas | **Cumple.** Coliseo y Vaticano salen en rojo arriba del todo y desaparecen al marcarlas |
| 10 | Lighthouse: PWA instalable y accesibilidad ≥ 90 | **Parcial.** No he podido ejecutar Lighthouse aquí. Instalable sí (manifest + iconos + service worker + `beforeinstallprompt`). En accesibilidad se han auditado a mano y corregido: todo control tiene nombre accesible, ningún objetivo táctil por debajo de 24 px (44 px los principales, incluidos los pines del mapa), contraste AA en los tres temas (texto ≥ 5,3:1, bordes de control ≥ 3,1:1), `lang`, landmarks y un solo `h1`. **Pásale Lighthouse tú para tener el número.** |

---

## Cosas que conviene saber

- **Las fechas y horas van en `Europe/Rome`**, no en la del móvil: si cruzas husos, la app
  sigue el horario italiano, que es el que manda para los horarios de museos y ferris.
- **Los precios de los rangos se cuentan por el extremo bajo** («5-8 €» cuenta como 5 €)
  al sumar el coste de las paradas. Es un viaje de presupuesto mínimo.
- Los gastos anotados fuera de las fechas del viaje se imputan al día más cercano, porque
  el presupuesto está organizado por días de viaje.
- **`pendientes_de_verificar` no se ha tocado.** Los 10 datos sin confirmar salen tal cual
  en *Guía → Antes de salir*, con su enlace y una casilla para irlos comprobando.
- **No se ha corregido ningún dato del viaje.** Revisando el JSON no he encontrado
  incoherencias que reportar.
- El navegador puede tirar `localStorage` si va muy justo de espacio. **Exporta la copia de
  vez en cuando durante el viaje** — es el único respaldo que hay.

## Fuera de alcance, como pedía el encargo

Sin backend, sin cuentas, sin sincronización. No se compran ni reservan entradas desde la
app (sólo se enlaza a las webs oficiales). No hay tiempo, tráfico ni precios en vivo.
La ruta y el contenido del viaje no se han modificado.

---

Mapas © colaboradores de OpenStreetMap · Leaflet 1.9.4
