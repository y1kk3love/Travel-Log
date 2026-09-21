import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildWeb, vendorFirebase, WEB_FILES } from '../scripts/build-web.js';

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
  for (const f of ['firebase.js', 'auth.js', 'db.js']) {
    const s = fs.readFileSync(path.join(out, 'js', f), 'utf8');
    assert.ok(!s.includes('gstatic.com'), `${f} 에 CDN 주소가 남음`);
    assert.ok(s.includes("'../vendor/firebase/firebase-"), `${f} 가 vendor 를 가리키지 않음`);
  }
  const vendored = fs.readFileSync(path.join(out, 'vendor', 'firebase', 'firebase-auth.js'), 'utf8');
  assert.ok(vendored.includes("import './firebase-app.js'"));
  assert.ok(!vendored.includes('gstatic.com'));
  // 원본 소스는 그대로 (웹은 계속 CDN)
  assert.ok(fs.readFileSync(new URL('../js/firebase.js', import.meta.url), 'utf8').includes('gstatic.com'));
  fs.rmSync(out, { recursive: true, force: true });
});
