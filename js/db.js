import {
  collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, getDocFromCache, getDocsFromCache, query, where, orderBy, limit,
  onSnapshot, writeBatch, serverTimestamp, getCountFromServer, increment, arrayUnion, arrayRemove, Bytes,
} from './firebase-sdk.js';
import { db, auth } from './firebase.js';
import { dayList, addDays, toDateStr } from './lib/dates.js';
import { nextOrder } from './lib/order.js';
import { sortTripsByStart } from './lib/members.js';
import { planScheduleChange } from './lib/schedule.js';
import { settleSoon, preferWithin } from './lib/settle.js';
import { withoutPlaces, linkedIds, linkFields } from './lib/reservation-links.js';
import { chunk } from './lib/pool.js';

// 현재 로그인 사용자 (여행 소유자·동행 판정에 쓴다)
function me() {
  const u = auth.currentUser;
  if (!u) throw new Error('not-signed-in');
  return { uid: u.uid, email: (u.email ?? '').toLowerCase() };
}

const DEFAULT_CHECKLIST = [
  { group: '출발 전', items: ['여권 유효기간 확인', '항공권 예약', '숙소 예약', '환전 · 트래블 카드 충전', '유심 / 이심 구매'] },
  { group: '짐', items: ['보조 배터리', '돼지코 어댑터', '상비약'] },
];

const tripsCol = () => collection(db, 'trips');
const tripDoc = (tripId) => doc(db, 'trips', tripId);
const sub = (tripId, name) => collection(db, 'trips', tripId, name);
const docsOf = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const byOrder = (a, b) => a.order - b.order;
const logError = (err) => console.error('[db]', err);

// ---------- 오프라인에서도 멈추지 않는 읽기·쓰기 ----------
// Firestore 는 쓰기를 먼저 기기 캐시에 반영하지만, 쓰기 약속은 서버가 확인해야 끝난다. 오프라인이면 끝나지 않아
// 저장 창이 닫히지 않고 다시 누르면 두 번 저장됐다. 서버 확인은 잠깐만 기다리고 넘어가며(연결되면 올라간다),
// 넘어간 뒤의 실패는 onLateWriteError 로 등록한 곳(app.js 의 알림)에 알린다.
const WRITE_WAIT_MS = 1000;
const READ_WAIT_MS = 2500;
let lateWriteError = logError;
export function onLateWriteError(handler) { lateWriteError = handler; }
const save = (write) => settleSoon(write, { ms: WRITE_WAIT_MS, onLateError: (err) => lateWriteError(err) });
// 쓰기 전에 필요한 읽기(순서 계산·함께 지울 문서 찾기): 서버가 늦거나 안 되면 기기 캐시로
const readDocs = (q) => preferWithin(getDocs(q), () => getDocsFromCache(q), READ_WAIT_MS);
const readDoc = (ref) => preferWithin(getDoc(ref), () => getDocFromCache(ref), READ_WAIT_MS);

// ---------- trips ----------
// 내가 동행으로 들어 있는 여행만. (array-contains + orderBy는 복합 색인이 필요해서 정렬은 클라이언트에서)
export function watchTrips(cb, onError = logError) {
  const q = query(tripsCol(), where('memberEmails', 'array-contains', me().email));
  return onSnapshot(q, (s) => cb(sortTripsByStart(docsOf(s))), onError);
}

// 로그인한 계정이 이 사이트를 쓸 수 있는지: 사이트 주인이거나, 초대 목록에 있거나, 어떤 여행의 동행이거나.
export async function canUseApp(isSiteOwner) {
  if (isSiteOwner) return true;
  const { email } = me();
  try {
    const allowed = await readDoc(doc(db, 'allowedUsers', email)); // 오프라인으로 앱을 켜도 캐시로 바로 통과
    if (allowed.exists()) return true;
  } catch (err) { logError(err); }
  try {
    const snap = await readDocs(query(tripsCol(), where('memberEmails', 'array-contains', email), limit(1)));
    return !snap.empty;
  } catch (err) { logError(err); return false; }
}

