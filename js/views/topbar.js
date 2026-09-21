import { el } from '../ui.js';
import { auth } from '../firebase.js';
import { signOut, isOwner } from '../auth.js';
import { watchMyProfile } from '../db.js';
import { displayNameFor } from '../lib/profile.js';
import { openProfileDialog } from './profile-dialog.js';
import { openUsageDialog } from './usage-dialog.js';
import { avatar } from './avatar.js';

// 뷰가 바뀔 때마다 topbar가 새로 만들어지므로 window 리스너는 모듈에서 한 번만 단다.
// 배지는 문서 안의 현재 것을 찾아 갱신한다 (떨어져 나간 헤더를 붙들지 않는다).
function syncOffline() {
  document.querySelectorAll('.offline-badge').forEach((badge) => { badge.hidden = navigator.onLine; });
}
window.addEventListener('online', syncOffline);
window.addEventListener('offline', syncOffline);

// 내 프로필도 모듈에서 한 번만 구독하고, 현재 문서의 이름 버튼들을 갱신한다.
let myProfile = null;
let profileUnsub = null;
function syncNames() {
  const email = auth.currentUser?.email ?? '';
  document.querySelectorAll('.topbar-me').forEach((btn) => {
    btn.replaceChildren(avatar(myProfile, email, 28), el('span', { class: 'topbar-me-name', text: displayNameFor(myProfile, email) }));
  });
}
function ensureProfileWatch() {
  if (profileUnsub || !auth.currentUser) return;
  profileUnsub = watchMyProfile((p) => { myProfile = p; syncNames(); });
}

export function topbar({ backHref = null } = {}) {
  ensureProfileWatch();
  const offline = el('span', { class: 'offline-badge', text: '오프라인', hidden: navigator.onLine });
  const email = auth.currentUser?.email ?? '';
  return el('header', { class: 'topbar' },
    el('div', { class: 'topbar-left' },
      el('a', { href: '#/', class: 'wordmark', text: '여행 로그' }),
      backHref && el('a', { href: backHref, class: 'topbar-back', text: '‹ 내 여행' })),
    el('div', { class: 'topbar-right' },
      offline,
      // 사이트 주인만: 지도 API 한도와 콘솔 바로가기
      isOwner(auth.currentUser) && el('button', { class: 'btn btn-sm btn-ghost topbar-usage', title: 'Google 지도 API 사용량', onClick: () => openUsageDialog() }, 'API 사용량'),
      el('button', {
        class: 'btn btn-sm btn-ghost topbar-me', title: `${email} · 닉네임 바꾸기`,
        onClick: () => openProfileDialog(myProfile?.nickname ?? ''),
      }, avatar(myProfile, email, 28), el('span', { class: 'topbar-me-name', text: displayNameFor(myProfile, email) })),
      el('button', { class: 'btn btn-sm btn-ghost', onClick: () => { if (profileUnsub) { profileUnsub(); profileUnsub = null; myProfile = null; } signOut(); } }, '로그아웃')));
}
