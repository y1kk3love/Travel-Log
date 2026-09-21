import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../css/main.css', import.meta.url), 'utf8');

test('css: 지출 "나누는 사람" 줄의 .share-list 는 한 번만 정의된다 (앱 공유 화면과 이름 충돌 회귀)', () => {
  assert.equal((css.match(/^.share-list {/gm) || []).length, 1);
  assert.ok(/^.share-pick-list {/m.test(css), '앱 공유 화면은 .share-pick-list 를 쓴다');
});

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = fs.readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8');
const mapJs = fs.readFileSync(new URL('../js/map.js', import.meta.url), 'utf8');

test('디자인 토큰: iOS 회색 바탕·파랑 강조 하나, 크림·테라코타는 남지 않는다', () => {
  assert.match(css, /--bg:\s*#F2F2F7/i);
  assert.match(css, /--accent:\s*#0A6CFF/i);
  for (const old of ['#F5F0E6', '#B4502B', '#FFFDF9', '#A23B2A', '--serif']) assert.ok(!css.includes(old), `${old} 가 남아 있음`);
  assert.ok(!mapJs.includes('#B4502B') && !mapJs.includes('#FFFDF9'), 'map.js 에 옛 색이 남아 있음');
  assert.ok(mapJs.includes('#0A6CFF'), 'map.js 경로·핀 색이 파랑이 아님');
});

test('글꼴·움직임: Pretendard 를 쓰고, 움직임 줄이기 설정을 존중한다', () => {
  assert.ok(html.includes('pretendard'), 'index.html 에 Pretendard 링크 없음');
  assert.match(css, /Pretendard/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /::view-transition/);
});

test('테마 색: index.html 과 manifest 의 theme_color 가 강조색과 같다', () => {
  assert.ok(html.includes('name="theme-color" content="#0A6CFF"'));
  assert.ok(manifest.includes('"theme_color": "#0A6CFF"'));
});
