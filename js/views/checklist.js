import { el, clear, toast, confirmDialog, openModal, icon } from '../ui.js';
import { watchChecklist, addChecklistItem, updateChecklistItem, deleteChecklistItem, renameChecklistGroup, deleteChecklistGroup } from '../db.js';

export function mount(content, ctx) {
  const { tripId } = ctx;
  const main = el('main', { class: 'container checklist-page' });
  content.append(main);
  const unsub = watchChecklist(tripId, (items) => draw(main, tripId, items),
    (err) => { console.error(err); toast('체크리스트를 불러오지 못했어요', { kind: 'error' }); });
  return () => unsub();
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

function draw(main, tripId, items) {
  clear(main);
  const done = items.filter((i) => i.done).length;
  const groups = groupItems(items);
  const fail = (msg) => (err) => { console.error(err); toast(msg, { kind: 'error' }); };

  main.append(
    el('div', { class: 'page-head' },
      el('div', {}, el('h2', { class: 'checklist-title', text: '체크리스트' }), el('p', { class: 'muted', text: `${done} / ${items.length} 완료` })),
      el('button', { class: 'btn', onClick: () => addGroupDialog(tripId, groups.length) }, icon('plus'), '그룹 추가')),
    el('div', { class: 'progress' }, el('div', { style: { width: items.length ? `${Math.round((done / items.length) * 100)}%` : '0%' } })),
    el('div', { class: 'checklist-groups' }, ...groups.map((g) => groupCard(tripId, g, fail))),
    ...(groups.length === 0 ? [el('p', { class: 'muted', text: '그룹을 추가해서 준비물을 적어 보세요.' })] : []));
}

function groupCard(tripId, group, fail) {
  const input = el('input', { class: 'inline-input', placeholder: '항목 추가', 'aria-label': `${group.name}에 항목 추가` });
  input.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter' || !input.value.trim()) return;
    e.preventDefault();
    const text = input.value.trim();
    input.value = '';
    await addChecklistItem(tripId, { group: group.name, groupOrder: group.groupOrder, text }).catch(fail('항목을 추가하지 못했어요'));
  });
  return el('section', { class: 'card check-group' },
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
  const box = el('input', { type: 'checkbox', id, checked: item.done, onChange: () => updateChecklistItem(tripId, item.id, { done: box.checked }).catch(fail('저장하지 못했어요')) });
  return el('div', { class: `check-row${item.done ? ' done' : ''}` },
    box,
    el('label', { for: id, text: item.text }),
    el('button', {
      class: 'btn btn-icon btn-sm check-edit', 'aria-label': `${item.text} 수정`,
      onClick: () => editItemDialog(tripId, item),
    }, icon('edit')),
    el('button', {
      class: 'btn btn-icon btn-sm check-delete', 'aria-label': `${item.text} 삭제`,
      onClick: () => deleteChecklistItem(tripId, item.id).catch(fail('삭제하지 못했어요')),
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
