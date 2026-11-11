import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('main 에 올릴 때마다 코드 검사·단위 테스트·규칙 테스트·화면 테스트가 돈다', () => {
  const wf = read('.github/workflows/test.yml');
  assert.match(wf, /branches: \[main\]/);
  for (const cmd of ['npm run lint', 'npm test', 'npm run test:rules', 'npm run test:ui']) assert.ok(wf.includes(`run: ${cmd}`), `${cmd} 가 없다`);
});

test('웹 배포는 검사가 모두 통과한 main 에서만 한다 (깨진 코드가 바로 사이트에 나가지 않게)', () => {
  const wf = read('.github/workflows/test.yml');
  const deploy = wf.slice(wf.indexOf('\n  deploy:'));
  assert.match(deploy, /needs: \[test, rules, ui\]/);
  assert.match(deploy, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(deploy, /run: node scripts\/build-site\.js _site/);
  assert.match(deploy, /uses: actions\/deploy-pages@/);
  // 쓰기 권한(pages·id-token)은 배포 단계에만
  assert.match(wf.slice(0, wf.indexOf('jobs:')), /permissions:\n {2}contents: read\n/);
  assert.match(deploy, /pages: write/);
  for (const [, ref] of wf.matchAll(/uses: (\S+)/g)) assert.ok(ref.startsWith('actions/'), `${ref}: GitHub 공식 액션만 (아니면 커밋 SHA 로 고정)`);
});

test('사이트에는 앱 파일만 올린다: 앱 설정은 넣고, 테스트·문서·화면 확인용 harness 는 뺀다', async () => {
  const { SITE_FILES } = await import('../scripts/build-site.js');
  assert.ok(SITE_FILES.includes('index.html') && SITE_FILES.includes('js') && SITE_FILES.includes('sw.js'));
  assert.ok(SITE_FILES.includes('app-config.json'), '안드로이드 앱이 사이트의 app-config.json 을 읽는다 (최소 지원 버전)');
  for (const no of ['harness', 'tests', 'tests-ui', 'docs', 'android', 'node_modules', 'scripts']) assert.ok(!SITE_FILES.includes(no), `${no} 는 올리지 않는다`);
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
