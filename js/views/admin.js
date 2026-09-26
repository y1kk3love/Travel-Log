// 관리자 화면 (사이트 주인 전용): 동행 여부와 상관없이 모든 여행. 누르면 그 여행을 평소처럼 연다.
// 관리자는 동행 목록에 들어가지 않으므로 다른 사람 화면에는 아무것도 바뀌지 않는다. 내 계정 메뉴에서 들어온다.
import { el, clear, toast } from '../ui.js';
import { topbar } from './topbar.js';
import { watchAllTrips } from '../db.js';
import { auth } from '../firebase.js';
import { isSiteOwner } from '../auth.js';
import { isAdminViewing } from '../lib/members.js';
import { tripStatus, formatStatus, formatRange, toDateStr } from '../lib/dates.js';
import { navigate } from '../router.js';

export function render(container) {
  const user = auth.currentUser;
  if (!isSiteOwner(user)) { navigate('/'); return () => {}; }
  const main = el('main', { class: 'container share-page' });
  container.append(topbar({ backHref: '#/' }), main);
  main.append(el('p', { class: 'muted', text: '불러오는 중…' }));

  const unsub = watchAllTrips((trips) => draw(main, trips, user), (err) => {
    console.error(err);
    toast('여행 목록을 불러오지 못했어요', { kind: 'error' });
  });
  return () => unsub();
}

function draw(root, trips, user) {
  clear(root);
  const today = toDateStr(new Date());
  // 진행 중·다가오는 여행이 위(가까운 순), 지난 여행은 아래(최근 순)
  const sorted = trips.map((t) => ({ ...t, status: tripStatus(t.startDate, t.endDate, today) }))
    .sort((a, b) => {
      const pa = a.status.kind === 'after', pb = b.status.kind === 'after';
      if (pa !== pb) return pa - pb;
      return pa ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate);
    });
  const others = sorted.filter((t) => isAdminViewing(t, user, true)).length;
  root.append(
    el('div', { class: 'page-head' }, el('div', {},
      el('h2', { class: 'checklist-title', text: '관리자 · 모든 여행' }),
      el('p', { class: 'muted', text: `여행 ${sorted.length}개 · 내가 동행이 아닌 여행 ${others}개. 들어가도 동행 목록에는 추가되지 않아요.` }))),
    sorted.length
      ? el('div', { class: 'share-pick-list' }, ...sorted.map((t) => el('button', { class: 'card share-trip', onClick: () => navigate(`/trip/${t.id}`) },
        el('strong', { text: t.title }),
        el('span', { class: 'muted', text: `${formatRange(t.startDate, t.endDate)} · ${formatStatus(t.status)}` }),
        el('span', { class: 'muted', text: `주인 ${t.ownerEmail ?? '알 수 없음'} · 동행 ${(t.memberEmails ?? []).length}명${isAdminViewing(t, user, true) ? ' · 내가 동행 아님' : ''}` }))))
      : el('p', { class: 'muted', text: '아직 여행이 없어요.' }));
}