// ---------- profiles (닉네임) ----------
// profiles/{email}: { uid, nickname, updatedAt }. 처음 로그인하면 Google 이름을 기본 닉네임으로 넣는다.
export async function ensureProfile(user) {
  const email = (user.email ?? '').toLowerCase();
  if (!email) return;
  const ref = doc(db, 'profiles', email);
  const photoURL = user.photoURL ?? null;
  try {
    const snap = await readDoc(ref);
    if (!snap.exists()) {
      await save(setDoc(ref, { uid: user.uid, nickname: (user.displayName ?? '').trim().slice(0, 20), photoURL, updatedAt: serverTimestamp() }));
    } else if ((snap.data().photoURL ?? null) !== photoURL) {
      // Google 프로필 사진이 바뀌면 따라간다 (닉네임은 건드리지 않는다)
      await save(setDoc(ref, { uid: user.uid, photoURL, updatedAt: serverTimestamp() }, { merge: true }));
    }
  } catch (err) { logError(err); }
}

export function watchMyProfile(cb, onError = logError) {
  const { email } = me();
  return onSnapshot(doc(db, 'profiles', email), (s) => cb(s.exists() ? s.data() : null), onError);
}

export function setNickname(nickname) {
  const { uid, email } = me();
  return save(setDoc(doc(db, 'profiles', email), { uid, nickname, updatedAt: serverTimestamp() }, { merge: true }));
}

// 여러 이메일의 프로필을 한 번에 (없는 사람은 null)
export async function getProfiles(emails) {
  const entries = await Promise.all(emails.map(async (email) => {
    try { const s = await readDoc(doc(db, 'profiles', email)); return [email, s.exists() ? s.data() : null]; }
    catch (err) { logError(err); return [email, null]; }
  }));
  return Object.fromEntries(entries);
}

// ---------- members (동행) ----------
export async function addMember(tripId, email) {
  const batch = writeBatch(db);
  batch.update(tripDoc(tripId), { memberEmails: arrayUnion(email) });
  batch.set(doc(db, 'allowedUsers', email), { invitedAt: serverTimestamp(), invitedBy: me().uid }, { merge: true });
  await save(batch.commit());
}

export function removeMember(tripId, email) {
  return save(updateDoc(tripDoc(tripId), { memberEmails: arrayRemove(email) }));
}

export function watchTrip(tripId, cb, onError = logError) {
  return onSnapshot(tripDoc(tripId), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null), onError);
}

export async function createTrip({ title, startDate, endDate }) {
  const days = dayList(startDate, endDate);
  if (!title.trim() || days.length === 0) throw new Error('invalid-trip');
  const ref = doc(tripsCol());
  const batch = writeBatch(db);
  const { uid, email } = me();
  batch.set(ref, {
    title: title.trim(), startDate, endDate, coverPhoto: null, createdAt: serverTimestamp(),
    ownerUid: uid, ownerEmail: email, memberEmails: [email],
  });
  for (const day of days) batch.set(doc(sub(ref.id, 'days')), day);
  DEFAULT_CHECKLIST.forEach((g, groupOrder) => g.items.forEach((text, order) => {
    batch.set(doc(sub(ref.id, 'checklist')), { group: g.group, groupOrder, order, text, done: false });
  }));
  await save(batch.commit());
  return ref.id;
}

// 여행 제목·기간 수정. 기존 Day는 순서대로 새 날짜를 받고, 늘어난 날은 추가, 줄어든 뒤쪽 Day는 장소·사진과 함께 지운다.
export async function updateTripSchedule(tripId, { title, startDate, endDate }) {
  const days = docsOf(await readDocs(query(sub(tripId, 'days'), orderBy('order'))));
  const plan = planScheduleChange(days, startDate, endDate);
  if (!plan) throw new Error('invalid-range');
  const batch = writeBatch(db);
  batch.update(tripDoc(tripId), { title: title.trim(), startDate, endDate });
  plan.redate.forEach((d) => batch.update(doc(sub(tripId, 'days'), d.id), { date: d.date, order: d.order }));
  plan.add.forEach((d) => batch.set(doc(sub(tripId, 'days')), d));
  for (const dayId of plan.remove) {
    const placesSnap = await readDocs(query(sub(tripId, 'places'), where('dayId', '==', dayId)));
    const photoSnaps = await Promise.all(placesSnap.docs.map((p) => readDocs(query(sub(tripId, 'photos'), where('placeId', '==', p.id)))));
    photoSnaps.forEach((s) => s.docs.forEach((ph) => batch.delete(ph.ref)));
    placesSnap.docs.forEach((p) => batch.delete(p.ref));
    if (placesSnap.size) await unlinkReservations(batch, tripId, placesSnap.docs.map((d) => d.id));
    batch.delete(doc(sub(tripId, 'days'), dayId));
  }
  await save(batch.commit());
  return plan;
}

