import { el, clear, toast, confirmDialog, openModal, icon, tabHead } from '../ui.js';
import { watchChecklist, watchTrip, addChecklistItem, updateChecklistItem, deleteChecklistItem, renameChecklistGroup, deleteChecklistGroup, setMyCheck } from '../db.js';
import { touchedRecently } from '../lib/motion.js';
import { isDoneFor, allCheckedAfter, personalProgress, checkedMembers } from '../lib/checklist.js';
import { auth } from '../firebase.js';
import { enter, growBar, haptic, skeleton } from '../motion.js';

// 방금 내가 체크한 항목 (id → 시각): 목록이 다시 그려져도 체크 애니메이션을 한 번만 준다
const touched = new Map();
// 그룹마다 이전에 다 채워져 있었나 (tripId|그룹 → bool): 방금 다 채운 그룹에만 OK 도장이 쾅
const wasDone = new Map();

// 체크리스트 항목은 두 가지 (lib/checklist.js):
// - 함께 챙기는 것(숙소 예약 등): 한 명이 체크하면 모두에게 체크된다
// - 각자 챙기는 것(여권·짐 등, personal): 사람마다 따로 체크하고 "3/8" 처럼 몇 명이 했는지 보인다
export function mount(content, ctx) {
  const { tripId } = ctx;
  const main = el('main', { class: 'container checklist-page' });
  content.append(main);
  main.append(skeleton('row', 4));
  const state = {
    tripId, items: null, members: ctx.trip?.memberEmails ?? [],
    me: (auth.currentUser?.email ?? '').toLowerCase(),
    scope: `checklist:${tripId}`, // 처음 열 때만 차례로, 그 뒤로는 새 그룹만
  };
  const redraw = () => { if (state.items) draw(main, state); };
  const unsubs = [
    watchChecklist(tripId, (items) => { state.items = items; redraw(); },
      (err) => { console.error(err); toast('체크리스트를 불러오지 못했어요', { kind: 'error' }); }),
    // 동행이 늘거나 줄면 "각자" 항목의 몇 명 중 몇 명이 바뀐다
    watchTrip(tripId, (trip) => { if (trip) { state.members = trip.memberEmails ?? []; redraw(); } }, (err) => console.warn('trip', err)),
  ];
  return () => unsubs.forEach((u) => u());
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

function draw(main, state) {
  const { tripId, items } = state;
  // 동행이 고쳐서 목록이 다시 그려져도, 쓰던 "항목 추가" 칸의 글자·커서·키보드는 그대로 둔다
  const active = document.activeElement;
  const keep = active?.classList?.contains('inline-input') && main.contains(active)
    ? { group: active.dataset.group, value: active.value, start: active.selectionStart, end: active.selectionEnd } : null;
  clear(main);
  const done = items.filter((i) => isDoneFor(i, state.me)).length; // 각자 항목은 내가 체크했는지로 센다
  const groups = groupItems(items);
  const fail = (msg) => (err) => { console.error(err); toast(msg, { kind: 'error' }); };
  const fill = el('div');
  const cards = groups.map((g) => groupCard(state, g, fail));

  main.append(
    tabHead({ title: '체크리스트', count: `${done} / ${items.length} 완료`, addLabel: '그룹 추가', onAdd: () => addGroupDialog(tripId, groups.length) }),
    el('div', { class: 'progress' }, fill),
    el('div', { class: 'checklist-groups' }, ...cards),
    ...(groups.length === 0 ? [el('p', { class: 'muted', text: '그룹을 추가해서 준비물을 적어 보세요.' })] : []));
  growBar(fill, `checklist:${tripId}`, items.length ? Math.round((done / items.length) * 100) : 0);
  enter(state.scope, groups.map((g, i) => ({ el: cards[i], key: g.name })));
  if (keep) {
    const next = [...main.querySelectorAll('.inline-input')].find((i) => i.dataset.group === keep.group);
    if (next) { next.value = keep.value; next.focus({ preventScroll: true }); try { next.setSelectionRange(keep.start, keep.end); } catch { /* 커서 위치 못 옮겨도 됨 */ } }
  }
}

function groupCard(state, group, fail) {
  const { tripId } = state;
  const input = el('input', { class: 'inline-input', placeholder: '항목 추가', enterkeyhint: 'done', 'aria-label': `${group.name}에 항목 추가`, dataset: { group: group.name } });
  input.addEventListener('keydown', async (e) => {
    if (e.isComposing || e.keyCode === 229) return; // 한글 조합 중 Enter 는 글자 확정용 (마지막 글자가 두 번 들어가지 않게)
    if (e.key !== 'Enter' || !input.value.trim()) return;
    e.preventDefault();
    const text = input.value.trim();
    input.value = '';
    await addChecklistItem(tripId, { group: group.name, groupOrder: group.groupOrder, text }).catch(fail('항목을 추가하지 못했어요'));
  });
  const allDone = group.items.length > 0 && group.items.every((i) => isDoneFor(i, state.me)); // 다 채우면 캐리어 태그에 OK 도장
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
    ...group.items.map((item) => checkRow(state, item, fail)),
    el('div', { class: 'check-row check-add' }, icon('plus'), input));
}

