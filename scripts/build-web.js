// 웹 파일을 dist/ 로 모은다 (Capacitor 의 webDir). 번들 없이 그대로 복사.
// 그 다음 Firebase CDN 모듈을 dist/vendor/firebase/ 로 내려받아 앱이 인터넷 없이도 열리게 한다 (웹 원본은 계속 CDN).
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

const CDN_RE = /https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/([\w-]+\.js)/g;

// outDir/js/*.js 가 가리키는 gstatic 모듈을 전부 받아 outDir/vendor/firebase/ 에 두고, import 를 상대 경로로 바꾼다.
// fetchText(url) → Promise<string>. 받은 모듈끼리의 import(firebase-app.js)도 './' 로 바꾼다. 받은 파일 이름 배열을 돌려준다.
export async function vendorFirebase(outDir, fetchText) {
  const jsDir = path.join(outDir, 'js');
  const vendorDir = path.join(outDir, 'vendor', 'firebase');
  const urls = new Map(); // 파일 이름 → URL
  const sources = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js')).map((f) => path.join(jsDir, f));
  for (const file of sources) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(CDN_RE)) urls.set(m[1], m[0]);
  }
  if (!urls.size) return [];
  fs.mkdirSync(vendorDir, { recursive: true });
  for (const [name, url] of urls) {
    const text = await fetchText(url);
    if (!text || text.length < 100) throw new Error(`Firebase 모듈을 받지 못했어요: ${url}`);
    fs.writeFileSync(path.join(vendorDir, name), text.replace(CDN_RE, './$1'));
  }
  for (const file of sources) {
    const s = fs.readFileSync(file, 'utf8');
    const r = s.replace(CDN_RE, '../vendor/firebase/$1');
    if (r !== s) fs.writeFileSync(file, r);
  }
  return [...urls.keys()];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'dist');
  const out = buildWeb(outDir);
  const vendored = await vendorFirebase(outDir, async (url) => { const res = await fetch(url); if (!res.ok) throw new Error(`${res.status} ${url}`); return res.text(); });
  console.log(`dist 준비: ${out.join(', ')} + vendor/firebase: ${vendored.join(', ')}`);
}
