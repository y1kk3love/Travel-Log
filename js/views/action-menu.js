import { el, icon, openModal } from '../ui.js';

// "더 보기" 메뉴. 폰에서는 아래에서 올라오는 시트, 넓은 화면에서는 누른 버튼 아래에 뜬다.
// items: [{ icon, label, onClick, danger?, disabled? }] (null 은 건너뛴다). 위험한 항목(삭제)은 따로 묶어 아래에 둔다.
export function openActionMenu({ title = null, anchor = null, items }) {
  const dialog = el('dialog', { class: 'sheet-menu action-menu', 'aria-label': title ?? '메뉴' });
  const row = (it) => el('button', {
    type: 'button', class: `menu-row${it.danger ? ' menu-row-danger' : ''}`, disabled: !!it.disabled,
    onClick: () => { dialog.close(); it.onClick(); },
  }, icon(it.icon), el('span', { text: it.label }));
  const list = items.filter(Boolean);
  const normal = list.filter((it) => !it.danger).map(row);
  const danger = list.filter((it) => it.danger).map(row);
  dialog.append(el('div', { class: 'sheet-menu-inner' },
    title ? el('div', { class: 'action-menu-title', text: title }) : null,
    normal.length ? el('div', { class: 'menu-group' }, normal) : null,
    danger.length ? el('div', { class: 'menu-group' }, danger) : null,
    el('div', { class: 'menu-group action-menu-cancel' },
      el('button', { type: 'button', class: 'menu-row menu-row-center', onClick: () => dialog.close() }, el('span', { text: '닫기' })))));
  // 넓은 화면: 누른 버튼 바로 아래, 오른쪽 끝을 맞춘다
  if (anchor && globalThis.matchMedia?.('(min-width: 641px)').matches) {
    const r = anchor.getBoundingClientRect();
    dialog.style.top = `${Math.round(r.bottom + 6)}px`;
    dialog.style.right = `${Math.max(16, Math.round(window.innerWidth - r.right))}px`;
  }
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // 바깥을 누르면 닫힘
  openModal(dialog);
  return dialog;
}
