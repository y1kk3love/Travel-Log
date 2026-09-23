import { el, toast, openModal, onSubmit } from '../ui.js';
import { setNickname } from '../db.js';
import { normalizeNickname } from '../lib/profile.js';
import { auth } from '../firebase.js';

// 내 닉네임 설정 창. 동행 목록에 이 이름이 보인다.
export function openProfileDialog(currentNickname = '') {
  const input = el('input', { class: 'input', id: 'pf-nick', value: currentNickname, maxlength: '20', placeholder: '예: 선민', autocomplete: 'off' });
  const dialog = el('dialog', {});
  const form = el('form', { method: 'dialog' },
    el('h2', { text: '내 닉네임' }),
    el('div', { class: 'dialog-body' },
      el('div', { class: 'field' }, el('label', { for: 'pf-nick', text: '닉네임 (20자까지)' }), input),
      el('p', { class: 'muted ps-hint', text: `로그인 계정: ${auth.currentUser?.email ?? ''}` })),
    el('div', { class: 'dialog-actions' },
      el('button', { type: 'button', class: 'btn', onClick: () => dialog.close() }, '취소'),
      el('button', { type: 'submit', class: 'btn btn-primary' }, '저장')));
  onSubmit(form, async (e) => { // 저장 중 연타 막기
    e.preventDefault();
    const nick = normalizeNickname(input.value);
    if (!nick) { toast('닉네임은 1~20자로 적어 주세요', { kind: 'error' }); input.focus(); return; }
    try { await setNickname(nick); toast('닉네임을 저장했어요'); dialog.close(); }
    catch (err) { console.error(err); toast('저장하지 못했어요', { kind: 'error' }); }
  });
  dialog.append(form);
  openModal(dialog);
  input.focus(); input.select();
}
