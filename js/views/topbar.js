import { el } from '../ui.js';
import { auth } from '../firebase.js';
import { signOut } from '../auth.js';

export function topbar({ backHref = null } = {}) {
  const offline = el('span', { class: 'offline-badge', text: '오프라인', hidden: navigator.onLine });
  const setOnline = () => { offline.hidden = navigator.onLine; };
  window.addEventListener('online', setOnline);
  window.addEventListener('offline', setOnline);
  return el('header', { class: 'topbar' },
    el('div', { class: 'topbar-left' },
      el('a', { href: '#/', class: 'wordmark', text: '여행 로그' }),
      backHref && el('a', { href: backHref, class: 'muted', text: '← 내 여행' })),
    el('div', { class: 'topbar-right' },
      offline,
      el('span', { class: 'topbar-email', text: auth.currentUser?.email ?? '' }),
      el('button', { class: 'btn btn-sm btn-ghost', onClick: () => signOut() }, '로그아웃')));
}
