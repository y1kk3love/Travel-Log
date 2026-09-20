import { el, toast, confirmDialog, openModal, icon } from '../ui.js';
import { addMember, removeMember, getProfiles } from '../db.js';
import { normalizeEmail, isTripOwner } from '../lib/members.js';
import { displayNameFor } from '../lib/profile.js';
import { avatar } from './avatar.js';
import { auth } from '../firebase.js';

// 동행 관리 창. 소유자만 추가·삭제할 수 있고, 동행은 목록만 본다.
export function openMembersDialog(trip) {
  const owner = isTripOwner(trip, auth.currentUser);
  const list = el('div', { class: 'member-list' });
  const input = el('input', { class: 'input', id: 'mb-email', type: 'email', placeholder: '초대할 Google 이메일', autocomplete: 'off' });

  let profiles = {};
  function draw(members) {
    list.replaceChildren(...members.map((email) => el('div', { class: 'member-row' },
      avatar(profiles[email], email, 36),
      el('span', { class: 'member-email' },
        el('span', { class: 'member-name', text: displayNameFor(profiles[email], email) }),
        el('span', { class: 'muted member-sub', text: email })),
      email === trip.ownerEmail ? el('span', { class: 'tag', text: '주인' }) : null,
      owner && email !== trip.ownerEmail ? el('button', {
        type: 'button', class: 'btn btn-icon btn-sm', 'aria-label': `${email} 내보내기`,
        onClick: async () => {
          if (!(await confirmDialog(`${email} 님을 이 여행에서 내보낼까요?`, { okText: '내보내기' }))) return;
          try { await removeMember(trip.id, email); members = members.filter((m) => m !== email); draw(members); toast('내보냈어요'); }
          catch (err) { console.error(err); toast('내보내지 못했어요', { kind: 'error' }); }
        },
      }, icon('close')) : null)));
  }

  let members = [...(trip.memberEmails ?? [])];
  draw(members);
  getProfiles(members).then((p) => { profiles = p; draw(members); });

  const dialog = el('dialog', {});
  const form = el('form', { method: 'dialog' },
    el('h2', { text: '동행' }),
    el('div', { class: 'dialog-body' },
      list,
      owner ? el('div', { class: 'field' },
        el('label', { for: 'mb-email', text: '이메일로 초대' }),
        el('div', { class: 'member-add' }, input, el('button', { type: 'submit', class: 'btn btn-primary' }, '초대')),
        el('p', { class: 'muted ps-hint', text: '초대받은 사람이 그 Google 계정으로 로그인하면 이 여행이 홈에 보이고 함께 편집할 수 있어요.' }))
        : el('p', { class: 'muted ps-hint', text: '동행 초대와 내보내기는 여행 주인만 할 수 있어요.' })),
    el('div', { class: 'dialog-actions' }, el('button', { type: 'button', class: 'btn', onClick: () => dialog.close() }, '닫기')));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!owner) { dialog.close(); return; }
    const email = normalizeEmail(input.value);
    if (!email) { toast('이메일 형식이 아니에요', { kind: 'error' }); input.focus(); return; }
    if (members.includes(email)) { toast('이미 동행이에요'); input.value = ''; return; }
    try {
      await addMember(trip.id, email);
      members = [...members, email]; draw(members); input.value = '';
      toast(`${email} 님을 초대했어요`);
    } catch (err) {
      console.error(err);
      toast('초대하지 못했어요', { kind: 'error' });
    }
  });

  dialog.append(form);
  openModal(dialog);
  if (owner) input.focus();
}
