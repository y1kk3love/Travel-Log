import { el, clear, toast, icon, confirmDialog } from '../ui.js';
import { topbar } from './topbar.js';
import { watchTrip, deleteTrip, getProfiles } from '../db.js';
import { formatRange, tripStatus, formatStatus, toDateStr } from '../lib/dates.js';
import { navigate } from '../router.js';
import * as planner from './planner.js';
import * as checklist from './checklist.js';
import * as reservations from './reservations.js';
import * as expenses from './expenses.js';
import { openMembersDialog } from './members-dialog.js';
import { openCoverDialog } from './cover-dialog.js';
import { openTripEditDialog } from './trip-edit-dialog.js';
import { isSiteOwner } from '../auth.js';
import { auth } from '../firebase.js';
import { canEditTripInfo, canManageTrip, isAdminViewing } from '../lib/members.js';
import { openActionMenu } from './action-menu.js';
import { avatar } from './avatar.js';
import { restyle } from '../motion.js';

const TAB_VIEWS = { planner, checklist, reservations, expenses };
const TAB_LABELS = { planner: '일정', checklist: '체크리스트', reservations: '예약', expenses: '지출' };

export function render(container, route) {
  const { tripId, tab, placeId = null, reservationId = null } = route;
  const header = el('div', { class: 'trip-header' });
  const tabsBar = el('div', { class: 'trip-tabs-bar' }); // 폰에서 스크롤해도 상단 바 아래에 붙어 있다
  const content = el('div', { class: 'trip-content' });
  const bar = topbar({ backHref: '#/' });
  container.append(bar, header, tabsBar, content);
  let mounted = false;
  let cleanupTab = null;
  const condense = condensingTitle(bar);

  const unsub = watchTrip(tripId, (trip) => {
    if (!trip) { toast('여행을 찾을 수 없어요', { kind: 'error' }); navigate('/'); return; }
    drawHeader(header, tabsBar, trip, tab);
    condense.update(trip.title, header.querySelector('h1'));
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

  return () => { unsub(); condense.stop(); if (cleanupTab) cleanupTab(); };
}

// iOS 큰 제목: 여행 제목(h1)이 스크롤로 상단 바 밑에 가려지면, 상단 바의 "여행 로그 · 내 여행" 자리에 작은 제목이 나타난다
function condensingTitle(bar) {
  const left = bar.querySelector('.topbar-left');
  const name = el('span');
  left.classList.add('has-title');
  left.append(el('a', { class: 'topbar-title', href: '#/', 'aria-hidden': 'true', tabindex: '-1' }, el('span', { class: 'topbar-back', text: '‹' }), name));
  let observer = null;
  return {
    update(title, h1) {
      name.textContent = title;
      observer?.disconnect();
      if (!h1 || typeof IntersectionObserver !== 'function') return;
      const top = bar.getBoundingClientRect().height || 56;
      observer = new IntersectionObserver(([e]) => {
        bar.classList.toggle('condensed', !e.isIntersecting && e.boundingClientRect.top < top);
      }, { rootMargin: `-${top}px 0px 0px 0px` });
      observer.observe(h1);
    },
    stop() { observer?.disconnect(); },
  };
}

// 탭의 흰 알약이 이전 탭 자리에서 새 탭으로 미끄러진다. 같은 여행 안에서 탭을 옮길 때만 (다른 여행에서 들어오면 제자리)
let lastTab = { tripId: null, index: -1 };
function slideTabs(nav, tripId, index) {
  const from = lastTab.tripId === tripId && lastTab.index >= 0 ? lastTab.index : index;
  lastTab = { tripId, index };
  nav.classList.add('has-indicator');
  nav.style.setProperty('--tab-n', String(Object.keys(TAB_LABELS).length));
  nav.style.setProperty('--tab-i', String(from));
  if (from !== index) { restyle(nav, '::before'); restyle(nav.firstElementChild); nav.style.setProperty('--tab-i', String(index)); }
}

// 동행 얼굴: 닉네임·사진은 한 번 읽은 것을 여행 화면이 다시 그려질 때도 쓴다
const profileCache = new Map();
function avatarStack(emails) {
  const shown = emails.slice(0, 3);
  const wrap = el('span', { class: 'avatar-stack', 'aria-hidden': 'true' });
  const draw = () => wrap.replaceChildren(...shown.map((m) => avatar(profileCache.get(m) ?? null, m, 24)));
  draw();
  const missing = shown.filter((m) => !profileCache.has(m));
  if (missing.length) {
    getProfiles(missing).then((p) => {
      for (const [k, v] of Object.entries(p)) profileCache.set(k, v);
      if (wrap.isConnected) draw();
    }).catch((err) => console.warn('profiles', err));
  }
  return wrap;
}

async function confirmDeleteTrip(trip) {
  if (!(await confirmDialog(`'${trip.title}' 여행과 모든 일정을 삭제할까요?`))) return;
  navigate('/'); // 먼저 홈으로 (지우는 사이 이 화면이 "여행을 찾을 수 없어요"를 띄우지 않게)
  try { await deleteTrip(trip.id); toast('여행을 삭제했어요'); }
  catch (err) {
    console.error(err);
    toast(err?.code === 'unavailable' ? '인터넷에 연결된 뒤 다시 삭제해 주세요' : '삭제하지 못했어요', { kind: 'error' });
  }
}

// 제목 줄(오른쪽 끝 "더 보기"), 날짜·D-day·동행 얼굴 줄, 그 아래 탭. 관리 기능은 "더 보기" 메뉴로 모아 내용이 먼저 보이게.
function drawHeader(header, tabsBar, trip, tab) {
  const user = auth.currentUser;
  const canEdit = canEditTripInfo(trip, user, isSiteOwner(user)); // 대표 사진·여행 정보: 만든 사람과 사이트 주인
  const members = trip.memberEmails ?? [];
  const more = el('button', {
    class: 'btn btn-icon trip-more', 'aria-label': '여행 메뉴', 'aria-haspopup': 'dialog',
    onClick: () => openActionMenu({
      title: trip.title, anchor: more,
      items: [
        { icon: 'users', label: `동행 ${members.length}명`, onClick: () => openMembersDialog(trip) },
        canEdit && { icon: 'image', label: '대표 사진', onClick: () => openCoverDialog(trip) },
        canEdit && { icon: 'calendar', label: '여행 정보 수정', onClick: () => openTripEditDialog(trip) },
        canManageTrip(trip, user, isSiteOwner(user)) && { icon: 'trash', label: '여행 삭제', danger: true, onClick: () => confirmDeleteTrip(trip) },
      ],
    }),
  }, icon('more'));
  clear(header);
  // 관리자가 동행이 아닌 여행을 볼 때: 나에게만 보이는 표시 (동행 목록에는 들어가지 않는다)
  if (isAdminViewing(trip, user, isSiteOwner(user))) {
    header.append(el('a', { class: 'admin-banner', href: '#/admin' }, icon('shield'), `관리자로 보는 중 · ${trip.ownerEmail ?? ''} 님의 여행`));
  }
  header.append(
    el('div', { class: 'trip-title-row' },
      el('h1', { text: trip.title }),
      el('button', { type: 'button', class: 'trip-people', 'aria-label': `동행 ${members.length}명 보기`, onClick: () => openMembersDialog(trip) },
        avatarStack(members), el('span', { text: `${members.length}명` })),
      more),
    el('div', { class: 'trip-sub' },
      el('span', { class: 'muted', text: formatRange(trip.startDate, trip.endDate) }),
      el('span', { class: 'badge', text: formatStatus(tripStatus(trip.startDate, trip.endDate, toDateStr(new Date()))) })));
  clear(tabsBar);
  const nav = el('nav', { class: 'tabs', 'aria-label': '여행 탭' },
    ...Object.entries(TAB_LABELS).map(([key, label]) => el('a', {
      href: key === 'planner' ? `#/trip/${trip.id}` : `#/trip/${trip.id}/${key}`,
      class: `tab${key === tab ? ' active' : ''}`, text: label, 'aria-current': key === tab ? 'page' : null,
    })));
  tabsBar.append(nav);
  slideTabs(nav, trip.id, Object.keys(TAB_LABELS).indexOf(tab));
}
