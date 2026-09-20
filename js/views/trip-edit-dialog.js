import { el, toast, confirmDialog, openModal } from '../ui.js';
import { updateTripSchedule, countPlacesInDays, watchDays } from '../db.js';
import { dayList } from '../lib/dates.js';
import { planScheduleChange } from '../lib/schedule.js';

// 여행 제목·기간 수정 창 (사이트 주인만 연다).
export function openTripEditDialog(trip) {
  const title = el('input', { class: 'input', id: 'te-title', value: trip.title, required: true });
  const start = el('input', { class: 'input', id: 'te-start', type: 'date', value: trip.startDate, required: true });
  const end = el('input', { class: 'input', id: 'te-end', type: 'date', value: trip.endDate, required: true });
  const hint = el('p', { class: 'muted ps-hint', text: '시작일을 바꾸면 모든 Day 날짜가 같이 밀리고 장소는 그대로예요. 종료일을 늘리면 뒤에 Day가 추가되고, 줄이면 뒤쪽 Day가 사라져요.' });
  const dialog = el('dialog', {});
  const form = el('form', { method: 'dialog' },
    el('h2', { text: '여행 정보 수정' }),
    el('div', { class: 'dialog-body' },
      el('div', { class: 'field' }, el('label', { for: 'te-title', text: '여행 이름' }), title),
      el('div', { class: 'form-grid' },
        el('div', { class: 'field' }, el('label', { for: 'te-start', text: '시작일' }), start),
        el('div', { class: 'field' }, el('label', { for: 'te-end', text: '종료일' }), end)),
      hint),
    el('div', { class: 'dialog-actions' },
      el('button', { type: 'button', class: 'btn', onClick: () => dialog.close() }, '취소'),
      el('button', { type: 'submit', class: 'btn btn-primary' }, '저장')));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = title.value.trim();
    if (!name) { toast('여행 이름을 입력해 주세요', { kind: 'error' }); title.focus(); return; }
    if (dayList(start.value, end.value).length === 0) { toast('종료일은 시작일보다 빠를 수 없어요', { kind: 'error' }); return; }
    try {
      // 줄어드는 Day가 있으면 지워질 장소 수를 알려 주고 확인받는다
      const days = await new Promise((r) => { const u = watchDays(trip.id, (d) => { u(); r(d); }); });
      const plan = planScheduleChange(days, start.value, end.value);
      if (plan && plan.remove.length) {
        const n = await countPlacesInDays(trip.id, plan.remove);
        const ok = await confirmDialog(`뒤쪽 Day ${plan.remove.length}일이 사라져요. 그 날의 장소 ${n}곳도 함께 삭제돼요. 계속할까요?`, { okText: '줄이기' });
        if (!ok) return;
      }
      await updateTripSchedule(trip.id, { title: name, startDate: start.value, endDate: end.value });
      toast('여행 정보를 저장했어요');
      dialog.close();
    } catch (err) {
      console.error(err);
      toast('저장하지 못했어요', { kind: 'error' });
    }
  });

  dialog.append(form);
  openModal(dialog);
  title.focus(); title.select();
}
