// 알림(토스트) — Sonner 방식: 최신이 맨 앞, 뒤로 두 개가 살짝 비치며 쌓이고, 좌우·아래로 밀어 닫는다.
// 마우스를 올리면 펼쳐지며 시간이 멈추고, 앱이 백그라운드면 시간이 멈춘다. 3초(버튼이 있으면 5초) 뒤 사라진다 (토스 TDS).
// 계산은 lib/gesture.js, 움직임은 transition 이라 도중에 새 자리로 바뀌어도 끊기지 않는다.
import { stackLayout, swipeOut, resist, velocity, createCountdown, liftAbove } from './lib/gesture.js';
import { reduceMotion, restyle } from './motion.js';

const live = []; // 최신이 앞: { node, timer, dragging }
let expanded = false;
let bound = false;

const rootEl = () => document.getElementById('toast-root');
const now = () => Date.now();
const paused = () => expanded || document.visibilityState === 'hidden';

// 모달 대화상자는 top layer 에 떠서 z-index 로는 그 위에 알림을 띄울 수 없다.
// 알림 영역을 popover 로 top layer 에 올리고, 띄울 때마다 닫았다 다시 열어 가장 위로 보낸다 (popover 미지원 브라우저는 예전처럼).
export function raiseToasts(root = rootEl()) {
  if (!root || typeof root.showPopover !== 'function' || !root.childElementCount) return;
  try {
    if (root.matches(':popover-open')) root.hidePopover();
    root.showPopover();
  } catch { /* 지원하지 않으면 그냥 둔다 */ }
}

// action: { label, onClick } 을 주면 알림 안에 버튼 하나(예: 되돌리기)를 둔다
export function toast(message, { kind = 'info', ms = null, action = null } = {}) {
  const root = rootEl();
  if (!root) return;
  bindOnce(root);
  const node = document.createElement('div');
  node.className = `toast${kind === 'error' ? ' toast-error' : ''}${action ? ' toast-with-action' : ''}`;
  node.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  const text = document.createElement('span');
  text.textContent = message;
  node.append(text);
  const item = { node, timer: null, dragging: false };
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-action';
    button.textContent = action.label;
    button.addEventListener('click', (e) => { e.stopPropagation(); dismiss(item); action.onClick(); });
    node.append(button);
  }
  item.timer = createCountdown(ms ?? (action ? 5000 : 3000), () => dismiss(item));
  // 아래에서 올라온다: 처음 자리를 한 번 계산해 둔 뒤 쌓인 자리로 옮기면 transition 이 움직인다
  node.style.transform = 'translateY(calc(100% + 28px))';
  node.style.opacity = '0';
  root.append(node);
  live.unshift(item);
  bindSwipe(item);
  placeRoot(root);
  raiseToasts(root);
  restyle(node);
  restack();
  item.timer.start(now());
  if (paused()) item.timer.pause(now());
}

// 아래 시트가 열려 있으면 시트의 버튼 줄(취소·저장) 위로 띄운다: 알림이 가려 저장을 못 누르는 일이 없게
function placeRoot(root) {
  const foot = document.querySelector('.sheet-overlay.open .sheet-foot');
  const bottom = liftAbove(foot ? foot.getBoundingClientRect().top : null, window.innerHeight);
  if (bottom == null && live.length > 1) return; // 이미 떠 있는 알림이 있으면 그 자리를 지킨다 (쌓인 알림이 튀지 않게)
  root.style.bottom = bottom == null ? '' : `${bottom}px`;
}

// 최신이 앞에 오도록 자리·크기·투명도를 다시 준다 (펼쳤으면 높이대로 늘어선다)
function restack() {
  const layout = stackLayout(live.map((t) => t.node.offsetHeight), { expanded });
  live.forEach((t, i) => {
    if (t.dragging) return;
    const { y, scale, opacity } = layout[i];
    t.node.style.transform = `translateY(${y}px) scale(${scale})`;
    t.node.style.opacity = String(opacity);
    t.node.style.zIndex = String(live.length - i);
    t.node.style.pointerEvents = opacity ? '' : 'none';
  });
}