// 기간을 줄일 때 사라질 Day의 장소 수 (확인 대화상자용)
export async function countPlacesInDays(tripId, dayIds) {
  let n = 0;
  for (const dayId of dayIds) n += (await readDocs(query(sub(tripId, 'places'), where('dayId', '==', dayId)))).size;
  return n;
}

// 대표 사진: 작게 줄인 JPEG 바이트를 여행 문서에 직접 둔다 (홈 목록에서 추가 읽기 없이 보이도록). null이면 제거.
export function setTripCover(tripId, bytes) {
  return save(updateDoc(tripDoc(tripId), { cover: bytes ? Bytes.fromUint8Array(bytes) : null }));
}

export function coverBytes(trip) {
  return trip?.cover instanceof Bytes ? trip.cover.toUint8Array() : null;
}

// 여행 안 문서를 모두 지우고 여행을 지운다. 배치는 500개까지라 450개씩 나누고, 여행 문서는 맨 마지막에
// (규칙이 하위 문서를 지울 때 여행 문서로 멤버인지 보므로 먼저 지우면 나머지가 막힌다).
export async function deleteTrip(tripId) {
  const snaps = await Promise.all(['days', 'places', 'photos', 'checklist', 'reservations', 'expenses', 'files'].map((name) => readDocs(sub(tripId, name))));
  const refs = snaps.flatMap((s) => s.docs.map((d) => d.ref));
  const groups = chunk(refs, 450);
  for (const [i, group] of groups.entries()) {
    const batch = writeBatch(db);
    group.forEach((ref) => batch.delete(ref));
    if (i === groups.length - 1) batch.delete(tripDoc(tripId));
    await save(batch.commit());
  }
  if (!groups.length) await save(deleteDoc(tripDoc(tripId)));
}

// 오프라인이면 서버 카운트가 실패하므로 캐시된 문서를 세어 대신 채운다
async function tripStatsFromCache(tripId) {
  const [days, places, checklist, reservations] = await Promise.all(
    ['days', 'places', 'checklist', 'reservations'].map((name) => getDocs(sub(tripId, name))));
  return {
    days: days.size, places: places.size,
    checklistTotal: checklist.size, checklistDone: checklist.docs.filter((d) => d.data().done).length,
    reservations: reservations.size,
  };
}

export async function tripStats(tripId) {
  try {
    const [days, places, total, done, reservations] = await Promise.all([
      getCountFromServer(sub(tripId, 'days')),
      getCountFromServer(sub(tripId, 'places')),
      getCountFromServer(sub(tripId, 'checklist')),
      getCountFromServer(query(sub(tripId, 'checklist'), where('done', '==', true))),
      getCountFromServer(sub(tripId, 'reservations')),
    ]);
    return {
      days: days.data().count, places: places.data().count,
      checklistTotal: total.data().count, checklistDone: done.data().count,
      reservations: reservations.data().count,
    };
  } catch (err) {
    logError(err);
    try { return await tripStatsFromCache(tripId); } catch (err2) { logError(err2); return null; }
  }
}

// 장소가 지워질 때 그 장소를 예약 연결에서 뺀다 (배치에 추가). 예약은 여행마다 몇십 개라 전부 읽어 거른다.
// 예전에는 한 개 연결(linkedPlaceId)만 풀어서 숙소 여러 박 연결(linkedPlaceIds)에 지운 장소가 남았다.
async function unlinkReservations(batch, tripId, placeIds) {
  const gone = new Set(placeIds);
  const snap = await readDocs(sub(tripId, 'reservations'));
  snap.docs.forEach((d) => {
    const r = d.data();
    if (linkedIds(r).some((id) => gone.has(id))) batch.update(d.ref, linkFields(withoutPlaces(r, placeIds)));
  });
}

// ---------- days ----------
export function watchDays(tripId, cb, onError = logError) {
  return onSnapshot(query(sub(tripId, 'days'), orderBy('order')), (s) => cb(docsOf(s)), onError);
}

export async function addDay(tripId) {
  const days = docsOf(await readDocs(query(sub(tripId, 'days'), orderBy('order'))));
  const last = days[days.length - 1];
  const date = last ? addDays(last.date, 1) : toDateStr(new Date());
  const batch = writeBatch(db);
  batch.set(doc(sub(tripId, 'days')), { date, order: days.length });
  batch.update(tripDoc(tripId), { endDate: date });
  await save(batch.commit());
}

