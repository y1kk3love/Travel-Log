import { el, clear, toast, icon } from '../ui.js';
import { topbar } from './topbar.js';
import { watchTrips, watchDays } from '../db.js';
import { tripStatus, formatStatus, formatRange, formatShort, toDateStr } from '../lib/dates.js';
import { navigate } from '../router.js';

// 공유로 들어온 텍스트는 메모리에만 둔다 (라우트를 오가도 유지, 새로고침이면 사라짐)
let pending = null;
export function setPendingShare(text) { pending = text; }
const takePendingShare = () => { const t = pending; pending = null; return t; };
const peekPendingShare = () => pending;
// 장소 창을 열 때 planner 가 꺼내 쓴다: { tripId, dayId(null=보관함), text }
let target = null;
export function takeShareTarget() { const t = target; target = null; return t; }

// 앱 전용 화면: "어느 여행 → 어느 날에 넣을까요?" 를 고르면 그 여행의 일정 화면에서 장소 추가 창이 열린다
export function render(container) {
  const text = peekPendingShare();
  const main = el('main', { class: 'container share-page' });
  container.append(topbar({ backHref: '#/' }), main);
  if (!text) { toast('공유된 내용이 없어요'); navigate('/'); return () => {}; }
  let unsubDays = null;
  let lastTrips = [];
  const unsub = watchTrips((trips) => { lastTrips = trips; drawTrips(main, trips, text); }, (err) => { console.error(err); toast('여행 목록을 불러오지 못했어요', { kind: 'error' }); });

  function drawTrips(root, trips, sharedText) {
    clear(root);
    const today = toDateStr(new Date());
    // 진행 중·다가오는 여행이 위(가까운 순), 지난 여행은 아래(최근 순)
    const sorted = [...trips].map((t) => ({ ...t, status: tripStatus(t.startDate, t.endDate, today) }))
      .sort((a, b) => {
        const pa = a.status.kind === 'after', pb = b.status.kind === 'after';
        if (pa !== pb) return pa - pb;
        return pa ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate);
      });
    const body = sorted.length
      ? el('div', { class: 'share-pick-list' }, ...sorted.map((t) => el('button', { class: 'card share-trip', onClick: () => drawDays(root, t, sharedText) },
        el('strong', { text: t.title }), el('span', { class: 'muted', text: `${formatRange(t.startDate, t.endDate)} · ${formatStatus(t.status)}` }))))
      : el('div', { class: 'card share-empty' },
        el('p', { text: '아직 여행이 없어요. 먼저 여행을 만든 뒤 다시 공유해 주세요.' }),
        el('a', { class: 'btn btn-primary btn-sm', href: '#/', text: '내 여행으로' }));
    root.append(
      el('div', { class: 'page-head' }, el('div', {}, el('h2', { class: 'checklist-title', text: '어느 여행에 넣을까요?' }),
        el('p', { class: 'muted', text: sharedText.split('\n')[0].slice(0, 60) }))),
      body);
  }

  function drawDays(root, trip, sharedText) {
    if (unsubDays) unsubDays();
    unsubDays = watchDays(trip.id, (days) => {
      clear(root);
      const go = (dayId) => { target = { tripId: trip.id, dayId, text: sharedText }; takePendingShare(); navigate(`/trip/${trip.id}`); };
      root.append(
        el('div', { class: 'page-head' }, el('div', {}, el('h2', { class: 'checklist-title', text: trip.title }), el('p', { class: 'muted', text: '어느 날에 넣을까요?' })),
          el('button', { class: 'btn btn-sm', onClick: () => { if (unsubDays) { unsubDays(); unsubDays = null; } drawTrips(root, lastTrips, sharedText); } }, icon('back'), '여행 다시 고르기')),
        el('div', { class: 'share-pick-list' },
          ...days.map((d, i) => el('button', { class: 'card share-trip', onClick: () => go(d.id) }, el('strong', { text: `Day ${i + 1}` }), el('span', { class: 'muted', text: formatShort(d.date) }))),
          el('button', { class: 'card share-trip', onClick: () => go(null) }, el('strong', { text: '보관함' }), el('span', { class: 'muted', text: '날짜 미정' }))));
    });
  }
  return () => { unsub(); if (unsubDays) unsubDays(); };
}
