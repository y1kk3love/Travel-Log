import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../css/main.css', import.meta.url), 'utf8');

test('css: 지출 "나누는 사람" 줄의 .share-list 는 한 번만 정의된다 (앱 공유 화면과 이름 충돌 회귀)', () => {
  assert.equal((css.match(/^.share-list {/gm) || []).length, 1);
  assert.ok(/^.share-pick-list {/m.test(css), '앱 공유 화면은 .share-pick-list 를 쓴다');
});