// Day를 지우면 그 날 장소도 지우고, 남은 Day는 첫 날부터 이어지는 날짜로 다시 매긴다.
export async function deleteDay(tripId, dayId) {
  const [daysSnap, placesSnap] = await Promise.all([
    readDocs(query(sub(tripId, 'days'), orderBy('order'))),
    readDocs(query(sub(tripId, 'places'), where('dayId', '==', dayId))),
  ]);
  const remaining = docsOf(daysSnap).filter((d) => d.id !== dayId);
  if (remaining.length === 0) throw new Error('last-day');
  const batch = writeBatch(db);
  const photoSnaps = await Promise.all(placesSnap.docs.map((d) => readDocs(query(sub(tripId, 'photos'), where('placeId', '==', d.id))))); // 장소마다 차례로 기다리지 않게
  photoSnaps.forEach((s) => s.docs.forEach((p) => batch.delete(p.ref)));
  placesSnap.docs.forEach((d) => batch.delete(d.ref));
  if (placesSnap.size) await unlinkReservations(batch, tripId, placesSnap.docs.map((d) => d.id));
  batch.delete(doc(sub(tripId, 'days'), dayId));
  const first = remaining[0].date;
  remaining.forEach((d, i) => {
    const date = addDays(first, i);
    if (d.order !== i || d.date !== date) batch.update(doc(sub(tripId, 'days'), d.id), { order: i, date });
  });
  batch.update(tripDoc(tripId), { startDate: first, endDate: addDays(first, remaining.length - 1) });
  await save(batch.commit());
}

// ---------- places ----------
export function watchPlaces(tripId, cb, onError = logError) {
  return onSnapshot(sub(tripId, 'places'), (s) => cb(docsOf(s).sort(byOrder)), onError);
}

export async function addPlace(tripId, data) {
  const sameDay = docsOf(await readDocs(query(sub(tripId, 'places'), where('dayId', '==', data.dayId))));
  const ref = doc(sub(tripId, 'places')); // 아이디는 기기에서 바로 정해진다 (오프라인에서도 사진을 이어 붙일 수 있게)
  await save(setDoc(ref, {
    name: '', time: null, stayMinutes: null, category: 'sight', memo: '',
    lat: null, lng: null, address: null, photos: [],
    ...data, order: data.order ?? nextOrder(sameDay), // 자리를 정해 주면(예약→일정) 그대로, 아니면 그 날의 끝
  }));
  return ref.id;
}

export function updatePlace(tripId, placeId, data) {
  return save(updateDoc(doc(sub(tripId, 'places'), placeId), data));
}

export async function deletePlace(tripId, placeId) {
  const photosSnap = await readDocs(query(sub(tripId, 'photos'), where('placeId', '==', placeId)));
  const batch = writeBatch(db);
  photosSnap.docs.forEach((p) => batch.delete(p.ref));
  await unlinkReservations(batch, tripId, [placeId]);
  batch.delete(doc(sub(tripId, 'places'), placeId));
  await save(batch.commit());
}

// 장소를 다른 Day로 옮긴다 (옮긴 Day의 맨 뒤로)
export async function movePlaceToDay(tripId, placeId, dayId) {
  const sameDay = docsOf(await readDocs(query(sub(tripId, 'places'), where('dayId', '==', dayId))));
  await save(updateDoc(doc(sub(tripId, 'places'), placeId), { dayId, order: nextOrder(sameDay) }));
}

// ---------- photos ----------
// 사진은 긴 변 1280px JPEG 바이트를 Firestore 문서에 직접 저장한다 (Storage는 카드 등록이 필요해서 쓰지 않는다).
// trips/{tripId}/photos/{photoId}: { placeId, data: Bytes, width, height, createdAt }
export function watchPhotos(tripId, placeId, cb, onError = logError) {
  return onSnapshot(query(sub(tripId, 'photos'), where('placeId', '==', placeId)), (s) => {
    const photos = docsOf(s)
      .map((p) => ({ ...p, bytes: p.data instanceof Bytes ? p.data.toUint8Array() : new Uint8Array() }))
      .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
    cb(photos);
  }, onError);
}

export async function addPhoto(tripId, { placeId, bytes, width, height }) {
  const batch = writeBatch(db);
  const ref = doc(sub(tripId, 'photos'));
  batch.set(ref, { placeId, data: Bytes.fromUint8Array(bytes), width, height, createdAt: serverTimestamp() });
  batch.update(doc(sub(tripId, 'places'), placeId), { photoCount: increment(1) });
  await save(batch.commit());
  return ref.id;
}

