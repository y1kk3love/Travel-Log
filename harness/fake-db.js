// 확인용 가짜 데이터 계층. js/db.js 와 같은 이름을 모두 내보낸다 (tests/harness.test.js 가 빠진 이름을 알려 준다).
// 사람·여행은 모두 지어낸 것이다.
import { auth } from '/js/firebase.js';
import { nextOrder } from '/js/lib/order.js';

const ME = 'me@example.com';
const MEMBERS = [ME, 'friend1@example.com', 'friend2@example.com', 'friend3@example.com', 'friend4@example.com', 'friend5@example.com', 'friend6@example.com'];
const NICK = { [ME]: '나', 'friend1@example.com': '민지', 'friend2@example.com': 'Alex Kim', 'friend3@example.com': '하늘', 'friend4@example.com': '서연', 'friend5@example.com': '', 'friend6@example.com': '' };
const OWNER = 'cA5VgvDvMKQMVKtEDyggCGVqTvW2';
let seq = 1000; // 시드 아이디(P1·R1…)와 겹치지 않게
const id = (p) => `${p}${++seq}`;

const trips = [
  { id: 'T1', title: '대환장친구들', startDate: '2027-02-13', endDate: '2027-02-16', ownerUid: OWNER, ownerEmail: ME, memberEmails: MEMBERS, rates: { JPY: 9 } },
  { id: 'T2', title: '후쿠오카', startDate: '2026-04-17', endDate: '2026-04-20', ownerUid: OWNER, ownerEmail: ME, memberEmails: MEMBERS.slice(0, 3) },
  { id: 'T3', title: '타이베이', startDate: '2025-10-25', endDate: '2025-10-29', ownerUid: OWNER, ownerEmail: ME, memberEmails: [ME] },
  { id: 'T4', title: '경주', startDate: '2025-09-22', endDate: '2025-09-24', ownerUid: OWNER, ownerEmail: ME, memberEmails: MEMBERS.slice(0, 3) },
  { id: 'T5', title: '후쿠오카 · 벳푸 · 유후인', startDate: '2025-01-11', endDate: '2025-01-14', ownerUid: OWNER, ownerEmail: ME, memberEmails: MEMBERS.slice(0, 3) },
  // 관리자 화면 확인용: 내가 동행이 아닌 여행 (동행이 만든 것)
  { id: 'T9', title: '친구들 제주', startDate: '2027-03-20', endDate: '2027-03-22', ownerUid: 'friend1-uid', ownerEmail: 'friend1@example.com', memberEmails: ['friend1@example.com', 'friend2@example.com'] },
  // Day 탭이 화면보다 긴 여행 (가로 스크롤 확인용)
  { id: 'T6', title: '유럽 열흘', startDate: '2027-05-01', endDate: '2027-05-10', ownerUid: OWNER, ownerEmail: ME, memberEmails: [ME] },
];
const sub = {};
const col = (tripId, name) => ((sub[tripId] ??= {})[name] ??= []);
{
  const days = ['2027-02-13', '2027-02-14', '2027-02-15', '2027-02-16'].map((date, order) => ({ id: `D${order + 1}`, date, order }));
  sub.T1 = {
    days,
    places: [
      { id: 'P1', dayId: 'D1', order: 0, name: '간사이 국제공항 (KIX)', time: '09:50', category: 'move', memo: 'ICN 08:05 → KIX 09:50 진에어 LJ313', lat: 34.4347, lng: 135.244, address: '오사카 공항 (KIX)', stayMinutes: null, photos: [] },
      { id: 'P2', dayId: 'D1', order: 1, name: '오사카성', time: '13:00', category: 'sight', memo: '천수각 입장권 현장 구매\nhttps://www.osakacastle.net', lat: 34.6873, lng: 135.5262, address: '오사카시 주오구', stayMinutes: 90, photos: [], photoCount: 2 },
      { id: 'P3', dayId: 'D1', order: 2, name: '저녁은 도톤보리에서 자유롭게', time: null, category: 'note', memo: '', lat: null, lng: null, address: null, stayMinutes: null, photos: [] },
      { id: 'P4', dayId: 'D1', order: 3, name: '호텔 체크인', time: '18:00', category: 'stay', memo: '', lat: 34.9858, lng: 135.7588, address: '교토역 앞', stayMinutes: null, photos: [] },
      { id: 'P5', dayId: 'D2', order: 0, name: '후시미 이나리 신사', time: '08:30', category: 'sight', memo: '', lat: 34.9671, lng: 135.7727, address: '교토시 후시미구', stayMinutes: 120, photos: [] },
      { id: 'P6', dayId: null, order: 0, name: '닌텐도 뮤지엄', time: null, category: 'sight', memo: '', lat: 34.9097, lng: 135.8045, address: '일본 교토부 우지시 오구라초', stayMinutes: null },
      // 보관함: 분류·지역이 섞여 있다 (걸러 보기·묶기 확인용)
      { id: 'P7', dayId: null, order: 1, name: '기요미즈데라', time: null, category: 'sight', memo: '절벽 위 나무 무대', lat: 34.9949, lng: 135.785, address: '일본 교토부 교토시 히가시야마구 기요미즈 1 Chome−294', stayMinutes: null },
      { id: 'P8', dayId: null, order: 2, name: '니시키 시장', time: null, category: 'food', memo: '', lat: 35.005, lng: 135.7649, address: '일본 교토부 교토시 나카교구', stayMinutes: null },
      { id: 'P9', dayId: null, order: 3, name: '나라 공원', time: null, category: 'sight', memo: '사슴 센베이', lat: 34.685, lng: 135.843, address: '일본 나라현 나라시', stayMinutes: null },
      { id: 'P10', dayId: null, order: 4, name: '스테이크랜드 고베관', time: null, category: 'food', memo: '', lat: 34.6937, lng: 135.1932, address: '일본 효고현 고베시 주오구', stayMinutes: null },
      { id: 'P11', dayId: null, order: 5, name: '이노다 커피 본점', time: null, category: 'cafe', memo: '', lat: 35.0068, lng: 135.7638, address: '일본 교토부 교토시 나카교구 도유초', stayMinutes: null },
      { id: 'P12', dayId: null, order: 6, name: '친구가 알려 준 라멘집', time: null, category: 'food', memo: '', lat: null, lng: null, address: null, stayMinutes: null },
    ],
    reservations: [
      { id: 'R1', type: 'flight', title: '진에어 LJ313', datetime: '2027-02-13T08:05', arrival: '2027-02-13T09:50', fromAirport: 'ICN', toAirport: 'KIX', code: 'C2QPL6', note: '', flightNumber: 'LJ313', linkedPlaceId: 'P1', linkedPlaceIds: ['P1'], files: [] },
      { id: 'R2', type: 'stay', title: '교토 호텔', datetime: '2027-02-13T15:00', checkout: '2027-02-16T11:00', code: 'HX-2231', note: '조식 포함', linkedPlaceId: 'P4', linkedPlaceIds: ['P4'], files: [] },
    ],
    checklist: [
      ...['여권 유효기간 확인', '항공권 예약', '숙소 예약', '환전 · 트래블 카드 충전', '유심 / 이심 구매'].map((text, order) => ({ id: `C${order}`, group: '출발 전', groupOrder: 0, order, text, done: order === 1,
        ...(order === 0 ? { personal: true, doneBy: ['friend1@example.com', 'friend2@example.com'] } : {}) })), // 첫 항목은 "각자" 항목
      ...['보조 배터리', '돼지코 어댑터', '상비약'].map((text, order) => ({ id: `CJ${order}`, group: '짐', groupOrder: 1, order, text, done: true })),
    ],
    expenses: [
      { id: 'E1', title: '이치란 라멘', amount: 3000, currency: 'JPY', category: 'food', date: '2027-02-13', paidBy: ME, sharedWith: MEMBERS.slice(0, 3), note: '' },
      { id: 'E2', title: '공항 리무진', amount: 60000, currency: 'KRW', category: 'transport', date: '2027-02-13', paidBy: 'gone@example.com', sharedWith: [ME, 'gone@example.com'], note: '' },
    ],
  };
  sub.T6 = { days: Array.from({ length: 10 }, (_, order) => ({ id: `E${order + 1}`, date: `2027-05-${String(order + 1).padStart(2, '0')}`, order })), places: [], reservations: [], checklist: [], expenses: [] };
}

