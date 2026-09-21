import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { versionCodeFor, applyAndroidVersion } from '../scripts/android-version.js';

test('versionCodeFor: major*10000 + minor*100 + patch, 항상 증가', () => {
  assert.equal(versionCodeFor('v1.2.3'), 10203);
  assert.equal(versionCodeFor('1.0.0'), 10000);
  assert.ok(versionCodeFor('v1.10.0') > versionCodeFor('v1.9.9'));
  assert.throws(() => versionCodeFor('v1.2.345'), /patch/);
  assert.throws(() => versionCodeFor('nope'), /형식/);
});

test('applyAndroidVersion: build.gradle 의 versionName/versionCode 를 바꾼다', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tl-gradle-')), 'build.gradle');
  fs.writeFileSync(f, 'android {\n    defaultConfig {\n        versionCode 1\n        versionName "1.0"\n    }\n}\n');
  applyAndroidVersion('v2.3.4', f);
  const s = fs.readFileSync(f, 'utf8');
  assert.match(s, /versionCode 20304/);
  assert.match(s, /versionName "2\.3\.4"/);
});
