// 화면 움직임 도우미 (iOS·토스 느낌). 계산은 lib/motion.js, 모양은 css/main.css 의 "움직임" 부분.
// 모두 transform·opacity 만 움직이고, "움직임 줄이기"를 켠 사람에게는 움직이지 않는다.
import { createSeen, countFrames, staggerIndex } from './lib/motion.js';

export const reduceMotion = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// 화면이 안 보이면(백그라운드) 프레임이 멈추므로 숫자·막대는 바로 끝값으로
const hidden = () => globalThis.document?.visibilityState === 'hidden';

const seen = createSeen(900);

// 목록 항목이 처음 나타나거나 새로 생겼을 때만 위에서부터 차례로 떠오른다 (다시 그려질 때는 그대로).
// items: [{ el, key }]. animate=false 면 기억만 하고 움직이지 않는다 (Day 이동처럼 다른 움직임을 쓸 때)
export function enter(scope, items, { animate = true } = {}) {
  const keys = items.map((i) => i.key);
  if (!animate || reduceMotion()) { seen.silent(scope, keys); return; }
  const plan = seen.plan(scope, keys, performance.now());
  for (const { el, key } of items) {
    const p = el && plan.get(key);
    if (!p) continue;
    markEnter(el, 'enter', p);
  }
}
// 등장 클래스와 순번. 처음 본 뒤 다시 그려진 요소는 지난 시간만큼 앞당겨 이어서 움직인다 (css 의 --elapsed)
export function markEnter(el, className, { order, elapsed }) {
  el.classList.add(className);
  el.style.setProperty('--i', String(staggerIndex(order)));
  el.style.setProperty('--elapsed', `${Math.round(elapsed)}ms`);
}
export const planEnter = (scope, keys) => (reduceMotion() ? new Map() : seen.plan(scope, keys, performance.now()));
// 화면을 떠날 때: 다음에 다시 들어오면 처음처럼 등장하게
export const forgetEnter = (scope) => seen.forget(scope);

// 숫자를 이전 값에서 새 값으로 센다 (처음이면 0부터). values: 숫자 배열, format(values) → 글자
const lastValues = new Map();
export function countUp(el, key, values, format, ms = 650) {
  const from = lastValues.get(key) ?? values.map(() => 0);
  lastValues.set(key, values);
  const same = from.length === values.length && from.every((v, i) => v === values[i]);
  if (same || reduceMotion() || hidden() || typeof requestAnimationFrame !== 'function') { el.textContent = format(values); return; }
  const start = performance.now();
  const step = (now) => {
    if (!el.isConnected && now - start > 50) return; // 다시 그려져 사라진 요소는 멈춘다
    const t = Math.min((now - start) / ms, 1);
    el.textContent = format(countFrames(from, values, t));
    if (t < 1) requestAnimationFrame(step);
  };
  el.textContent = format(countFrames(from, values, 0));
  requestAnimationFrame(step);
}

// 진행 막대: 다시 그려진 새 막대도 이전 너비에서 새 너비로 늘어난다
const lastWidths = new Map();
export function growBar(fill, key, pct) {
  const from = lastWidths.get(key) ?? 0;
  lastWidths.set(key, pct);
  if (reduceMotion() || hidden() || from === pct) { fill.style.width = `${pct}%`; return; }
  fill.style.width = `${from}%`;
  restyle(fill);
  fill.style.width = `${pct}%`;
}

// 지금 값으로 스타일을 한 번 계산해 두면, 곧바로 바꾼 값까지 transition 으로 움직인다 (프레임을 기다리지 않는다)
export function restyle(node, pseudo = null) {
  if (node?.isConnected) void getComputedStyle(node, pseudo).transform;
}

// Day 를 옮길 때 일정이 그 방향에서 밀려 들어온다 (dir: 1 오른쪽에서, -1 왼쪽에서)
export function slideIn(el, dir) {
  if (!dir || !el?.animate || reduceMotion()) return;
  el.animate([{ transform: `translateX(${dir * 28}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
    { duration: 280, easing: 'cubic-bezier(.2, .8, .2, 1)' });
}

// 사진: 화면에 붙은 채 불러와지면 살짝 페이드 인 (이미 불러와진 사진은 그대로라 숨은 채 남을 일이 없다)
const FADE_IMAGES = '.trip-feature-cover, .trip-small-cover, .photo-chip img, .cover-preview img, .lightbox img';
export function installImageFade() {
  document.addEventListener('load', (e) => {
    const img = e.target;
    if (img?.tagName !== 'IMG' || !img.matches(FADE_IMAGES) || !img.isConnected || !img.animate || reduceMotion()) return;
    img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
  }, true);
}

// 가벼운 진동 (안드로이드 앱·크롬). 체크, 순서 옮기기, 삭제처럼 손으로 한 동작에만 쓴다
const PATTERNS = { light: 8, medium: 16, success: [10, 60, 18], warning: [24] };
export function haptic(kind = 'light') {
  try { globalThis.navigator?.vibrate?.(PATTERNS[kind] ?? PATTERNS.light); } catch { /* 지원하지 않으면 무시 */ }
}

// 불러오는 동안 보여 줄 반짝이는 뼈대. kind: 'card'(큰 카드) | 'row'(목록 한 줄)
export function skeleton(kind = 'row', count = 3) {
  const list = document.createElement('div');
  list.className = `skeleton-list skeleton-${kind}`;
  list.setAttribute('aria-busy', 'true');
  list.setAttribute('aria-label', '불러오는 중');
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'skeleton';
    list.append(s);
  }
  return list;
}
