import { linkify } from './lib/text.js';
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

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function photoPath(tripId, filename) {
  return `photos/${encodeURIComponent(tripId)}/${encodeURIComponent(filename)}`;
}

export function toast(message, { kind = 'info', ms = 2800 } = {}) {
  const root = document.getElementById('toast-root');
  const node = el('div', { class: `toast${kind === 'error' ? ' toast-error' : ''}`, text: message });
  root.append(node);
  setTimeout(() => node.remove(), ms);
}

// 모달 <dialog>를 열고, 닫히면 DOM에서 제거한다. 라우트가 바뀌면(뒤로가기 등) 자동으로 닫힌다.
// 모달은 top layer에 있어서 해시가 바뀌어도 저절로 사라지지 않기 때문이다.
export function openModal(dialog) {
  const onRoute = () => dialog.close();
  window.addEventListener('hashchange', onRoute);
  dialog.addEventListener('close', () => { window.removeEventListener('hashchange', onRoute); dialog.remove(); });
  document.body.append(dialog);
  dialog.showModal();
}

export function confirmDialog(message, { okText = '삭제', cancelText = '취소' } = {}) {
  return new Promise((resolve) => {
    const dialog = el('dialog', {},
      el('p', { text: message }),
      el('div', { class: 'dialog-actions' },
        el('button', { type: 'button', class: 'btn', onClick: () => dialog.close('cancel') }, cancelText),
        el('button', { type: 'button', class: 'btn btn-primary', onClick: () => dialog.close('ok') }, okText)));
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'));
    openModal(dialog);
  });
}
