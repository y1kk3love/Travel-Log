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

test('화면 전환(홈 ↔ 여행): 속도·흐림·블러·밀리는 거리는 --nav-* 변수 (harness 조절 창에서 골라 정한 값)', () => {
  assert.match(css, /--nav-dur: 1s; --nav-fade: \.15; --nav-blur: 16px; --nav-shift: -60%;/);
  assert.match(css, /::view-transition-old\(root\), ::view-transition-new\(root\) \{ animation-duration: var\(--nav-dur\);/);
  assert.match(css, /@keyframes vt-out-left \{[^\n]*translateX\(var\(--nav-shift\)\); opacity: var\(--nav-fade\); filter: blur\(var\(--nav-blur\)\);/);
  assert.match(css, /::view-transition-group\(trip-title\) \{ animation-duration: var\(--nav-dur\);/); // 제목이 이어지는 시간도 같이 간다
  // 조절 창의 "처음 값"이 css 기본값과 같다
  const tune = fs.readFileSync(new URL('../harness/tune-motion.js', import.meta.url), 'utf8');
  assert.match(tune, /const DEFAULTS = \{ dur: 1000, fade: 0\.15, blur: 16, shift: 60 \};/);
});

// 규칙 부분: 토큰을 정하는 :root 블록(밝은 화면·어두운 화면)을 뺀 나머지
const rulesOnly = css.replace(/\r\n/g, '\n').replace(/:root \{[\s\S]*?\n\s*\}/g, '');

test('글자 크기: 규칙에는 px 를 직접 적지 않고 --fs-* 토큰만 쓴다 (아홉 단계 + 장식용 micro)', () => {
  const tokens = [...css.matchAll(/--fs-[\w-]+: (\d+)px/g)].map((m) => Number(m[1]));
  assert.deepEqual(tokens, [10, 11, 12, 13, 15, 17, 20, 22, 28, 34]);
  const sizes = [...rulesOnly.matchAll(/font-size: ?([^;}]+)/g)].map((m) => m[1].trim());
  assert.ok(sizes.length > 100);
  for (const v of sizes) assert.match(v, /^(var\(--fs-[\w-]+\)|calc\(var\(--fs-micro\) \* \.85\))$/, `font-size: ${v} — 토큰을 쓸 것`);
});

test('모서리: --radius-* 여섯 단계와 알약(999px)·원(50%)만 쓴다', () => {
  assert.match(css, /--radius-xs: 6px; --radius-sm: 8px; --radius-md: 10px; --radius: 12px; --radius-lg: 16px; --radius-xl: 22px;/);
  const allowed = /^(var\(--radius(-\w+)?\)|999px|50%|0)$/;
  for (const [, v] of rulesOnly.matchAll(/border-radius: ?([^;}]+)/g)) {
    if (v.trim() === '4px 8px 8px 4px') continue; // D-day 수하물 태그 모양
    for (const part of v.trim().split(/\s+/)) assert.match(part, allowed, `border-radius: ${v.trim()}`);
  }
});

test('간격: 안쪽 여백·사이 간격은 4px 눈금(4·8·12·16·20…). 작은 컨트롤 안의 미세 조정(1·2·6·10)만 예외', () => {
  const off = [];
  for (const [, prop, value] of rulesOnly.matchAll(/(padding[\w-]*|gap): ?([^;}]+)/g)) {
    for (const [, n] of value.matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)px/g)) {
      if (Number(n) % 4 !== 0 && ![1, 2, 6, 10].includes(Number(n))) off.push(`${prop}: ${value.trim()}`);
    }
  }
  assert.deepEqual(off, []);
});

