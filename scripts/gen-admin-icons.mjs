/**
 * מחולל אייקוני PWA ייעודיים לאזורי הניהול — ללא תלות חיצונית.
 * מייצר PNG נבדלים חזותית כדי שכל אפליקציה מותקנת תהיה מובחנת:
 *   admin      — רקע נייבי עם עיגול זהב (פלטת סרגל הניהול).
 *   superadmin — רקע זהב עם עיגול נייבי (קונסולת הפלטפורמה).
 * הרצה: npm run gen:admin-icons
 *
 * טכניקת קידוד ה-PNG זהה ל-scripts/gen-icons.mjs (zlib בלבד).
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const NAVY = '#08101C';
const GOLD = '#F2D695';
const GOLD_DEEP = '#C59D5F';

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

// טבלת CRC32 ל-PNG.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/** רקע מלא בצבע bg עם עיגול מלא בצבע fg במרכז. */
function makePng(size, bg, fg) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.28;
  const r2 = radius * radius;

  const rowLen = 1 + size * 4;
  const raw = Buffer.alloc(rowLen * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * rowLen;
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const inside = dx * dx + dy * dy <= r2;
      const p = rowStart + 1 + x * 4;
      const c = inside ? fg : bg;
      raw[p] = c.r;
      raw[p + 1] = c.g;
      raw[p + 2] = c.b;
      raw[p + 3] = 255;
    }
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = join(root, 'public/icons');
mkdirSync(outDir, { recursive: true });

const VARIANTS = [
  { name: 'admin', bg: hexToRgb(NAVY), fg: hexToRgb(GOLD) },
  { name: 'superadmin', bg: hexToRgb(GOLD_DEEP), fg: hexToRgb(NAVY) },
];

for (const v of VARIANTS) {
  for (const size of [192, 512]) {
    const png = makePng(size, v.bg, v.fg);
    writeFileSync(join(outDir, `icon-${v.name}-${size}.png`), png);
    console.log(`  ✓ icon-${v.name}-${size}.png (${png.length} bytes)`);
  }
}

console.log('אייקוני הניהול נוצרו בהצלחה.');