function checkRow(state, item, fail) {
  const { tripId, members, me } = state;
  const id = `chk-${item.id}`;
  const mine = isDoneFor(item, me);
  const progress = personalProgress(item, members); // 각자 항목이면 { done, total }
  const box = el('input', {
    type: 'checkbox', id, checked: mine,
    onChange: () => {
      if (box.checked) { touched.set(item.id, Date.now()); haptic('light'); }
      const write = item.personal
        ? setMyCheck(tripId, item.id, { checked: box.checked, done: allCheckedAfter(item, members, me, box.checked) })
        : updateChecklistItem(tripId, item.id, { done: box.checked });
      write.catch(fail('저장하지 못했어요'));
    },
  });
  const just = mine && touchedRecently(touched, item.id, Date.now()); // 방금 체크: 톡 튀고 취소선이 그어진다
  return el('div', { class: `check-row${mine ? ' done' : ''}${just ? ' just-checked' : ''}` },
    box,
    el('label', { for: id }, el('span', { class: 'check-text', text: item.text })),
    progress ? el('span', {
      class: `tag check-personal${progress.done === progress.total ? ' full' : ''}`,
      title: '사람마다 따로 체크하는 항목', 'aria-label': `각자 챙기기, ${progress.total}명 중 ${progress.done}명 완료`,
      text: `각자 ${progress.done}/${progress.total}`,
    }) : null,
    el('button', {
      class: 'btn btn-icon btn-sm check-edit', 'aria-label': `${item.text} 수정`,
      onClick: () => editItemDialog(state, item),
    }, icon('edit')),
    el('button', {
      class: 'btn btn-icon btn-sm check-delete', 'aria-label': `${item.text} 삭제`,
      onClick: async () => {
        try { await deleteChecklistItem(tripId, item.id); }
        catch (err) { fail('삭제하지 못했어요')(err); return; }
        // 확인 창 대신 되돌리기: 자주 쓰는 동작이라 매번 묻지 않고, 실수는 바로 되살린다
        toast(`'${item.text}' 항목을 지웠어요`, {
          ms: 5000,
          action: {
            label: '되돌리기',
            onClick: () => addChecklistItem(tripId, {
              group: item.group, groupOrder: item.groupOrder, text: item.text, order: item.order, done: item.done,
              personal: !!item.personal, doneBy: item.doneBy ?? [],
            }).catch(fail('되돌리지 못했어요')),
          },
        });
      },
    }, icon('close')));
}

// 글자 하나를 묻는 작은 창. extra: 입력칸 아래에 둘 요소 (항목 수정의 "각자 챙기기")
function promptDialog({ title, value = '', okText = '저장', extra = null }) {
  return new Promise((resolve) => {
    const input = el('input', { class: 'input', value, required: true });
    const dialog = el('dialog', {});
    const form = el('form', { method: 'dialog' },
      el('h2', { text: title }), el('div', { class: 'dialog-body' }, input, extra),
      el('div', { class: 'dialog-actions' },
        el('button', { type: 'button', class: 'btn', onClick: () => dialog.close() }, '취소'),
        el('button', { type: 'submit', class: 'btn btn-primary' }, okText)));
    form.addEventListener('submit', (e) => { e.preventDefault(); dialog.close(); resolve(input.value.trim()); });
    dialog.addEventListener('close', () => resolve(null));
    dialog.append(form); openModal(dialog); input.focus(); input.select();
  });
}

async function editItemDialog(state, item) {
  const { tripId, members, me } = state;
  // 동행이 둘 이상일 때만: 이 항목을 사람마다 따로 체크할지
  const personal = el('input', { type: 'checkbox', id: 'ck-personal', checked: !!item.personal });
  const extra = members.length > 1 ? el('div', {},
    el('label', { class: 'check-inline', for: 'ck-personal' }, personal, '각자 챙기기 (사람마다 따로 체크)'),
    el('p', { class: 'muted ps-hint', text: '여권·짐처럼 사람마다 챙겨야 하는 항목에 켜 두면, 한 명이 체크해도 다른 사람 것은 그대로 남아요.' })) : null;
  const text = await promptDialog({ title: '항목 수정', value: item.text, extra });
  if (!text) return;
  const data = {};
  if (text !== item.text) data.text = text;
  if (extra && personal.checked !== !!item.personal) {
    if (personal.checked) {
      // 켜기: 이미 체크돼 있던 항목은 지금 동행 모두가 한 것으로 옮긴다
      Object.assign(data, { personal: true, doneBy: item.done ? members : [], done: !!item.done });
    } else {
      // 끄기: 모두가 체크했을 때만 체크된 채로 남긴다
      const everyone = members.length > 0 && checkedMembers(item, members).length === members.length;
      Object.assign(data, { personal: false, doneBy: [], done: everyone });
    }
  }
  if (!Object.keys(data).length) return;
  if (data.personal === false && isDoneFor(item, me) && !data.done) toast('함께 챙기는 항목으로 바꿨어요. 아직 안 한 사람이 있어 체크는 풀렸어요', { ms: 4500 });
  await updateChecklistItem(tripId, item.id, data)
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
