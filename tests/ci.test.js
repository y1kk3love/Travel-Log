import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('main 에 올릴 때마다 테스트가 돈다 (웹은 main 에서 바로 배포된다)', () => {
  const wf = read('.github/workflows/test.yml');
  assert.match(wf, /branches: \[main\]/);
  assert.match(wf, /run: npm test/);
});

test('릴리스: 비밀값을 run 스크립트에 직접 넣지 않는다 (env 로만)', () => {
  const wf = read('.github/workflows/android-release.yml');
  for (const line of wf.split('\n')) {
    if (line.includes('${{ secrets.')) assert.match(line, /^\s+[A-Z0-9_]+: \$\{\{ secrets\.[A-Z0-9_]+ \}\}$/, `env 가 아닌 곳에 비밀값: ${line.trim()}`);
  }
  assert.match(wf, /KS: \$\{\{ secrets\.ANDROID_KEYSTORE_BASE64 \}\}/);
});

test('릴리스: 쓰기 권한을 가진 외부 액션은 커밋 SHA 로 고정한다', () => {
  const wf = read('.github/workflows/android-release.yml');
  for (const [, ref] of wf.matchAll(/uses: (\S+)/g)) {
    if (ref.startsWith('actions/')) continue; // GitHub 공식 액션
    assert.match(ref, /@[0-9a-f]{40}$/, `${ref} 가 커밋으로 고정되지 않음`);
  }
});

test('릴리스: APK 와 함께 sha256 체크섬을 올린다', () => {
  assert.match(read('.github/workflows/android-release.yml'), /travel-log-\*\.apk\.sha256/);
});
