// Una ilustración de línea por día, dibujada a mano en SVG.
//
// Nada de fotos: pesarían megas, harían falta licencias y romperían el modo
// avión. Estas son trazos geométricos, ~1 KB cada una, heredan el color del
// texto (`currentColor`) y por tanto funcionan en los cuatro temas.

const marco = (contenido) =>
  `<svg class="ilus" viewBox="0 0 48 48" fill="none" stroke="currentColor"
     stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
     aria-hidden="true">${contenido}</svg>`;

const DIBUJOS = {
  // N0 · Civitavecchia: el ferri con el coche dentro
  ferri: `
    <path d="M9 32h30l-5 8H14z"/>
    <path d="M15 32v-8h13v8"/>
    <path d="M19 27h5"/>
    <path d="M32 24v-6"/>
    <path d="M6 44q5-3 9 0t9 0 9 0 9 0"/>`,

  // D1 · Roma: el Coliseo
  coliseo: `
    <path d="M7 39V21a17 11 0 0 1 34 0v18"/>
    <path d="M5 39h38"/>
    <path d="M13 39v-9a3.5 3.5 0 0 1 7 0v9"/>
    <path d="M24 39v-9a3.5 3.5 0 0 1 7 0v9"/>
    <path d="M35 39v-8"/>
    <path d="M8 27h32"/>`,

  // D2 · Siena: la Torre del Mangia sobre la piazza
  torre: `
    <path d="M20 41V11h7v30"/>
    <path d="M18 11h11v-4H18z"/>
    <path d="M20 7V4M23.5 7V4M27 7V4"/>
    <path d="M11 41h26"/>
    <path d="M8 44q8-4 16-4t16 4"/>`,

  // D3 · Toscana: cipreses en la colina
  cipreses: `
    <path d="M5 39q11-7 21-3t17-5"/>
    <path d="M14 39V28q0-9 3.5-11Q21 19 21 28v11"/>
    <path d="M27 39v-8q0-7 2.5-8.5Q32 24 32 31v8"/>
    <path d="M37 39v-6q0-5 2-6 2 1 2 6v6"/>
    <path d="M4 43h40"/>`,

  // D4 · Florencia: la cúpula de Brunelleschi y el campanile
  cupula: `
    <path d="M13 33q11-21 21 0"/>
    <path d="M21.5 13V9h4v4"/>
    <path d="M11 33h25v7H11z"/>
    <path d="M40 40V17h5v23"/>
    <path d="M40 22h5"/>
    <path d="M6 40h40"/>`,

  // D5 · Pisa: la torre que se cae
  pisa: `
    <g transform="rotate(9 24 40)">
      <path d="M19 40V13h10v27"/>
      <path d="M18 13h12"/>
      <path d="M19 21h10M19 29h10"/>
      <path d="M21 13V8h6v5"/>
    </g>
    <path d="M6 41h36"/>`,

  // D6 · Cinque Terre: las casas colgadas sobre el mar
  cinqueterre: `
    <path d="M4 34q7-15 17-18"/>
    <path d="M13 34v-7h7v7"/>
    <path d="M22 34v-11h7v11"/>
    <path d="M31 34v-8h8v8"/>
    <path d="M11 34h30"/>
    <path d="M4 41q5-3 9 0t9 0 9 0 9 0"/>
    <path d="M4 45q5-3 9 0t9 0 9 0 9 0"/>`,

  // D7 · Bolonia: las dos torres
  torres: `
    <path d="M15 42V9h6v33"/>
    <path d="M14 9h8"/>
    <path d="M29 42V17l6-1v26"/>
    <path d="M28 17l7-1"/>
    <path d="M9 42h32"/>
    <path d="M9 36h32"/>`,

  // D8 · Venecia: la góndola
  gondola: `
    <path d="M7 33q17 7 34 0"/>
    <path d="M9 33q3-4 7-4h16q4 0 7 4"/>
    <path d="M7 33l-2-9"/>
    <path d="M41 33l2-6"/>
    <path d="M30 29V17"/>
    <path d="M25 20l10-6"/>
    <path d="M5 41q5-3 9 0t9 0 9 0 9 0"/>`,

  // D9 · San Leo y San Marino: la torre sobre el peñasco
  penasco: `
    <path d="M4 43q7-12 16-15 11-4 24-3"/>
    <path d="M22 27V16h7v11"/>
    <path d="M21 16h9v-3h-9z"/>
    <path d="M22 13v-3M25.5 13v-3M29 13v-3"/>
    <path d="M17 27h17"/>`,

  // D10 · Asís: la basílica en la ladera
  basilica: `
    <path d="M4 41q13-4 21-11"/>
    <path d="M15 35h20v-9H15z"/>
    <path d="M19 35v-6a2.5 2.5 0 0 1 5 0v6"/>
    <path d="M28 35v-6a2.5 2.5 0 0 1 5 0v6"/>
    <path d="M15 26l10-6 10 6"/>
    <path d="M38 35V15h5v20"/>
    <path d="M13 41h32"/>`,

  // D11 · Vaticano: la cúpula de San Pedro y la columnata
  sanpedro: `
    <path d="M16 29q8-17 16 0"/>
    <path d="M22 12V8h4v4"/>
    <path d="M15 29h18v5H15z"/>
    <path d="M8 34h32v6H8z"/>
    <path d="M13 34v6M19 34v6M29 34v6M35 34v6"/>
    <path d="M5 40h38"/>`
};

/** Qué dibujo le toca a cada día del viaje. */
const POR_DIA = [
  'ferri', 'coliseo', 'torre', 'cipreses', 'cupula', 'pisa',
  'cinqueterre', 'torres', 'gondola', 'penasco', 'basilica', 'sanpedro'
];

export function ilustracionDia(n) {
  const d = DIBUJOS[POR_DIA[Number(n)]];
  return d ? marco(d) : '';
}

export const ilustracion = (nombre) => (DIBUJOS[nombre] ? marco(DIBUJOS[nombre]) : '');
