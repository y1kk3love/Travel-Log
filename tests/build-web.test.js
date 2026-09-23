import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildWeb, vendorFirebase, vendorFonts, WEB_FILES } from '../scripts/build-web.js';

test('buildWeb: 웹 파일만 outDir 로 복사하고 테스트·문서·안드로이드는 뺀다', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-dist-'));
  const copied = buildWeb(out);
  assert.ok(fs.existsSync(path.join(out, 'index.html')));
  assert.ok(fs.existsSync(path.join(out, 'js', 'app.js')));
  assert.ok(fs.existsSync(path.join(out, 'icons', 'icon-512.png')));
  assert.ok(!fs.existsSync(path.join(out, 'tests')));
  assert.ok(!fs.existsSync(path.join(out, 'docs')));
  assert.ok(!fs.existsSync(path.join(out, 'android')));
  assert.deepEqual(copied, WEB_FILES);
  fs.rmSync(out, { recursive: true, force: true });
});

test('vendorFirebase: Firebase CDN 모듈을 vendor/firebase 로 내려받고 import 를 상대 경로로 바꾼다 (앱 오프라인 시작용)', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-dist-'));
  buildWeb(out);
  const fetched = [];
  const fake = async (url) => { fetched.push(url); return `// ${url.split('/').pop()}
import 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
` + '// '.padEnd(200, 'x'); };
  const files = await vendorFirebase(out, fake);
  assert.deepEqual([...fetched].sort(), [
    'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js',
    'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js',
  ]);
  assert.deepEqual([...files].sort(), ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js']);
  const sdk = fs.readFileSync(path.join(out, 'js', 'firebase-sdk.js'), 'utf8');
  assert.ok(!sdk.includes('gstatic.com'), 'firebase-sdk.js 에 CDN 주소가 남음');
  assert.ok(sdk.includes("'../vendor/firebase/firebase-"), 'firebase-sdk.js 가 vendor 를 가리키지 않음');
  for (const f of ['firebase.js', 'auth.js', 'db.js']) {
    const s = fs.readFileSync(path.join(out, 'js', f), 'utf8');
    assert.ok(!s.includes('gstatic.com'), `${f} 에 CDN 주소가 남음`);
    assert.ok(s.includes("'./firebase-sdk.js'"), `${f} 가 firebase-sdk.js 를 쓰지 않음`);
  }
  const vendored = fs.readFileSync(path.join(out, 'vendor', 'firebase', 'firebase-auth.js'), 'utf8');
  assert.ok(vendored.includes("import './firebase-app.js'"));
  assert.ok(!vendored.includes('gstatic.com'));
  // 원본 소스는 그대로 (웹은 계속 CDN)
  assert.ok(fs.readFileSync(new URL('../js/firebase-sdk.js', import.meta.url), 'utf8').includes('gstatic.com'));
  fs.rmSync(out, { recursive: true, force: true });
});

test('vendorFonts: 글꼴 CSS 와 글꼴 파일을 vendor/fonts 로 받아 index.html 이 로컬을 가리키게 한다 (앱 첫 화면이 CDN 을 기다리지 않게)', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-dist-'));
  buildWeb(out);
  const requested = [];
  const fetchText = async (url, opts = {}) => {
    requested.push({ url, ua: opts.headers?.['User-Agent'] ?? null });
    if (url.includes('pretendard')) return "@font-face{font-family:'Pretendard Variable';src:url(./woff2-dynamic-subset/PretendardVariable.subset.0.woff2) format('woff2')}@font-face{src:url(./woff2-dynamic-subset/PretendardVariable.subset.1.woff2)}";
    return "@font-face{font-family:'Do Hyeon';src:url(https://fonts.gstatic.com/s/dohyeon/v19/abc.0.woff2) format('woff2')}";
  };
  const fetchBinary = async (url) => { requested.push({ url }); return new Uint8Array([119, 79, 70, 50, url.length % 256]); };
  const files = await vendorFonts(out, fetchText, fetchBinary);
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.ok(!html.includes('cdn.jsdelivr.net/gh/orioncactus'), 'Pretendard CDN 링크가 남음');
  assert.ok(!html.includes('fonts.googleapis.com'), 'Google Fonts 링크가 남음');
  assert.ok(html.includes('href="vendor/fonts/'), 'index.html 이 로컬 글꼴 CSS 를 가리키지 않음');
  // Google Fonts 는 브라우저 UA 를 줘야 woff2 를 준다
  assert.ok(requested.find((r) => r.url.includes('fonts.googleapis.com')).ua?.includes('Chrome'));
  // 상대 경로·절대 경로 글꼴 파일을 모두 받는다
  assert.ok(requested.some((r) => r.url.endsWith('/woff2-dynamic-subset/PretendardVariable.subset.1.woff2')));
  assert.ok(requested.some((r) => r.url === 'https://fonts.gstatic.com/s/dohyeon/v19/abc.0.woff2'));
  for (const f of files) assert.ok(fs.existsSync(path.join(out, 'vendor', 'fonts', f)), `${f} 없음`);
  const css = fs.readdirSync(path.join(out, 'vendor', 'fonts')).filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(path.join(out, 'vendor', 'fonts', f), 'utf8')).join('\n');
  assert.ok(!/url\((https?:)?\/\//.test(css) && !css.includes('url(./woff2'), 'CSS 에 원래 주소가 남음');
  // 원본 index.html 은 그대로 (웹은 CDN)
  assert.ok(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').includes('fonts.googleapis.com'));
  fs.rmSync(out, { recursive: true, force: true });
});
