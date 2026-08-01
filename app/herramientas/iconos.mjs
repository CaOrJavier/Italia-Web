// Genera los iconos PNG de la PWA sin dependencias: un pin sobre fondo terracota.
import fs from 'node:fs';
import zlib from 'node:zlib';

const SALIDA = 'C:/Users/Javier/Desktop/italianweb/app/iconos';
fs.mkdirSync(SALIDA, { recursive: true });

const FONDO = [0x8c, 0x2f, 0x22];
const TINTA = [0xfb, 0xf8, 0xf4];

function crc32(buf) {
  let c, tabla = crc32.t;
  if (!tabla) {
    tabla = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabla[n] = c;
    }
  }
  c = -1;
  for (let i = 0; i < buf.length; i++) c = tabla[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

function png(ancho, alto, pixeles) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8;    // bits por canal
  ihdr[9] = 6;    // RGBA
  const filas = Buffer.alloc((ancho * 4 + 1) * alto);
  for (let y = 0; y < alto; y++) {
    filas[y * (ancho * 4 + 1)] = 0; // filtro "none"
    pixeles.copy(filas, y * (ancho * 4 + 1) + 1, y * ancho * 4, (y + 1) * ancho * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', zlib.deflateSync(filas, { level: 9 })),
    trozo('IEND', Buffer.alloc(0))
  ]);
}

/** Cobertura suavizada de un píxel, muestreando 3x3 dentro de él. */
function cobertura(x, y, dentro) {
  let n = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    if (dentro(x + (i + 0.5) / 3, y + (j + 0.5) / 3)) n++;
  }
  return n / 9;
}

function dibujar(lado) {
  const px = Buffer.alloc(lado * lado * 4);
  const c = lado / 2;
  const r = lado * 0.19;            // radio de la cabeza del pin
  const cy = lado * 0.42;           // centro de la cabeza
  const punta = lado * 0.78;        // vértice inferior
  const hueco = lado * 0.082;       // agujero central

  // Silueta del pin: círculo + triángulo hacia la punta.
  const enPin = (x, y) => {
    if ((x - c) ** 2 + (y - cy) ** 2 <= r * r) return true;
    if (y < cy || y > punta) return false;
    const t = (y - cy) / (punta - cy);
    return Math.abs(x - c) <= r * (1 - t) * 0.98;
  };
  const enHueco = (x, y) => (x - c) ** 2 + (y - cy) ** 2 <= hueco * hueco;

  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const i = (y * lado + x) * 4;
      const a = Math.max(0, cobertura(x, y, enPin) - cobertura(x, y, enHueco));
      for (let k = 0; k < 3; k++) px[i + k] = Math.round(FONDO[k] * (1 - a) + TINTA[k] * a);
      px[i + 3] = 255;
    }
  }
  return px;
}

for (const lado of [192, 512]) {
  const f = `${SALIDA}/icono-${lado}.png`;
  fs.writeFileSync(f, png(lado, lado, dibujar(lado)));
  console.log(f, fs.statSync(f).size, 'bytes');
}
