// favicon.svg(비행기)를 PNG 홈 화면 아이콘으로 렌더링한다. 외부 의존성 없음.
//   node scripts/make-icons.js
// icons/icon-180.png (iOS), icon-192.png, icon-512.png (Android/Chrome) 생성.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BG = [0xb4, 0x50, 0x2b]; // 테라코타 (favicon.svg 배경색)
const FG = [0xff, 0xfd, 0xf9]; // 비행기 색
const SIZES = [180, 192, 512];
const SS = 4; // 안티앨리어싱 슈퍼샘플 (SS x SS)

// favicon.svg 의 비행기 path 를 64x64 좌표계 다각형으로 옮긴 것 (원호는 점으로 근사)
function planePolygon() {
  const pts = [[50, 40], [50, 36], [34, 26], [34, 15]];
  for (let i = 1; i < 16; i++) { // (34,15) -> (28,15) 위쪽 반원, 중심 (31,15) r=3
    const a = Math.PI * i / 16;
    pts.push([31 + 3 * Math.cos(a), 15 - 3 * Math.sin(a)]);
  }
  pts.push([28, 15], [28, 26], [12, 36], [12, 40], [28, 35], [28, 46], [24, 49], [24, 52], [31, 50], [38, 52], [38, 49], [34, 46], [34, 35]);
  // SVG 의 rotate(45) (중심 32,32)
  const c = Math.cos(Math.PI / 4), s = Math.sin(Math.PI / 4);
  return pts.map(([x, y]) => [32 + (x - 32) * c - (y - 32) * s, 32 + (x - 32) * s + (y - 32) * c]);
}

function inside(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function render(size) {
  const poly = planePolygon();
  const scale = size / 64;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 3 + 1)] = 0; // 필터 없음
    for (let px = 0; px < size; px++) {
      let cover = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / scale, y = (py + (sy + 0.5) / SS) / scale;
          if (inside(poly, x, y)) cover++;
        }
      }
      const t = cover / (SS * SS);
      const o = py * (size * 3 + 1) + 1 + px * 3;
      for (let k = 0; k < 3; k++) raw[o + k] = Math.round(BG[k] + (FG[k] - BG[k]) * t);
    }
  }
  return raw;
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const size of SIZES) {
  const file = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(file, png(size, render(size)));
  console.log(`${file} (${fs.statSync(file).size} bytes)`);
}