export async function deletePhoto(tripId, photoId, placeId) {
  const batch = writeBatch(db);
  batch.delete(doc(sub(tripId, 'photos'), photoId));
  batch.update(doc(sub(tripId, 'places'), placeId), { photoCount: increment(-1) });
  await save(batch.commit());
}

export async function reorderPlaces(tripId, updates) {
  if (!updates.length) return;
  const batch = writeBatch(db);
  updates.forEach((u) => batch.update(doc(sub(tripId, 'places'), u.id), { order: u.order }));
  await save(batch.commit());
}

// ---------- checklist ----------
export function watchChecklist(tripId, cb, onError = logError) {
  return onSnapshot(sub(tripId, 'checklist'), (s) => cb(docsOf(s)), onError);
}

// order·done 을 주면 그대로 (지운 항목 되돌리기), 아니면 그룹 맨 끝에 체크 안 된 채로
export async function addChecklistItem(tripId, { group, groupOrder, text, order = null, done = false }) {
  const inGroup = order == null ? docsOf(await readDocs(query(sub(tripId, 'checklist'), where('group', '==', group)))) : [];
  const ref = doc(sub(tripId, 'checklist'));
  await save(setDoc(ref, { group, groupOrder, order: order ?? nextOrder(inGroup), text, done: !!done }));
  return ref.id;
}

export function updateChecklistItem(tripId, itemId, data) {
  return save(updateDoc(doc(sub(tripId, 'checklist'), itemId), data));
}

export function deleteChecklistItem(tripId, itemId) {
  return save(deleteDoc(doc(sub(tripId, 'checklist'), itemId)));
}

export async function renameChecklistGroup(tripId, from, to) {
  const snap = await readDocs(query(sub(tripId, 'checklist'), where('group', '==', from)));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { group: to }));
  await save(batch.commit());
}

export async function deleteChecklistGroup(tripId, group) {
  const snap = await readDocs(query(sub(tripId, 'checklist'), where('group', '==', group)));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await save(batch.commit());
}

// ---------- reservations ----------
export function watchReservations(tripId, cb, onError = logError) {
  return onSnapshot(sub(tripId, 'reservations'), (s) => cb(docsOf(s)), onError);
}

// 예약을 저장하면서 자동으로 만든 일정 장소도 같은 배치로 (예약 저장이 실패하면 장소만 남던 것을 막는다).
// newPlaces: [{ dayId, time, name, category, memo, order, ... }]. 만든 장소들은 예약의 연결(linkedPlaceIds)이 된다.
export async function saveReservation(tripId, id, data, newPlaces = []) {
  const batch = writeBatch(db);
  const placeIds = newPlaces.map((p) => {
    const ref = doc(sub(tripId, 'places'));
    batch.set(ref, { name: '', time: null, stayMinutes: null, category: 'sight', memo: '', lat: null, lng: null, address: null, photos: [], ...p });
    return ref.id;
  });
  const full = placeIds.length ? { ...data, ...linkFields(placeIds) } : data;
  const ref = id ? doc(sub(tripId, 'reservations'), id) : doc(sub(tripId, 'reservations'));
  if (id) batch.update(ref, full);
  else batch.set(ref, { type: 'etc', title: '', datetime: null, arrival: null, checkout: null, code: '', note: '', linkedPlaceId: null, linkedPlaceIds: [], flightNumber: null, fromAirport: '', toAirport: '', ...full });
  await save(batch.commit());
  return { id: ref.id, placeIds };
}

export async function deleteReservation(tripId, id) {
  const files = await readDocs(query(sub(tripId, 'files'), where('reservationId', '==', id)));
  const batch = writeBatch(db);
  files.docs.forEach((f) => batch.delete(f.ref));
  batch.delete(doc(sub(tripId, 'reservations'), id));
  await save(batch.commit());
}

// ---------- expenses (지출) ----------
// trips/{tripId}/expenses/{id}: { title, amount, currency, category, date, paidBy, sharedWith, note, createdAt }
export function watchExpenses(tripId, cb, onError = logError) {
  return onSnapshot(sub(tripId, 'expenses'), (s) => cb(docsOf(s)), onError);
}

