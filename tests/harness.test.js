import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const exportsOf = (src) => new Set([...src.matchAll(/^export (?:async )?(?:function|const|let) (\w+)/gm)].map((m) => m[1]));

// 화면 확인용 harness/ 는 import map 으로 js/db.js·auth.js·firebase.js 를 가짜로 바꿔 실제 화면 코드를 띄운다.
// 진짜 모듈에 내보내는 이름을 더하고 가짜에 빠뜨리면 모듈 로드가 통째로 실패해 화면 테스트(tests-ui)가 전부 깨진다
for (const [real, fake] of [['js/db.js', 'harness/fake-db.js'], ['js/auth.js', 'harness/fake-auth.js'], ['js/firebase.js', 'harness/fake-firebase.js']]) {
  test(`harness: ${fake} 는 ${real} 가 내보내는 이름을 모두 내보낸다`, () => {
    const want = exportsOf(read(real));
    const have = exportsOf(read(fake));
    const missing = [...want].filter((name) => !have.has(name));
    assert.deepEqual(missing, [], `${fake} 에 없는 이름: ${missing.join(', ')}`);
  });
}

test('harness: 가짜 데이터에 실제 사람의 메일 주소가 없다 (저장소에 올라가는 파일)', () => {
  for (const f of ['harness/fake-db.js', 'harness/fake-auth.js', 'harness/fake-firebase.js']) {
    const mails = read(f).match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? [];
    for (const m of mails) assert.match(m, /@example\.com$/, `${f}: ${m}`);
  }
});

test('harness: 화면 코드(index.html)와 같은 스타일·시작 모듈을 쓴다', () => {
  const html = read('harness/index.html');
  assert.match(html, /<script type="importmap">/);
  assert.ok(html.includes('/css/main.css') && html.includes('/js/app.js'));
  assert.ok(html.indexOf('importmap') < html.indexOf('/js/app.js'), 'import map 은 모듈보다 먼저 와야 한다');
});