const listeners = new Map(); // key -> Set(cb)
const key = (tripId, name) => `${tripId}/${name}`;
function listen(k, cb, get) {
  const set = listeners.get(k) ?? new Set(); listeners.set(k, set);
  const fn = () => cb(get());
  set.add(fn); setTimeout(fn, 30);
  return () => set.delete(fn);
}
function emit(k) { for (const fn of listeners.get(k) ?? []) setTimeout(fn, 20); }
const clone = (x) => JSON.parse(JSON.stringify(x));
const byOrder = (a, b) => a.order - b.order;

export function onLateWriteError() {}
export async function sweepCleanups() {}
export function watchTrips(cb) { return listen('trips', cb, () => clone(trips).filter((t) => t.memberEmails.includes(ME)).sort((a, b) => b.startDate.localeCompare(a.startDate))); }
export function watchAllTrips(cb) { return listen('trips', cb, () => clone(trips).sort((a, b) => b.startDate.localeCompare(a.startDate))); }
export async function canUseApp() { return true; }
export async function ensureProfile() {}
export function watchMyProfile(cb) { return listen('me', cb, () => ({ nickname: NICK[ME], photoURL: null })); }
export async function setNickname(n) { NICK[ME] = n; emit('me'); return 'saved'; }
export async function getProfiles(emails) { return Object.fromEntries(emails.map((e) => [e, NICK[e] ? { nickname: NICK[e] } : null])); }
export async function addMember() { return 'saved'; }
export async function removeMember() { return 'saved'; }
export function watchTrip(tripId, cb) { return listen(key(tripId, 'trip'), cb, () => clone(trips.find((t) => t.id === tripId) ?? null)); }
export async function createTrip() { return 'T1'; }
export async function updateTripSchedule() { return { redate: [], add: [], remove: [] }; }
export async function countPlacesInDays() { return 0; }
export async function setTripCover() { return 'saved'; }
export function coverBytes() { return null; }
export async function deleteTrip(tripId) { const i = trips.findIndex((t) => t.id === tripId); if (i >= 0) trips.splice(i, 1); emit('trips'); emit(key(tripId, 'trip')); return 'saved'; }
export async function tripStats(tripId) { const s = sub[tripId] ?? {}; return { days: (s.days ?? []).length, places: (s.places ?? []).length, checklistTotal: (s.checklist ?? []).length, checklistDone: (s.checklist ?? []).filter((c) => c.done).length, reservations: (s.reservations ?? []).length }; }
export function watchDays(tripId, cb) { return listen(key(tripId, 'days'), cb, () => clone(col(tripId, 'days')).sort(byOrder)); }
export async function addDay() { return 'saved'; }
export async function deleteDay() { return 'saved'; }
export function watchPlaces(tripId, cb) { return listen(key(tripId, 'places'), cb, () => clone(col(tripId, 'places')).sort(byOrder)); }
export async function addPlace(tripId, data) { const list = col(tripId, 'places'); const p = { id: id('P'), photos: [], ...data, order: data.order ?? nextOrder(list.filter((x) => x.dayId === data.dayId)) }; list.push(p); emit(key(tripId, 'places')); return p.id; }
export async function updatePlace(tripId, placeId, data) { const p = col(tripId, 'places').find((x) => x.id === placeId); if (p) Object.assign(p, data); emit(key(tripId, 'places')); return 'saved'; }
export async function deletePlace(tripId, placeId) { const list = col(tripId, 'places'); const i = list.findIndex((x) => x.id === placeId); if (i >= 0) list.splice(i, 1); emit(key(tripId, 'places')); return 'saved'; }
export async function movePlaceToDay(tripId, placeId, dayId) { return updatePlace(tripId, placeId, { dayId }); }
// 사진: 색칠한 가짜 그림 (썸네일은 작게, 원본은 눌렀을 때만 만든다)
async function fakeJpeg(w, h, hue) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, w, h); grad.addColorStop(0, `hsl(${hue} 70% 60%)`); grad.addColorStop(1, `hsl(${hue + 60} 70% 35%)`);
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8));
  return new Uint8Array(await blob.arrayBuffer());
}
const photoStore = { P2: [{ id: 'PH1', hue: 20 }, { id: 'PH2', hue: 200 }] };
const photosOf = (placeId) => (photoStore[placeId] ??= []);
export function watchThumbs(tripId, placeId, cb) {
  return listen(key(tripId, `thumbs/${placeId}`), cb, () => photosOf(placeId).filter((p) => p.thumb).map((p) => ({ id: p.id, bytes: p.thumb, width: 240, height: 180, createdAt: null })));
}
for (const p of photoStore.P2) fakeJpeg(240, 180, p.hue).then((b) => { p.thumb = b; emit(key('T1', 'thumbs/P2')); });
export async function listPhotos() { return []; }
export async function getPhoto(tripId, photoId) {
  const p = Object.values(photoStore).flat().find((x) => x.id === photoId);
  return p ? { id: photoId, bytes: p.full ?? await fakeJpeg(1280, 960, p.hue ?? 120), width: 1280, height: 960, createdAt: null } : null;
}
export async function addPhoto(tripId, { placeId, bytes, thumb }) { const p = { id: id('PH'), full: bytes, thumb: thumb?.bytes ?? bytes }; photosOf(placeId).push(p); emit(key(tripId, `thumbs/${placeId}`)); return p.id; }
export async function addThumb() { return 'saved'; }
export async function deleteThumb() { return 'saved'; }
export async function deletePhoto(tripId, photoId, placeId) { photoStore[placeId] = photosOf(placeId).filter((p) => p.id !== photoId); emit(key(tripId, `thumbs/${placeId}`)); return 'saved'; }
export async function reorderPlaces(tripId, updates) { for (const u of updates) { const p = col(tripId, 'places').find((x) => x.id === u.id); if (p) p.order = u.order; } emit(key(tripId, 'places')); return 'saved'; }
export function watchChecklist(tripId, cb) { return listen(key(tripId, 'checklist'), cb, () => clone(col(tripId, 'checklist'))); }
export async function addChecklistItem(tripId, { group, groupOrder, text, order = null, done = false, personal = false, doneBy = [] }) { const list = col(tripId, 'checklist'); const c = { id: id('C'), group, groupOrder, order: order ?? nextOrder(list.filter((x) => x.group === group)), text, done, ...(personal ? { personal, doneBy } : {}) }; list.push(c); emit(key(tripId, 'checklist')); return c.id; }
export async function setMyCheck(tripId, itemId, { checked, done }) { const c = col(tripId, 'checklist').find((x) => x.id === itemId); if (c) { c.doneBy = (c.doneBy ?? []).filter((m) => m !== ME); if (checked) c.doneBy.push(ME); c.done = done; } emit(key(tripId, 'checklist')); return 'saved'; }
export async function updateChecklistItem(tripId, itemId, data) { const c = col(tripId, 'checklist').find((x) => x.id === itemId); if (c) Object.assign(c, data); emit(key(tripId, 'checklist')); return 'saved'; }
export async function deleteChecklistItem(tripId, itemId) { const list = col(tripId, 'checklist'); const i = list.findIndex((x) => x.id === itemId); if (i >= 0) list.splice(i, 1); emit(key(tripId, 'checklist')); return 'saved'; }
export async function renameChecklistGroup() { return 'saved'; }
export async function deleteChecklistGroup() { return 'saved'; }
export function watchReservations(tripId, cb) { return listen(key(tripId, 'reservations'), cb, () => clone(col(tripId, 'reservations'))); }
export async function saveReservation(tripId, rid, data, newPlaces = []) { const ids = []; for (const p of newPlaces) ids.push(await addPlace(tripId, p)); const list = col(tripId, 'reservations'); const full = ids.length ? { ...data, linkedPlaceIds: ids, linkedPlaceId: ids[0] } : data; const r = rid ? list.find((x) => x.id === rid) : null; if (r) Object.assign(r, full); else list.push({ id: id('R'), ...full }); emit(key(tripId, 'reservations')); return { id: r?.id, placeIds: ids }; }
export async function deleteReservation() { return 'saved'; }
export function watchExpenses(tripId, cb) { return listen(key(tripId, 'expenses'), cb, () => clone(col(tripId, 'expenses'))); }
export async function addExpense(tripId, data) { const e = { id: id('E'), ...data }; col(tripId, 'expenses').push(e); emit(key(tripId, 'expenses')); return e.id; }
export async function updateExpense(tripId, eid, data) { const e = col(tripId, 'expenses').find((x) => x.id === eid); if (e) Object.assign(e, data); emit(key(tripId, 'expenses')); return 'saved'; }
export async function deleteExpense(tripId, eid) { const list = col(tripId, 'expenses'); const i = list.findIndex((x) => x.id === eid); if (i >= 0) list.splice(i, 1); emit(key(tripId, 'expenses')); return 'saved'; }
export async function setTripRates() { return 'saved'; }
export const FILE_MAX_BYTES = 950 * 1024;
export async function addReservationFile() { return id('F'); }
export async function getReservationFile() { return null; }
export async function deleteReservationFile() { return 'saved'; }
export async function hasUnsyncedWrites() { return !!globalThis.__fakeUnsynced; }
export async function estimateStorage() { return { bytes: 12 * 1024 * 1024, docs: 400, trips: trips.length }; }
export async function myAllowedEntry() { return { canCreate: true }; }
export function watchAllowedUsers(cb) { return listen('allowed', cb, () => MEMBERS.slice(1).map((email, i) => ({ email, canCreate: i < 2 }))); }
export async function setAllowedUser() { return 'saved'; }
export async function removeAllowedUser() { return 'saved'; }
export const __auth = auth;
