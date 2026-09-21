import { el, toast, confirmDialog, openModal, icon } from '../ui.js';
import { watchAllowedUsers, setAllowedUser, removeAllowedUser, getProfiles } from '../db.js';
import { normalizeEmail } from '../lib/members.js';
import { displayNameFor } from '../lib/profile.js';
import { avatar } from './avatar.js';

// 사이트 주인용 초대 관리: 초대 목록 전체를 보고, 이메일을 추가하고, 계정마다 "여행 만들기" 를 켜고 끈다.
export function openInvitesDialog() {
  const list = el('div', { class: 'member-list' });
  const input = el('input', { class: 'input', id: 'iv-email', type: 'email', placeholder: '초대할 Google 이메일', autocomplete: 'off' });
  let profiles = {};
  let users = [];

  function draw() {
    if (!users.length) { list.replaceChildren(el('p', { class: 'muted', text: '아직 초대한 계정이 없어요.' })); return; }
    list.replaceChildren(...users.map((u) => el('div', { class: 'member-row' },
      avatar(profiles[u.email], u.email, 36),
      el('span', { class: 'member-email' },
        el('span', { class: 'member-name', text: displayNameFor(profiles[u.email], u.email) }),
        el('span', { class: 'muted member-sub', text: u.email })),
      el('label', { class: 'check-inline invite-create', title: '켜면 이 계정이 새 여행을 만들 수 있어요' },
        el('input', {
          type: 'checkbox', checked: u.canCreate === true,
          onChange: async (e) => {
            try { await setAllowedUser(u.email, { canCreate: e.target.checked }); toast(e.target.checked ? `${u.email} 님이 여행을 만들 수 있어요` : '여행 만들기를 껐어요'); }
            catch (err) { console.error(err); e.target.checked = !e.target.checked; toast('바꾸지 못했어요', { kind: 'error' }); }
          },
        }), '여행 만들기'),
      el('button', {
        type: 'button', class: 'btn btn-icon btn-sm', 'aria-label': `${u.email} 초대 취소`,
        onClick: async () => {
          if (!(await confirmDialog(`${u.email} 님을 초대 목록에서 뺄까요? 이미 동행인 여행에는 그대로 남아요.`, { okText: '빼기' }))) return;
          try { await removeAllowedUser(u.email); toast('초대 목록에서 뺐어요'); }
          catch (err) { console.error(err); toast('빼지 못했어요', { kind: 'error' }); }
        },
      }, icon('close')))));
  }

  const unsub = watchAllowedUsers(async (rows) => {
    users = [...rows].sort((a, b) => a.email.localeCompare(b.email));
    draw();
    const missing = users.map((u) => u.email).filter((e) => !(e in profiles));
    if (missing.length) { Object.assign(profiles, await getProfiles(missing)); draw(); }
  }, (err) => { console.error(err); toast('초대 목록을 불러오지 못했어요', { kind: 'error' }); });

  const dialog = el('dialog', {});
  const form = el('form', { method: 'dialog' },
    el('h2', { text: '초대 관리' }),
    el('div', { class: 'dialog-body' },
      el('p', { class: 'muted ps-hint', text: '여기 있는 계정은 이 사이트에 로그인할 수 있어요. "여행 만들기"를 켜면 자기 여행을 만들고 동행을 초대할 수 있어요.' }),
      list,
      el('div', { class: 'field' },
        el('label', { for: 'iv-email', text: '이메일로 초대' }),
        el('div', { class: 'member-add' }, input, el('button', { type: 'submit', class: 'btn btn-primary' }, '추가')))),
    el('div', { class: 'dialog-actions' }, el('button', { type: 'button', class: 'btn', onClick: () => dialog.close() }, '닫기')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = normalizeEmail(input.value);
    if (!email) { toast('이메일 형식이 아니에요', { kind: 'error' }); input.focus(); return; }
    if (users.some((u) => u.email === email)) { toast('이미 초대 목록에 있어요'); input.value = ''; return; }
    try { await setAllowedUser(email, { canCreate: true }); input.value = ''; toast(`${email} 님을 추가했어요 (여행 만들기 켜짐)`); }
    catch (err) { console.error(err); toast('추가하지 못했어요', { kind: 'error' }); }
  });
  dialog.addEventListener('close', () => unsub());
  dialog.append(form);
  openModal(dialog);
  input.focus();
}
