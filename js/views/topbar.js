import { el } from '../ui.js';
import { auth } from '../firebase.js';
import { signOut } from '../auth.js';

// 뷰가 바뀔 때마다 topbar가 새로 만들어지므로 window 리스너는 모듈에서 한 번만 단다.
// 배지는 문서 안의 현재 것을 찾아 갱신한다 (떨어져 나간 헤더를 붙들지 않는다).
function syncOffline() {
  document.querySelectorAll('.offline-badge').forEach((badge) => { badge.hidden = navigator.onLine; });
}
window.addEventListener('online', syncOffline);
window.addEventListener('offline', syncOffline);

export function topbar({ backHref = null } = {}) {
  const offline = el('span', { class: 'offline-badge', text: '오프라인', hidden: navigator.onLine });
  return el('header', { class: 'topbar' },
    el('div', { class: 'topbar-left' },
      el('a', { href: '#/', class: 'wordmark', text: '여행 로그' }),
      backHref && el('a', { href: backHref, class: 'muted', text: '← 내 여행' })),
    el('div', { class: 'topbar-right' },
      offline,
      el('span', { class: 'topbar-email', text: auth.currentUser?.email ?? '' }),
      el('button', { class: 'btn btn-sm btn-ghost', onClick: () => signOut() }, '로그아웃')));
}
