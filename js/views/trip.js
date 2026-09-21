import { el, clear, toast, icon } from '../ui.js';
import { topbar } from './topbar.js';
import { watchTrip } from '../db.js';
import { formatRange, tripStatus, formatStatus, toDateStr } from '../lib/dates.js';
import { navigate } from '../router.js';
import * as planner from './planner.js';
import * as checklist from './checklist.js';
import * as reservations from './reservations.js';
import * as expenses from './expenses.js';
import { openMembersDialog } from './members-dialog.js';
import { openCoverDialog } from './cover-dialog.js';
import { openTripEditDialog } from './trip-edit-dialog.js';
import { isOwner } from '../auth.js';
import { auth } from '../firebase.js';

const TAB_VIEWS = { planner, checklist, reservations, expenses };
const TAB_LABELS = { planner: '일정', checklist: '체크리스트', reservations: '예약', expenses: '지출' };

export function render(container, route) {
  const { tripId, tab, placeId = null, reservationId = null } = route;
  const header = el('div', { class: 'trip-header' });
  const content = el('div', { class: 'trip-content' });
  container.append(topbar({ backHref: '#/' }), header, content);
  let mounted = false;
  let cleanupTab = null;

  const unsub = watchTrip(tripId, (trip) => {
    if (!trip) { toast('여행을 찾을 수 없어요', { kind: 'error' }); navigate('/'); return; }
    drawHeader(header, trip, tab);
    if (!mounted) {
      mounted = true;
      const view = TAB_VIEWS[tab];
      if (view) cleanupTab = view.mount(content, { tripId, trip, placeId, reservationId }) || null;
      else content.append(el('p', { class: 'muted container', text: `${TAB_LABELS[tab]} 탭은 다음 단계에서 붙어요` }));
    }
  }, (err) => {
    console.error(err);
    // 동행이 아니거나 이미 삭제된 여행: 권한 오류로 오므로 "없음"과 같게 다룬다
    if (err.code === 'permission-denied') { toast('볼 수 없는 여행이에요', { kind: 'error' }); navigate('/'); return; }
    toast('여행을 불러오지 못했어요', { kind: 'error' });
  });

  return () => { unsub(); if (cleanupTab) cleanupTab(); };
}

function drawHeader(header, trip, tab) {
  clear(header);
  header.append(
    el('div', { class: 'trip-header-left' },
      el('h1', { text: trip.title }),
      el('span', { class: 'muted', text: formatRange(trip.startDate, trip.endDate) }),
      el('span', { class: 'badge', text: formatStatus(tripStatus(trip.startDate, trip.endDate, toDateStr(new Date()))) }),
      el('button', { class: 'btn btn-sm btn-ghost trip-members', onClick: () => openMembersDialog(trip) },
        icon('pin'), `동행 ${(trip.memberEmails ?? []).length}명`),
      // 대표 사진·여행 정보 수정은 사이트 주인만
      isOwner(auth.currentUser) ? el('button', { class: 'btn btn-sm btn-ghost trip-members', onClick: () => openCoverDialog(trip) },
        icon('edit'), '대표 사진') : null,
      isOwner(auth.currentUser) ? el('button', { class: 'btn btn-sm btn-ghost trip-members', onClick: () => openTripEditDialog(trip) },
        icon('calendar'), '여행 정보 수정') : null),
    el('nav', { class: 'tabs' },
      ...Object.entries(TAB_LABELS).map(([key, label]) => el('a', {
        href: key === 'planner' ? `#/trip/${trip.id}` : `#/trip/${trip.id}/${key}`,
        class: `tab${key === tab ? ' active' : ''}`, text: label,
      }))));
}