function dismiss(item, dir = null) {
  const i = live.indexOf(item);
  if (i < 0) return;
  live.splice(i, 1);
  item.timer.stop();
  const n = item.node;
  n.style.pointerEvents = 'none';
  n.style.transition = 'transform .2s var(--ease-exit), opacity .2s var(--ease-exit)';
  n.style.opacity = '0';
  // 밀어 닫으면 민 방향으로 빠지고, 시간이 다 되면 살짝 내려가며 사라진다
  const base = n.style.transform || '';
  n.style.transform = dir === 'left' ? `${base} translateX(-110%)` : dir === 'right' ? `${base} translateX(110%)`
    : `${base} translateY(${dir === 'down' ? 60 : 12}px)`;
  restack();
  setTimeout(() => {
    n.remove();
    const root = rootEl();
    if (root && !root.childElementCount) try { root.hidePopover?.(); } catch { /* 이미 닫힘 */ }
  }, reduceMotion() ? 0 : 200);
}

// 손가락·마우스로 밀어 닫기: 1:1 로 따라오고, 위로는 저항. 45px 넘게 또는 빠르게 밀면 닫힌다
function bindSwipe(item) {
  const n = item.node;
  let start = null, dx = 0, dy = 0, xs = [], ys = [];
  n.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    start = { x: e.clientX, y: e.clientY };
    dx = 0; dy = 0;
    xs = [{ t: e.timeStamp, y: e.clientX }];
    ys = [{ t: e.timeStamp, y: e.clientY }];
    item.dragging = true;
    item.timer.pause(now());
    n.style.transition = 'none';
    try { n.setPointerCapture(e.pointerId); } catch { /* 합성 이벤트면 무시 */ }
  });
  n.addEventListener('pointermove', (e) => {
    if (!start) return;
    dx = e.clientX - start.x;
    dy = e.clientY - start.y;
    xs.push({ t: e.timeStamp, y: e.clientX });
    ys.push({ t: e.timeStamp, y: e.clientY });
    if (xs.length > 20) { xs.shift(); ys.shift(); }
    const across = Math.abs(dx) >= Math.abs(dy);
    const tx = across ? dx : 0;
    const ty = across ? 0 : (dy > 0 ? dy : resist(dy));
    n.style.transform = `translate(${tx}px, ${ty}px)`;
    n.style.opacity = String(1 - Math.min(Math.abs(tx) / 240, 0.5));
  });
  const end = (e) => {
    if (!start) return;
    start = null;
    item.dragging = false;
    n.style.transition = '';
    const dir = swipeOut({ dx, dy, vx: velocity(xs, 100, e.timeStamp), vy: velocity(ys, 100, e.timeStamp) }); // 멈췄다 놓으면 튕긴 게 아니다
    if (dir) { dismiss(item, dir); return; }
    restack();
    if (!paused()) item.timer.resume(now());
  };
  n.addEventListener('pointerup', end);
  n.addEventListener('pointercancel', end);
  n.addEventListener('lostpointercapture', end);
}

// 한 번만: 마우스를 올리면 펼치고 멈춘다, 앱이 백그라운드면 멈춘다
function bindOnce(root) {
  if (bound) return;
  bound = true;
  const setExpanded = (value) => {
    if (expanded === value) return;
    expanded = value;
    live.forEach((t) => (paused() ? t.timer.pause(now()) : t.timer.resume(now()))); // 백그라운드면 펼침을 풀어도 멈춘 채로
    restack();
  };
  root.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') setExpanded(true); });
  root.addEventListener('pointerout', (e) => {
    if (e.pointerType === 'mouse' && !(e.relatedTarget instanceof Node && root.contains(e.relatedTarget))) setExpanded(false);
  });
  document.addEventListener('visibilitychange', () => {
    live.forEach((t) => (paused() ? t.timer.pause(now()) : t.timer.resume(now())));
  });
}
