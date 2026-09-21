// 웹 파일을 dist/ 로 모은다 (Capacitor 의 webDir). 번들 없이 그대로 복사.
//   node scripts/build-web.js [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WEB_FILES = ['index.html', 'manifest.webmanifest', 'favicon.svg', 'sw.js', 'css', 'js', 'icons'];

export function buildWeb(outDir = path.join(ROOT, 'dist')) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of WEB_FILES) {
    fs.cpSync(path.join(ROOT, name), path.join(outDir, name), { recursive: true });
  }
  return WEB_FILES;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = buildWeb(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
  console.log(`dist 준비: ${out.join(', ')}`);
}
