import { el, clear, toast, confirmDialog, openModal, icon, photoPath } from '../ui.js';
import { topbar } from './topbar.js';
import { watchTrips, createTrip, deleteTrip, tripStats, coverBytes, myAllowedEntry } from '../db.js';
import { bytesToObjectUrl } from '../photo.js';
import { tripStatus, formatStatus, formatRange, toDateStr, dayList } from '../lib/dates.js';
import { isTripOwner, canCreateTrips } from '../lib/members.js';
import { auth } from '../firebase.js';
import { isOwner } from '../auth.js';
import { navigate } from '../router.js';
import { appDownloadCard } from './app-download.js';
import { stampLabel } from '../lib/stamp.js';

export function render(container) {
  const main = el('main', { class: 'container trips-page' });
  container.append(topbar(), main);
  // 새 여행 버튼: 사이트 주인은 바로, 초대 계정은 "여행 만들기"가 켜져 있으면 (초대 목록 항목을 한 번 읽는다)
  let trips = null;
  const perm = { canCreate: isOwner(auth.currentUser) };
  if (!perm.canCreate) myAllowedEntry().then((allowed) => { perm.canCreate = canCreateTrips({ isSiteOwner: false, allowed }); if (trips) draw(main, trips, perm); });
  const unsub = watchTrips(
    (t) => { trips = t; draw(main, trips, perm); },
    (err) => {
      console.error(err);
      if (err.code === 'permission-denied') toast('접근 권한이 없어요. firestore.rules의 UID를 확인해 주세요', { kind: 'error', ms: 6000 });
      else toast('여행 목록을 불러오지 못했어요', { kind: 'error' });
    },
  );
  return () => unsub();
}

function draw(main, trips, perm) {
  clear(main);
  const today = toDateStr(new Date());
  const withStatus = trips.map((t) => ({ ...t, status: tripStatus(t.startDate, t.endDate, today) }));
  const upcoming = withStatus.filter((t) => t.status.kind !== 'after').sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = withStatus.filter((t) => t.status.kind === 'after');
  const siteOwner = perm.canCreate; // 새 여행: 사이트 주인 또는 "여행 만들기"가 켜진 초대 계정

  main.append(
    el('div', { class: 'page-head' },
      el('div', {},
        el('h1', { text: '내 여행' }),
        el('p', { class: 'muted', text: `다가오는 여행 ${upcoming.length}개 · 지난 여행 ${past.length}개` })),
      siteOwner ? el('button', { class: 'btn btn-primary', onClick: openNewTripDialog }, icon('plus'), '새 여행') : null),
    section('다가오는 여행', upcoming.map(featureCard), siteOwner ? '아직 계획한 여행이 없어요. 새 여행을 만들어 보세요.' : '초대받은 여행이 여기에 보여요.'),
    section('지난 여행', past.map(smallCard), '지난 여행이 없어요.'),
  );
  const download = appDownloadCard(); // 웹에서만: 최신 APK 링크 (앱 안에서는 null → append 하면 글자 "null" 이 찍히므로 걸러 낸다)
  if (download) main.append(download);
}

function section(title, cards, emptyText) {
  return el('section', { class: 'trips-section' },
    el('h2', { class: 'section-title', text: title }),
    cards.length ? el('div', { class: title === '지난 여행' ? 'trips-grid' : 'trips-list' }, cards)
      : el('p', { class: 'muted', text: emptyText }));
}

function cover(trip, className) {
  const bytes = coverBytes(trip);
  if (bytes) {
    const url = bytesToObjectUrl(bytes);
    return el('img', { class: className, src: url, alt: '', onLoad: () => URL.revokeObjectURL(url) });
  }
  if (trip.coverPhoto) return el('img', { class: className, src: photoPath(trip.id, trip.coverPhoto), alt: '' });
  return el('div', { class: `${className} cover-empty`, text: isOwner(auth.currentUser) ? '대표 사진 없음 · 여행 화면에서 추가' : '대표 사진 없음' });
}

function membersTag(trip) {
  const n = (trip.memberEmails ?? []).length;
  return n > 1 ? el('span', { class: 'tag', text: `동행 ${n}명` }) : null;
}

function deleteButton(trip) {
  if (!isTripOwner(trip, auth.currentUser)) return null; // 동행은 여행을 지울 수 없다
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
  // 사진 위에 제목·날짜를 얹고, 아래 흰 면에 일정·체크·예약 숫자
  return el('a', { href: `#/trip/${trip.id}`, class: 'card trip-feature' },
    el('div', { class: 'trip-feature-cover-wrap' },
      cover(trip, 'trip-feature-cover'),
      el('div', { class: 'trip-feature-overlay' },
        el('div', { class: 'trip-meta' },
          el('span', { class: 'badge', text: formatStatus(trip.status) }),
          membersTag(trip)),
        el('h2', { class: 'trip-title', text: trip.title }),
        el('span', { class: 'muted', text: formatRange(trip.startDate, trip.endDate) }))),
    el('div', { class: 'trip-feature-body' }, stats, bar),
    deleteButton(trip));
}

function stat(label, value) {
  return el('div', { class: 'stat' }, el('span', { class: 'muted', text: label }), el('strong', { text: value }));
}

// 지난 여행: 사진 모서리에 여권 도장 (도시 · 연월)
function passportStamp(trip) {
  const { city, date } = stampLabel(trip);
  return el('div', { class: 'stamp', 'aria-hidden': 'true' },
    el('span', { class: 'stamp-ring' }), el('span', { class: 'stamp-ink' }),
    el('span', { class: 'stamp-city', text: city }), el('span', { class: 'stamp-date', text: date }));
}

function smallCard(trip) {
  return el('a', { href: `#/trip/${trip.id}`, class: 'card trip-small' },
    el('div', { class: 'trip-small-cover-wrap' }, cover(trip, 'trip-small-cover'), passportStamp(trip)),
    el('div', { class: 'trip-small-body' },
      el('h3', { text: trip.title }),
      el('p', { class: 'muted' }, formatRange(trip.startDate, trip.endDate), ' ', membersTag(trip))),
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
  dialog.append(form);
  openModal(dialog);
  title.focus();
}
