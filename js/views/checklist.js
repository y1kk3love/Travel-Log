import { el, clear, toast, confirmDialog, openModal, icon } from '../ui.js';
import { watchChecklist, addChecklistItem, updateChecklistItem, deleteChecklistItem, renameChecklistGroup, deleteChecklistGroup } from '../db.js';
import { touchedRecently } from '../lib/motion.js';
import { enter, forgetEnter, growBar, haptic, skeleton } from '../motion.js';

// 방금 내가 체크한 항목 (id → 시각): 목록이 다시 그려져도 체크 애니메이션을 한 번만 준다
const touched = new Map();
// 그룹마다 이전에 다 채워져 있었나 (tripId|그룹 → bool): 방금 다 채운 그룹에만 OK 도장이 쾅
const wasDone = new Map();
let mounts = 0;

export function mount(content, ctx) {
  const { tripId } = ctx;
  const main = el('main', { class: 'container checklist-page' });
  content.append(main);
  main.append(skeleton('row', 4));
  const scope = `checklist:${++mounts}`;
  const unsub = watchChecklist(tripId, (items) => draw(main, tripId, items, scope),
    (err) => { console.error(err); toast('체크리스트를 불러오지 못했어요', { kind: 'error' }); });
  return () => { unsub(); forgetEnter(scope); };
}

function groupItems(items) {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item.group)) map.set(item.group, { name: item.group, groupOrder: item.groupOrder ?? 0, items: [] });
    map.get(item.group).items.push(item);
  }
  return [...map.values()]
    .sort((a, b) => a.groupOrder - b.groupOrder || a.name.localeCompare(b.name))
    .map((g) => ({ ...g, items: g.items.sort((a, b) => a.order - b.order) }));
}

function draw(main, tripId, items, scope) {
  // 동행이 고쳐서 목록이 다시 그려져도, 쓰던 "항목 추가" 칸의 글자·커서·키보드는 그대로 둔다
  const active = document.activeElement;
  const keep = active?.classList?.contains('inline-input') && main.contains(active)
    ? { group: active.dataset.group, value: active.value, start: active.selectionStart, end: active.selectionEnd } : null;
  clear(main);
  const done = items.filter((i) => i.done).length;
  const groups = groupItems(items);
  const fail = (msg) => (err) => { console.error(err); toast(msg, { kind: 'error' }); };
  const fill = el('div');
  const cards = groups.map((g) => groupCard(tripId, g, fail));

  main.append(
    el('div', { class: 'page-head' },
      el('div', {}, el('h2', { class: 'checklist-title', text: '체크리스트' }), el('p', { class: 'muted', text: `${done} / ${items.length} 완료` })),
      el('button', { class: 'btn', onClick: () => addGroupDialog(tripId, groups.length) }, icon('plus'), '그룹 추가')),
    el('div', { class: 'progress' }, fill),
    el('div', { class: 'checklist-groups' }, ...cards),
    ...(groups.length === 0 ? [el('p', { class: 'muted', text: '그룹을 추가해서 준비물을 적어 보세요.' })] : []));
  growBar(fill, `checklist:${tripId}`, items.length ? Math.round((done / items.length) * 100) : 0);
  enter(scope, groups.map((g, i) => ({ el: cards[i], key: g.name })));
  if (keep) {
    const next = [...main.querySelectorAll('.inline-input')].find((i) => i.dataset.group === keep.group);
    if (next) { next.value = keep.value; next.focus({ preventScroll: true }); try { next.setSelectionRange(keep.start, keep.end); } catch { /* 커서 위치 못 옮겨도 됨 */ } }
  }
}

