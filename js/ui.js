import { linkify } from './lib/text.js';
import { createOverlayStack } from './lib/overlays.js';
import { singleFlight } from './lib/single-flight.js';

// 열린 창(대화상자·장소 시트·사진 확대) 목록. 안드로이드 뒤로가기는 맨 위 창부터 닫는다.
export const overlays = createOverlayStack();
export function closeTopOverlay() { return overlays.closeTop(); }
const ICONS = {
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  close: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  drag: '<circle cx="9" cy="6" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.6" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.6" fill="currentColor" stroke="none"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>',
  back: '<polyline points="15 5 8 12 15 19"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  more: '<circle cx="5" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="2" fill="currentColor" stroke="none"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  expand: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/>',
  chart: '<line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="5"/><line x1="18" y1="20" x2="18" y2="14"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.3 3-5.5 6.5-5.5s6.5 2.2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.8c2.1.6 3.5 2.4 3.5 5.2"/>',
  plane: '<path d="M21 15.5v-2l-8-5V3.8a1.5 1.5 0 0 0-3 0v4.7l-8 5v2l8-2.5v4.5l-2 1.5V20l3.5-1 3.5 1v-1.5l-2-1.5V13z"/>',
  bed: '<path d="M3 18V6"/><path d="M3 13h18v5"/><path d="M21 13v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="10" r="2"/>',
  navigation: '<polygon points="3 11 21 3 13 21 11 13 3 11"/>',
  crosshair: '<circle cx="12" cy="12" r="7"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><circle cx="12" cy="12" r="2"/>',
  map: '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><polyline points="14 3 14 8 19 8"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><polyline points="21 16 15 10 5 20"/>',
};

export const CATEGORY_LABELS = { sight: '관광', food: '식사', cafe: '카페', shop: '쇼핑', stay: '숙소', move: '이동', etc: '기타', note: '메모' };
export const CATEGORY_ORDER = ['sight', 'food', 'cafe', 'shop', 'stay', 'move', 'etc'];

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

// 손가락으로 쓰는 기기(폰·태블릿)인가. 안내 문구를 "Ctrl+V" 대신 기기에 맞게 고를 때 쓴다.
export function isTouchDevice() {
  return !!globalThis.matchMedia?.('(pointer: coarse)').matches;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name] || '';
  return svg;
}

// 메모 글을 링크가 눌리는 조각들로 (긴 메모는 firstLineOnly 로 첫 줄만)
export function linkedText(text, { firstLineOnly = false } = {}) {
  const source = firstLineOnly ? String(text ?? '').split('\n')[0] : String(text ?? '');
  return linkify(source).map((p) => (p.type === 'link'
    ? el('a', { href: p.value, target: '_blank', rel: 'noopener', class: 'memo-link', text: p.label, onClick: (e) => e.stopPropagation() })
    : document.createTextNode(p.value)));
}

// 사진을 화면 가득 보여주는 라이트박스 (배경·닫기·Esc·뒤로가기로 닫힘)
export function openLightbox(src) {
  const onKey = (e) => { if (e.key === 'Escape' && entry.isTop()) close(); };
  const close = () => { box.remove(); entry.release(); document.removeEventListener('keydown', onKey); };
  const box = el('div', { class: 'lightbox', onClick: close },
    el('img', { src, alt: '' }),
    el('button', { type: 'button', class: 'btn btn-icon lightbox-close', 'aria-label': '닫기' }, icon('close')));
  const entry = overlays.push(close);
  document.addEventListener('keydown', onKey);
  document.body.append(box);
  return box;
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function photoPath(tripId, filename) {
  return `photos/${encodeURIComponent(tripId)}/${encodeURIComponent(filename)}`;
}

// action: { label, onClick } 을 주면 알림 안에 버튼 하나(예: 되돌리기)를 둔다
export function toast(message, { kind = 'info', ms = 2800, action = null } = {}) {
  const root = document.getElementById('toast-root');
  const node = el('div', { class: `toast${kind === 'error' ? ' toast-error' : ''}${action ? ' toast-with-action' : ''}`, role: kind === 'error' ? 'alert' : 'status' },
    el('span', { text: message }),
    action && el('button', { type: 'button', class: 'toast-action', onClick: () => { node.remove(); action.onClick(); } }, action.label));
  root.append(node);
  raiseToasts(root);
  setTimeout(() => {
    node.remove();
    if (!root.childElementCount) try { root.hidePopover?.(); } catch { /* 이미 닫힘 */ }
  }, ms);
}

// 모달 대화상자는 top layer 에 떠서 z-index 로는 그 위에 알림을 띄울 수 없다.
// 알림 영역을 popover 로 top layer 에 올리고, 띄울 때마다 닫았다 다시 열어 가장 위로 보낸다 (popover 미지원 브라우저는 예전처럼).
function raiseToasts(root) {
  if (!root || typeof root.showPopover !== 'function' || !root.childElementCount) return;
  try {
    if (root.matches(':popover-open')) root.hidePopover();
    root.showPopover();
  } catch { /* 지원하지 않으면 그냥 둔다 */ }
}

// 모달 <dialog>를 열고, 닫히면 DOM에서 제거한다. 라우트가 바뀌면(뒤로가기 등) 자동으로 닫힌다.
// 모달은 top layer에 있어서 해시가 바뀌어도 저절로 사라지지 않기 때문이다.
let dialogSeq = 0;
export function openModal(dialog) {
  // 화면 낭독기가 대화상자 이름을 읽도록 제목(h2)이나 첫 문장(확인 창)을 이름으로 잇는다
  if (!dialog.hasAttribute('aria-label') && !dialog.hasAttribute('aria-labelledby')) {
    const title = dialog.querySelector('h2') ?? dialog.querySelector(':scope > p, form > p');
    if (title) { title.id ||= `dlg-title-${++dialogSeq}`; dialog.setAttribute('aria-labelledby', title.id); }
  }
  const onRoute = () => dialog.close();
  const entry = overlays.push(() => dialog.close());
  window.addEventListener('hashchange', onRoute);
  dialog.addEventListener('close', () => { entry.release(); window.removeEventListener('hashchange', onRoute); dialog.remove(); });
  document.body.append(dialog);
  dialog.showModal();
  raiseToasts(document.getElementById('toast-root')); // 떠 있던 알림은 새 창 위로
}

// 폼 제출을 한 번에 하나만 처리하고, 처리하는 동안 제출 버튼을 잠근다 (연타로 두 번 저장되지 않게).
export function onSubmit(form, handler) {
  const run = singleFlight(async (e) => {
    const buttons = [...form.querySelectorAll('button[type="submit"]')];
    buttons.forEach((b) => { b.disabled = true; });
    try { await handler(e); } finally { buttons.forEach((b) => { b.disabled = false; }); }
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); run(e).catch((err) => console.error(err)); });
}

export function confirmDialog(message, { okText = '삭제', cancelText = '취소', danger = ['삭제', '빼기'].includes(okText) } = {}) {
  return new Promise((resolve) => {
    const dialog = el('dialog', {},
      el('p', { text: message }),
      el('div', { class: 'dialog-actions' },
        el('button', { type: 'button', class: 'btn', onClick: () => dialog.close('cancel') }, cancelText),
        el('button', { type: 'button', class: danger ? 'btn btn-primary btn-destructive' : 'btn btn-primary', onClick: () => dialog.close('ok') }, okText)));
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'));
    openModal(dialog);
  });
}
