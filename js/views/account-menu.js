import { el, icon, openModal, confirmDialog } from '../ui.js';
import { displayNameFor } from '../lib/profile.js';
import { isNative, appVersion } from '../native.js';
import { avatar } from './avatar.js';
import { openProfileDialog } from './profile-dialog.js';
import { openUsageDialog } from './usage-dialog.js';
import { openInvitesDialog } from './invites-dialog.js';

// 상단 아바타를 누르면 여는 내 계정 메뉴. 폰에서는 아래에서 올라오는 시트, 넓은 화면에서는 오른쪽 위 메뉴.
// 사이트 주인만 초대 관리·사용량이 보이고, 앱에서는 앱 버전이 보인다. 로그아웃은 한 번 확인한다.
export function openAccountMenu({ profile, email, isSiteOwner, onSignOut }) {
  const dialog = el('dialog', { class: 'sheet-menu account-menu', 'aria-label': '내 계정' });
  // 메뉴 항목을 누르면 메뉴를 닫고 그 창을 연다 (창이 겹쳐 뜨지 않게)
  const then = (open) => () => { dialog.close(); open(); };
  const row = (iconName, label, onClick, extra = null) => el('button', { type: 'button', class: 'menu-row', onClick }, icon(iconName), el('span', { text: label }), extra);

  const version = el('span', { class: 'menu-row-value' });
  if (isNative()) appVersion().then((v) => { version.textContent = v ?? ''; });

  const rows = [
    row('user', '닉네임 바꾸기', then(() => openProfileDialog(profile?.nickname ?? ''))),
    isSiteOwner ? row('mail', '초대 관리', then(openInvitesDialog)) : null,
    isSiteOwner ? row('chart', '사용량과 한도', then(openUsageDialog)) : null,
    isNative() ? el('div', { class: 'menu-row menu-row-static' }, icon('phone'), el('span', { text: '앱 버전' }), version) : null,
  ].filter(Boolean);

  dialog.append(el('div', { class: 'sheet-menu-inner' },
    el('div', { class: 'account-head' },
      avatar(profile, email, 44),
      el('div', { class: 'account-head-text' },
        el('div', { class: 'account-name', text: displayNameFor(profile, email) }),
        el('div', { class: 'account-email', text: email })),
      el('button', { type: 'button', class: 'btn btn-icon', 'aria-label': '닫기', onClick: () => dialog.close() }, icon('close'))),
    el('div', { class: 'menu-group' }, rows),
    el('div', { class: 'menu-group' },
      el('button', {
        type: 'button', class: 'menu-row menu-row-danger',
        onClick: async () => {
          dialog.close();
          if (await confirmDialog('로그아웃할까요?', { okText: '로그아웃', danger: true })) onSignOut();
        },
      }, icon('logout'), el('span', { text: '로그아웃' })))));
  // 바깥(배경)을 누르면 닫힌다. 대화상자 여백이 0 이라 배경을 누를 때만 target 이 dialog 자신이다.
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  openModal(dialog);
  return dialog;
}
