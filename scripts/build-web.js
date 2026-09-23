// 웹 파일을 dist/ 로 모은다 (Capacitor 의 webDir). 번들 없이 그대로 복사.
// 그 다음 Firebase CDN 모듈을 dist/vendor/firebase/ 로, 글꼴을 dist/vendor/fonts/ 로 내려받아 앱이 인터넷 없이도
// 바로 열리고 글꼴도 갖추게 한다 (웹 원본은 계속 CDN).
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

// outDir/js/**/*.js 가 가리키는 gstatic 모듈을 전부 받아 outDir/vendor/firebase/ 에 두고, import 를 상대 경로로 바꾼다.
// fetchText(url) → Promise<string>. 받은 모듈끼리의 import(firebase-app.js)도 './' 로 바꾼다. 받은 파일 이름 배열을 돌려준다.
export async function vendorFirebase(outDir, fetchText) {
  const jsDir = path.join(outDir, 'js');
  const vendorDir = path.join(outDir, 'vendor', 'firebase');
  const urls = new Map(); // 파일 이름 → URL
  // 하위 폴더(views·lib)까지 본다 (나중에 거기서 CDN 을 불러도 앱이 CDN 에 남지 않게)
  const sources = fs.readdirSync(jsDir, { recursive: true }).filter((f) => String(f).endsWith('.js')).map((f) => path.join(jsDir, String(f)));
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
    const depth = path.relative(jsDir, path.dirname(file)).split(path.sep).filter(Boolean).length;
    const r = s.replace(CDN_RE, `${'../'.repeat(depth + 1)}vendor/firebase/$1`);
    if (r !== s) fs.writeFileSync(file, r);
  }
  return [...urls.keys()];
}

// index.html 의 글꼴 CSS(Pretendard·Google Fonts)를 받아 outDir/vendor/fonts/ 에 두고, CSS 가 가리키는 글꼴 파일도 전부 받는다.
// fetchText(url, { headers }) → Promise<string>, fetchBinary(url) → Promise<Uint8Array>. 받은 글꼴 파일 이름 배열을 돌려준다.
const FONT_LINK_RE = /<link rel="stylesheet" href="(https:\/\/(?:cdn\.jsdelivr\.net|fonts\.googleapis\.com)\/[^"]+)"[^>]*>/g;
// Google Fonts 는 브라우저마다 다른 CSS 를 준다. woff2 를 받으려면 최신 크롬처럼 묻는다
const BROWSER_UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
export async function vendorFonts(outDir, fetchText, fetchBinary) {
  const htmlPath = path.join(outDir, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  const fontDir = path.join(outDir, 'vendor', 'fonts');
  const cssUrls = [...new Set([...html.matchAll(FONT_LINK_RE)].map((m) => m[1]))];
  if (!cssUrls.length) return [];
  fs.mkdirSync(fontDir, { recursive: true });
  const files = [];
  for (const [i, cssUrl] of cssUrls.entries()) {
    const prefix = new URL(cssUrl).hostname.includes('googleapis') ? 'g' : 'p';
    let css = await fetchText(cssUrl, { headers: { 'User-Agent': BROWSER_UA } });
    if (!css || !css.includes('@font-face')) throw new Error(`글꼴 CSS 를 받지 못했어요: ${cssUrl}`);
    const refs = [...new Set([...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]))];
    for (const ref of refs) {
      const abs = new URL(ref, cssUrl).href;
      const name = `${prefix}-${path.basename(new URL(abs).pathname)}`;
      const bytes = await fetchBinary(abs);
      if (!bytes || !bytes.length) throw new Error(`글꼴 파일을 받지 못했어요: ${abs}`);
      fs.writeFileSync(path.join(fontDir, name), bytes);
      files.push(name);
      css = css.split(ref).join(name); // CSS 와 글꼴 파일이 같은 폴더
    }
    const cssName = `${prefix}-fonts-${i}.css`;
    fs.writeFileSync(path.join(fontDir, cssName), css);
    // 로컬이면 바로 읽히므로 비동기 로드(media=print) 없이 평범한 stylesheet 로
    // (noscript 안의 같은 링크도 같이 바뀐다)
    html = html.split('\n').map((line) => (line.includes(cssUrl) && line.includes('<link')
      ? line.replace(/<link[^>]*>/, `<link rel="stylesheet" href="vendor/fonts/${cssName}">`) : line)).join('\n');
  }
  fs.writeFileSync(htmlPath, html);
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'dist');
  const out = buildWeb(outDir);
  const vendored = await vendorFirebase(outDir, async (url) => { const res = await fetch(url); if (!res.ok) throw new Error(`${res.status} ${url}`); return res.text(); });
  const fetchOk = async (url, opts) => { const res = await fetch(url, opts); if (!res.ok) throw new Error(`${res.status} ${url}`); return res; };
  const fonts = await vendorFonts(outDir, async (url, opts) => (await fetchOk(url, opts)).text(), async (url) => new Uint8Array(await (await fetchOk(url)).arrayBuffer()));
  console.log(`dist 준비: ${out.join(', ')} + vendor/firebase: ${vendored.join(', ')} + vendor/fonts: ${fonts.length}개`);
}