function groupCard(tripId, group, fail) {
  const input = el('input', { class: 'inline-input', placeholder: '항목 추가', enterkeyhint: 'done', 'aria-label': `${group.name}에 항목 추가`, dataset: { group: group.name } });
  input.addEventListener('keydown', async (e) => {
    if (e.isComposing || e.keyCode === 229) return; // 한글 조합 중 Enter 는 글자 확정용 (마지막 글자가 두 번 들어가지 않게)
    if (e.key !== 'Enter' || !input.value.trim()) return;
    e.preventDefault();
    const text = input.value.trim();
    input.value = '';
    await addChecklistItem(tripId, { group: group.name, groupOrder: group.groupOrder, text }).catch(fail('항목을 추가하지 못했어요'));
  });
  const allDone = group.items.length > 0 && group.items.every((i) => i.done); // 다 채우면 캐리어 태그에 OK 도장
  const doneKey = `${tripId}|${group.name}`;
  // 방금 내가 체크해서 다 채워졌을 때만 도장이 쾅 (동행이 채웠거나 처음 열 때는 그냥 찍혀 있다)
  const justDone = allDone && wasDone.get(doneKey) === false && group.items.some((i) => touchedRecently(touched, i.id, Date.now()));
  wasDone.set(doneKey, allDone);
  if (justDone) haptic('success');
  return el('section', { class: `card check-group${allDone ? ' all-done' : ''}${justDone ? ' just-done' : ''}` },
    el('div', { class: 'check-group-head' },
      el('span', { class: 'check-group-name', text: group.name }),
      el('div', {},
        el('button', {
          class: 'btn btn-icon btn-sm', 'aria-label': '그룹 이름 바꾸기',
          onClick: () => renameGroupDialog(tripId, group.name),
        }, icon('edit')),
        el('button', {
          class: 'btn btn-icon btn-sm', 'aria-label': '그룹 삭제',
          onClick: async () => {
            if (!(await confirmDialog(`'${group.name}' 그룹과 항목 ${group.items.length}개를 삭제할까요?`))) return;
            await deleteChecklistGroup(tripId, group.name).catch(fail('삭제하지 못했어요'));
          },
        }, icon('trash')))),
    ...group.items.map((item) => checkRow(tripId, item, fail)),
    el('div', { class: 'check-row check-add' }, icon('plus'), input));
}

function checkRow(tripId, item, fail) {
  const id = `chk-${item.id}`;
  const box = el('input', {
    type: 'checkbox', id, checked: item.done,
    onChange: () => {
      if (box.checked) { touched.set(item.id, Date.now()); haptic('light'); }
      updateChecklistItem(tripId, item.id, { done: box.checked }).catch(fail('저장하지 못했어요'));
    },
  });
  const just = item.done && touchedRecently(touched, item.id, Date.now()); // 방금 체크: 톡 튀고 취소선이 그어진다
  return el('div', { class: `check-row${item.done ? ' done' : ''}${just ? ' just-checked' : ''}` },
    box,
    el('label', { for: id }, el('span', { class: 'check-text', text: item.text })),
    el('button', {
      class: 'btn btn-icon btn-sm check-edit', 'aria-label': `${item.text} 수정`,
      onClick: () => editItemDialog(tripId, item),
    }, icon('edit')),
    el('button', {
      class: 'btn btn-icon btn-sm check-delete', 'aria-label': `${item.text} 삭제`,
      onClick: async () => {
        try { await deleteChecklistItem(tripId, item.id); }
        catch (err) { fail('삭제하지 못했어요')(err); return; }
        // 확인 창 대신 되돌리기: 자주 쓰는 동작이라 매번 묻지 않고, 실수는 바로 되살린다
        toast(`'${item.text}' 항목을 지웠어요`, {
          ms: 5000,
          action: { label: '되돌리기', onClick: () => addChecklistItem(tripId, { group: item.group, groupOrder: item.groupOrder, text: item.text, order: item.order, done: item.done }).catch(fail('되돌리지 못했어요')) },
        });
      },
    }, icon('close')));
}

function promptDialog({ title, value = '', okText = '저장' }) {
  return new Promise((resolve) => {
    const input = el('input', { class: 'input', value, required: true });
    const dialog = el('dialog', {});
    const form = el('form', { method: 'dialog' },
      el('h2', { text: title }), el('div', { class: 'dialog-body' }, input),
      el('div', { class: 'dialog-actions' },
        el('button', { type: 'button', class: 'btn', onClick: () => dialog.close() }, '취소'),
        el('button', { type: 'submit', class: 'btn btn-primary' }, okText)));
    form.addEventListener('submit', (e) => { e.preventDefault(); dialog.close(); resolve(input.value.trim()); });
    dialog.addEventListener('close', () => resolve(null));
    dialog.append(form); openModal(dialog); input.focus(); input.select();
  });
}

async function editItemDialog(tripId, item) {
  const text = await promptDialog({ title: '항목 수정', value: item.text });
  if (!text || text === item.text) return;
  await updateChecklistItem(tripId, item.id, { text })
    .catch((err) => { console.error(err); toast('저장하지 못했어요', { kind: 'error' }); });
}

async function addGroupDialog(tripId, groupOrder) {
  const name = await promptDialog({ title: '새 그룹', okText: '추가' });
  if (!name) return;
  await addChecklistItem(tripId, { group: name, groupOrder, text: '첫 항목' })
    .catch((err) => { console.error(err); toast('그룹을 추가하지 못했어요', { kind: 'error' }); });
}

async function renameGroupDialog(tripId, from) {
  const to = await promptDialog({ title: '그룹 이름 바꾸기', value: from });
  if (!to || to === from) return;
  await renameChecklistGroup(tripId, from, to)
    .catch((err) => { console.error(err); toast('이름을 바꾸지 못했어요', { kind: 'error' }); });
}
