import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildWeb, WEB_FILES } from '../scripts/build-web.js';

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
