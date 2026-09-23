import { el } from '../ui.js';
import { auth } from '../firebase.js';
import { signOut, isOwner } from '../auth.js';
import { watchMyProfile } from '../db.js';
import { displayNameFor } from '../lib/profile.js';
import { openAccountMenu } from './account-menu.js';
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

function onSignOut() {
  if (profileUnsub) { profileUnsub(); profileUnsub = null; myProfile = null; }
  signOut();
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
      // 아바타 하나로 내 계정 메뉴(닉네임·초대 관리·사용량·앱 버전·로그아웃)를 연다. 폰에서도 모든 항목에 닿는다.
      el('button', {
        class: 'btn btn-sm btn-ghost topbar-me', title: email, 'aria-label': '내 계정 메뉴', 'aria-haspopup': 'dialog',
        onClick: () => openAccountMenu({ profile: myProfile, email, isSiteOwner: isOwner(auth.currentUser), onSignOut }),
      }, avatar(myProfile, email, 28), el('span', { class: 'topbar-me-name', text: displayNameFor(myProfile, email) }))));
}