export async function addExpense(tripId, data) {
  const ref = doc(sub(tripId, 'expenses'));
  await save(setDoc(ref, {
    title: '', amount: 0, currency: 'KRW', category: 'etc', date: null, paidBy: me().email, sharedWith: [], note: '',
    ...data, createdAt: serverTimestamp(),
  }));
  return ref.id;
}

export function updateExpense(tripId, id, data) {
  return save(updateDoc(doc(sub(tripId, 'expenses'), id), data));
}

export function deleteExpense(tripId, id) {
  return save(deleteDoc(doc(sub(tripId, 'expenses'), id)));
}

// 여행별 환율 (외화 1단위당 원화). 사용자가 고칠 수 있다.
export function setTripRates(tripId, rates) {
  return save(updateDoc(tripDoc(tripId), { rates }));
}

// ---------- files (예약 서류: 항공권 PDF, 바우처, 여권 사본) ----------
// trips/{tripId}/files/{fileId}: { reservationId, name, type, size, data: Bytes, createdAt }
// 목록은 예약 문서의 files 배열(메타데이터)로 보고, 바이트는 열 때만 받는다 (한 번 받으면 오프라인 캐시에 남는다).
export const FILE_MAX_BYTES = 950 * 1024; // Firestore 문서 1MiB 한도 아래

export async function addReservationFile(tripId, reservationId, { name, type, bytes }) {
  if (bytes.length > FILE_MAX_BYTES) throw new Error('too-large');
  const batch = writeBatch(db);
  const ref = doc(sub(tripId, 'files'));
  const meta = { id: ref.id, name, type, size: bytes.length };
  batch.set(ref, { reservationId, name, type, size: bytes.length, data: Bytes.fromUint8Array(bytes), createdAt: serverTimestamp() });
  batch.update(doc(sub(tripId, 'reservations'), reservationId), { files: arrayUnion(meta) });
  await save(batch.commit());
  return ref.id;
}

export async function getReservationFile(tripId, fileId) {
  const s = await readDoc(doc(sub(tripId, 'files'), fileId)); // 한 번 연 서류는 오프라인에서도 캐시로 열린다
  if (!s.exists()) return null;
  const d = s.data();
  return { name: d.name, type: d.type, bytes: d.data.toUint8Array() };
}

// meta 는 예약 문서 files 배열의 항목 그대로 (arrayRemove 는 내용이 같아야 지워진다)
export async function deleteReservationFile(tripId, reservationId, meta) {
  const batch = writeBatch(db);
  batch.delete(doc(sub(tripId, 'files'), meta.id));
  batch.update(doc(sub(tripId, 'reservations'), reservationId), { files: arrayRemove(meta) });
  await save(batch.commit());
}

// 사이트 주인용: 내가 볼 수 있는 모든 여행의 문서 크기를 합산 (Firestore 저장 한도 1 GiB 대비). 문서 수만큼 읽기를 쓰므로 버튼으로만 부른다.
export async function estimateStorage() {
  const { docSize } = await import('./lib/firestore-size.js');
  const trips = await getDocs(query(tripsCol(), where('memberEmails', 'array-contains', me().email)));
  let bytes = 0, docs = 0;
  const add = (snap) => snap.docs.forEach((d) => { bytes += docSize(d.ref.path, d.data()); docs += 1; });
  add(trips);
  for (const t of trips.docs) {
    for (const name of ['days', 'places', 'photos', 'checklist', 'reservations', 'expenses', 'files']) add(await getDocs(sub(t.id, name)));
  }
  return { bytes, docs, trips: trips.size };
}

// ---------- 초대 목록 관리 (사이트 주인) ----------
// allowedUsers/{email}: { invitedAt, invitedBy, canCreate? }. canCreate 가 켜진 계정은 새 여행을 만들 수 있다 (규칙에서도 검사).
export async function myAllowedEntry() {
  try { const s = await readDoc(doc(db, 'allowedUsers', me().email)); return s.exists() ? s.data() : null; }
  catch (err) { logError(err); return null; }
}

export function watchAllowedUsers(cb, onError = logError) {
  return onSnapshot(collection(db, 'allowedUsers'), (s) => cb(s.docs.map((d) => ({ email: d.id, ...d.data() }))), onError);
}

export function setAllowedUser(email, data = {}) {
  return save(setDoc(doc(db, 'allowedUsers', email), { invitedAt: serverTimestamp(), invitedBy: me().uid, ...data }, { merge: true }));
}

export function removeAllowedUser(email) {
  return save(deleteDoc(doc(db, 'allowedUsers', email)));
}
