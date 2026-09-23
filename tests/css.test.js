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

test('다크 모드: 시스템 설정을 따라 색 토큰만 바꾼다', () => {
  assert.match(css, /color-scheme:\s*light dark/);
  const dark = css.match(/@media \(prefers-color-scheme: dark\) \{\s*:root \{([\s\S]*?)\}/)?.[1] ?? '';
  for (const t of ['--bg', '--sf', '--ink', '--muted', '--line', '--accent-text', '--inverse', '--on-inverse', '--field', '--bar-bg', '--toast-bg']) {
    assert.match(dark, new RegExp(`${t}:`), `다크 모드에 ${t} 가 없음`);
  }
  // 토큰 밖에 박힌 밝은 화면 전용 색이 없어야 다크 모드에서 흰 면·안 보이는 글자가 안 생긴다
  const rules = css.replace(/:root \{[\s\S]*?\}/g, '');
  for (const hard of ['#E3E3E8', '#3A3A3C', 'rgba(242, 242, 247', '#FFECEB', '#D9E7FF', '#DDE7F7', 'rgba(255, 255, 255, .88)', 'rgba(17, 17, 17', 'rgba(43, 60, 110', '#F6F8FF', '#1C1C1E']) {
    assert.ok(!rules.includes(hard), `${hard} 가 토큰 밖에 박혀 있음`);
  }
  // 진한 면(흰 글자)은 --ink 가 아니라 --inverse: 다크 모드에서 --ink 는 밝은 글자색이다
  assert.ok(!/background:\s*var\(--ink\)/.test(css), 'background: var(--ink) 대신 var(--inverse)');
});

test('다크 모드: Google 지도도 시스템 설정을 따르고, 웹 앱 바탕색은 지금 배경색', () => {
  assert.match(mapJs, /colorScheme:\s*g\.ColorScheme\?\.FOLLOW_SYSTEM/);
  // Google 지도 말풍선(InfoWindow)은 다크 모드에서도 흰 바탕이라, 안의 글자는 토큰(--ink)이 아닌 어두운 색으로 고정
  assert.match(css, /\.map-popup \{[^}]*color: #111111/);
  assert.ok(manifest.includes('"background_color": "#F2F2F7"'));
});