test('다듬기: 색 그림자·색에서 색으로 가는 그라데이션이 없고, 아이콘 크기는 두 가지, 작은 글자에 좁힌 자간이 없다', () => {
  assert.ok(!/box-shadow: [^;]*rgba\(10, 108, 255[^;]*\d+px/.test(css.replace(/@keyframes pulse-dot[^\n]*/, '').replace(/\.today-banner-text::before[^\n]*/, '')), '파란 그림자 (오늘 배너의 "지금" 점만 예외)');
  assert.ok(!/--cover-hue[^)]*\) \+/.test(css), '대표 사진 없는 카드는 한 색 안에서 밝기만 달라진다');
  const icons = [...new Set([...css.matchAll(/svg \{ width: (\d+)px/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
  assert.deepEqual(icons, [16, 20]);
  assert.ok(!/font-size: var\(--fs-(micro|2xs|xs|sm|md|lg)\)[^}]*letter-spacing: -/.test(css), '17px 이하 글자에 음수 자간');
  // 일정의 시각은 정보라 본문 색, 파랑은 누르는 것과 지도 핀 번호에
  assert.match(css, /\.tl-meta > \.muted:first-child \{ color: var\(--ink\);/);
});

test('더하기 버튼은 화면마다 같은 연파랑(틴트) 하나', () => {
  assert.match(css, /\.btn-tint \{ background: var\(--accent-soft\); color: var\(--accent-text\); \}/);
  assert.ok(!css.includes('btn-dashed'), '옛 이름 btn-dashed 가 남아 있음');
  const views = ['planner', 'reservations', 'expenses', 'checklist'].map((v) => fs.readFileSync(new URL(`../js/views/${v}.js`, import.meta.url), 'utf8'));
  assert.ok(views[0].includes("class: 'btn btn-tint'"), '일정의 장소·메모 추가');
  for (const src of views.slice(1)) assert.ok(src.includes('tabHead('), '탭 화면은 ui.js tabHead (건수와 틴트 추가 버튼 한 줄)');
});

test('일정: Day 탭은 스크롤해도 위에 붙어 있고, 넓은 화면의 정산 영수증은 종이 폭을 넘지 않는다', () => {
  assert.match(css, /\.day-tabs \{[^}]*position: sticky; top: 0;/);
  assert.match(css, /\.receipt \{[^}]*max-width: 440px;/);
  assert.match(css, /\.expenses-layout \{ grid-template-columns: minmax\(0, 1fr\) 400px;/);
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

test('지도: 폰에서도 한 손가락으로 움직이고, 지도를 끄는 동안 페이지는 스크롤되지 않는다', () => {
  // cooperative 는 한 손가락이면 지도는 그대로 두고 페이지를 스크롤하고, 두 손가락도 첫 손가락이 먼저 움직이면 페이지가 같이 스크롤된다
  assert.match(mapJs, /gestureHandling: 'greedy'/);
  assert.ok(!mapJs.includes("'cooperative'"), "map.js 에 'cooperative' 가 남아 있음");
  assert.match(css, /\.map-canvas \{[^}]*touch-action: none/);
});

test('움직임: 차례 등장·스켈레톤·탭 알약·체크·도장·핀이 있고, 움직임 줄이기는 지연까지 없앤다', () => {
  for (const name of ['rise-in', 'shimmer', 'check-pop', 'strike', 'stamp-in', 'pin-drop', 'day-pop', 'skeleton-in']) {
    assert.match(css, new RegExp(`@keyframes ${name} `), `${name} 애니메이션이 없음`);
  }
  assert.match(css, /\.tabs\.has-indicator::before \{[^}]*transition: transform/);
  const reduce = css.match(/prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(reduce, /animation-delay: 0s !important/);
});

test('움직임 기준: 마우스를 올릴 때만 hover, 대화상자·메뉴·시트는 튀지 않고, 닫기는 열기보다 짧다', () => {
  const hoverLines = css.split('\n').filter((l) => l.includes(':hover'));
  assert.ok(hoverLines.length > 0);
  for (const l of hoverLines) assert.ok(l.startsWith('@media (hover: hover) and (pointer: fine)'), `터치에서도 적용되는 hover: ${l.slice(0, 60)}`);
  assert.match(css, /dialog\[open\] \{ animation: dialog-in \.25s var\(--ease-out\); \}/);
  assert.match(css, /dialog\.sheet-menu\[open\] \{ animation: menu-in \.18s var\(--ease-out\); \}/);
  assert.match(css, /dialog\.sheet-menu \{ transform-origin: top right;/); // 누른 버튼(오른쪽 위) 쪽에서 커진다
  assert.match(css, /transform: translateY\(100%\); transition: transform \.5s var\(--ease-sheet\); \}/); // 폰 시트
  assert.match(css, /dialog \{ transition: opacity \.15s var\(--ease-exit\)/); // 닫기 0.15초 < 열기 0.25초
  assert.match(css, /\.skeleton-list \{ animation: skeleton-in \.2s \.2s both; \}/); // 금방 오면 뼈대가 번쩍이지 않게
  assert.match(css, /font-variant-numeric: tabular-nums/);
  // hover 가 없는 터치 화면(가로 태블릿 등 900px 초과)에서도 체크리스트 수정·삭제 버튼이 보인다
  assert.match(css, /@media \(hover: none\) \{ \.check-edit, \.check-delete \{ opacity: 1; \} \}/);
});
