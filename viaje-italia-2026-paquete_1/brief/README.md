# Viaje a Italia · 14–25 agosto 2026 — paquete para desarrollo

Empieza por **`ESPECIFICACION.md`**: contiene el encargo completo, las pantallas,
los criterios de aceptación y un prompt de arranque al final.

- `ESPECIFICACION.md` — qué construir y por qué
- `datos-viaje.json` — **fuente de la verdad**: 12 días, 77 lugares con coordenadas,
  presupuesto, reservas, equipaje, abonos, ZTL, eventos. Cárgalo, no lo dupliques.
- `referencia/Italia-agosto-2026-mapa.html` — mapa Leaflet ya funcional (filtros por día
  y categoría). **Punto de partida del módulo de mapa.**
- `referencia/Italia-agosto-2026-guia.html` y `.pdf` — la guía completa de 51 páginas.
  Referencia de contenido y tono; no reutilices su CSS.

Contexto en una línea: viajero solo, Renault Modus, duerme en el coche, presupuesto mínimo,
anillo de 1.950 km desde Civitavecchia. La app se usará **en el móvil, dentro de un coche,
en agosto, con tramos sin cobertura**.
