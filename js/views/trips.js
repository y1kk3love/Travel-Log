import { el, clear, toast, confirmDialog, icon, photoPath } from '../ui.js';
import { topbar } from './topbar.js';
import { watchTrips, createTrip, deleteTrip, tripStats } from '../db.js';
import { tripStatus, formatStatus, formatRange, toDateStr, dayList } from '../lib/dates.js';
import { navigate } from '../router.js';

export function render(container) {
  const main = el('main', { class: 'container trips-page' });
  container.append(topbar(), main);
  const unsub = watchTrips(
    (trips) => draw(main, trips),
    (err) => {
      console.error(err);
      if (err.code === 'permission-denied') toast('접근 권한이 없어요. firestore.rules의 UID를 확인해 주세요', { kind: 'error', ms: 6000 });
      else toast('여행 목록을 불러오지 못했어요', { kind: 'error' });
    },
  );
  return () => unsub();
}

function draw(main, trips) {
  clear(main);
  const today = toDateStr(new Date());
  const withStatus = trips.map((t) => ({ ...t, status: tripStatus(t.startDate, t.endDate, today) }));
  const upcoming = withStatus.filter((t) => t.status.kind !== 'after').sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = withStatus.filter((t) => t.status.kind === 'after');

  main.append(
    el('div', { class: 'page-head' },
      el('div', {},
        el('h1', { text: '내 여행' }),
        el('p', { class: 'muted', text: `다가오는 여행 ${upcoming.length}개 · 지난 여행 ${past.length}개` })),
      el('button', { class: 'btn btn-primary', onClick: openNewTripDialog }, icon('plus'), '새 여행')),
    section('다가오는 여행', upcoming.map(featureCard), '아직 계획한 여행이 없어요. 새 여행을 만들어 보세요.'),
    section('지난 여행', past.map(smallCard), '지난 여행이 없어요.'),
  );
}

function section(title, cards, emptyText) {
  return el('section', { class: 'trips-section' },
    el('h2', { class: 'section-title', text: title }),
    cards.length ? el('div', { class: title === '지난 여행' ? 'trips-grid' : 'trips-list' }, cards)
      : el('p', { class: 'muted', text: emptyText }));
}

function cover(trip, className) {
  if (trip.coverPhoto) return el('img', { class: className, src: photoPath(trip.id, trip.coverPhoto), alt: '' });
  return el('div', { class: `${className} cover-empty`, text: '사진 없음' });
}

function deleteButton(trip) {
  return el('button', {
    class: 'btn btn-icon card-delete', 'aria-label': '여행 삭제',
    onClick: async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!(await confirmDialog(`'${trip.title}' 여행과 모든 일정을 삭제할까요?`))) return;
      try { await deleteTrip(trip.id); toast('여행을 삭제했어요'); }
      catch (err) { console.error(err); toast('삭제하지 못했어요', { kind: 'error' }); }
    },
  }, icon('trash'));
}

function featureCard(trip) {
  const stats = el('div', { class: 'trip-stats' });
  const bar = el('div', { class: 'progress' }, el('div', { style: { width: '0%' } }));
  tripStats(trip.id).then((s) => {
    if (!s) return;
    clear(stats);
    stats.append(
      stat('일정', `${s.days}일 · 장소 ${s.places}곳`),
      stat('체크리스트', `${s.checklistDone} / ${s.checklistTotal} 완료`),
      stat('예약', `${s.reservations}건`));
    bar.firstChild.style.width = s.checklistTotal ? `${Math.round((s.checklistDone / s.checklistTotal) * 100)}%` : '0%';
  });
  return el('a', { href: `#/trip/${trip.id}`, class: 'card trip-feature' },
    cover(trip, 'trip-feature-cover'),
    el('div', { class: 'trip-feature-body' },
      el('div', { class: 'trip-meta' },
        el('span', { class: 'badge', text: formatStatus(trip.status) }),
        el('span', { class: 'muted', text: formatRange(trip.startDate, trip.endDate) })),
      el('h2', { class: 'trip-title', text: trip.title }),
      stats, bar),
    deleteButton(trip));
}

function stat(label, value) {
  return el('div', { class: 'stat' }, el('span', { class: 'muted', text: label }), el('strong', { text: value }));
}

function smallCard(trip) {
  return el('a', { href: `#/trip/${trip.id}`, class: 'card trip-small' },
    cover(trip, 'trip-small-cover'),
    el('div', { class: 'trip-small-body' },
      el('h3', { text: trip.title }),
      el('p', { class: 'muted', text: formatRange(trip.startDate, trip.endDate) })),
    deleteButton(trip));
}

function openNewTripDialog() {
  const title = el('input', { class: 'input', id: 'nt-title', required: true, placeholder: '예: 오사카 · 교토' });
  const start = el('input', { class: 'input', id: 'nt-start', type: 'date', required: true });
  const end = el('input', { class: 'input', id: 'nt-end', type: 'date', required: true });
  const dialog = el('dialog', {});
  const form = el('form', { method: 'dialog' },
    el('h2', { text: '새 여행' }),
    el('div', { class: 'dialog-body' },
      el('div', { class: 'field' }, el('label', { for: 'nt-title', text: '여행 이름' }), title),
      el('div', { class: 'form-grid' },
        el('div', { class: 'field' }, el('label', { for: 'nt-start', text: '시작일' }), start),
        el('div', { class: 'field' }, el('label', { for: 'nt-end', text: '종료일' }), end))),
    el('div', { class: 'dialog-actions' },
      el('button', { type: 'button', class: 'btn', onClick: () => dialog.close() }, '취소'),
      el('button', { type: 'submit', class: 'btn btn-primary' }, '만들기')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (dayList(start.value, end.value).length === 0) {
      toast('종료일은 시작일보다 빠를 수 없어요', { kind: 'error' });
      return;
    }
    try {
      const id = await createTrip({ title: title.value, startDate: start.value, endDate: end.value });
      dialog.close();
      navigate(`/trip/${id}`);
    } catch (err) {
      console.error(err);
      toast('여행을 만들지 못했어요', { kind: 'error' });
    }
  });
  dialog.addEventListener('close', () => dialog.remove());
  dialog.append(form);
  document.body.append(dialog);
  dialog.showModal();
  title.focus();
}
