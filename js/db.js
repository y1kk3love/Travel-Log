import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, query, where, orderBy, limit,
  onSnapshot, writeBatch, serverTimestamp, getCountFromServer, increment, arrayUnion, arrayRemove, Bytes,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { db, auth } from './firebase.js';
import { dayList, addDays, toDateStr } from './lib/dates.js';
import { nextOrder } from './lib/order.js';
import { sortTripsByStart } from './lib/members.js';
import { planScheduleChange } from './lib/schedule.js';

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
    const allowed = await getDoc(doc(db, 'allowedUsers', email));
    if (allowed.exists()) return true;
  } catch (err) { logError(err); }
  try {
    const snap = await getDocs(query(tripsCol(), where('memberEmails', 'array-contains', email), limit(1)));
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
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { uid: user.uid, nickname: (user.displayName ?? '').trim().slice(0, 20), photoURL, updatedAt: serverTimestamp() });
    } else if ((snap.data().photoURL ?? null) !== photoURL) {
      // Google 프로필 사진이 바뀌면 따라간다 (닉네임은 건드리지 않는다)
      await setDoc(ref, { uid: user.uid, photoURL, updatedAt: serverTimestamp() }, { merge: true });
    }
  } catch (err) { logError(err); }
}

export function watchMyProfile(cb, onError = logError) {
  const { email } = me();
  return onSnapshot(doc(db, 'profiles', email), (s) => cb(s.exists() ? s.data() : null), onError);
}

export function setNickname(nickname) {
  const { uid, email } = me();
  return setDoc(doc(db, 'profiles', email), { uid, nickname, updatedAt: serverTimestamp() }, { merge: true });
}

// 여러 이메일의 프로필을 한 번에 (없는 사람은 null)
export async function getProfiles(emails) {
  const entries = await Promise.all(emails.map(async (email) => {
    try { const s = await getDoc(doc(db, 'profiles', email)); return [email, s.exists() ? s.data() : null]; }
    catch (err) { logError(err); return [email, null]; }
  }));
  return Object.fromEntries(entries);
}

// ---------- members (동행) ----------
export async function addMember(tripId, email) {
  const batch = writeBatch(db);
  batch.update(tripDoc(tripId), { memberEmails: arrayUnion(email) });
  batch.set(doc(db, 'allowedUsers', email), { invitedAt: serverTimestamp(), invitedBy: me().uid }, { merge: true });
  await batch.commit();
}

export function removeMember(tripId, email) {
  return updateDoc(tripDoc(tripId), { memberEmails: arrayRemove(email) });
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
  await batch.commit();
  return ref.id;
}

// 여행 제목·기간 수정. 기존 Day는 순서대로 새 날짜를 받고, 늘어난 날은 추가, 줄어든 뒤쪽 Day는 장소·사진과 함께 지운다.
export async function updateTripSchedule(tripId, { title, startDate, endDate }) {
  const days = docsOf(await getDocs(query(sub(tripId, 'days'), orderBy('order'))));
  const plan = planScheduleChange(days, startDate, endDate);
  if (!plan) throw new Error('invalid-range');
  const batch = writeBatch(db);
  batch.update(tripDoc(tripId), { title: title.trim(), startDate, endDate });
  plan.redate.forEach((d) => batch.update(doc(sub(tripId, 'days'), d.id), { date: d.date, order: d.order }));
  plan.add.forEach((d) => batch.set(doc(sub(tripId, 'days')), d));
  for (const dayId of plan.remove) {
    const placesSnap = await getDocs(query(sub(tripId, 'places'), where('dayId', '==', dayId)));
    for (const p of placesSnap.docs) {
      const photosSnap = await getDocs(query(sub(tripId, 'photos'), where('placeId', '==', p.id)));
      photosSnap.docs.forEach((ph) => batch.delete(ph.ref));
      batch.delete(p.ref);
    }
    if (placesSnap.size) await unlinkReservations(batch, tripId, placesSnap.docs.map((d) => d.id));
    batch.delete(doc(sub(tripId, 'days'), dayId));
  }
  await batch.commit();
  return plan;
}

// 기간을 줄일 때 사라질 Day의 장소 수 (확인 대화상자용)
export async function countPlacesInDays(tripId, dayIds) {
  let n = 0;
  for (const dayId of dayIds) n += (await getDocs(query(sub(tripId, 'places'), where('dayId', '==', dayId)))).size;
  return n;
}

// 대표 사진: 작게 줄인 JPEG 바이트를 여행 문서에 직접 둔다 (홈 목록에서 추가 읽기 없이 보이도록). null이면 제거.
export function setTripCover(tripId, bytes) {
  return updateDoc(tripDoc(tripId), { cover: bytes ? Bytes.fromUint8Array(bytes) : null });
}

export function coverBytes(trip) {
  return trip?.cover instanceof Bytes ? trip.cover.toUint8Array() : null;
}

export async function deleteTrip(tripId) {
  const batch = writeBatch(db);
  for (const name of ['days', 'places', 'photos', 'checklist', 'reservations', 'expenses', 'files']) {
    const snap = await getDocs(sub(tripId, name));
    snap.docs.forEach((d) => batch.delete(d.ref));
  }
  batch.delete(tripDoc(tripId));
  await batch.commit();
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

// 장소가 지워질 때 그 장소에 연결된 예약의 연결을 푼다 (배치에 추가)
async function unlinkReservations(batch, tripId, placeIds) {
  for (let i = 0; i < placeIds.length; i += 30) {
    const chunk = placeIds.slice(i, i + 30);
    const snap = await getDocs(query(sub(tripId, 'reservations'), where('linkedPlaceId', 'in', chunk)));
    snap.docs.forEach((d) => batch.update(d.ref, { linkedPlaceId: null }));
  }
}

// ---------- days ----------
export function watchDays(tripId, cb, onError = logError) {
  return onSnapshot(query(sub(tripId, 'days'), orderBy('order')), (s) => cb(docsOf(s)), onError);
}

export async function addDay(tripId) {
  const days = docsOf(await getDocs(query(sub(tripId, 'days'), orderBy('order'))));
  const last = days[days.length - 1];
  const date = last ? addDays(last.date, 1) : toDateStr(new Date());
  const batch = writeBatch(db);
  batch.set(doc(sub(tripId, 'days')), { date, order: days.length });
  batch.update(tripDoc(tripId), { endDate: date });
  await batch.commit();
}

// Day를 지우면 그 날 장소도 지우고, 남은 Day는 첫 날부터 이어지는 날짜로 다시 매긴다.
export async function deleteDay(tripId, dayId) {
  const [daysSnap, placesSnap] = await Promise.all([
    getDocs(query(sub(tripId, 'days'), orderBy('order'))),
    getDocs(query(sub(tripId, 'places'), where('dayId', '==', dayId))),
  ]);
  const remaining = docsOf(daysSnap).filter((d) => d.id !== dayId);
  if (remaining.length === 0) throw new Error('last-day');
  const batch = writeBatch(db);
  for (const d of placesSnap.docs) {
    const photosSnap = await getDocs(query(sub(tripId, 'photos'), where('placeId', '==', d.id)));
    photosSnap.docs.forEach((p) => batch.delete(p.ref));
    batch.delete(d.ref);
  }
  if (placesSnap.size) await unlinkReservations(batch, tripId, placesSnap.docs.map((d) => d.id));
  batch.delete(doc(sub(tripId, 'days'), dayId));
  const first = remaining[0].date;
  remaining.forEach((d, i) => {
    const date = addDays(first, i);
    if (d.order !== i || d.date !== date) batch.update(doc(sub(tripId, 'days'), d.id), { order: i, date });
  });
  batch.update(tripDoc(tripId), { startDate: first, endDate: addDays(first, remaining.length - 1) });
  await batch.commit();
}

// ---------- places ----------
export function watchPlaces(tripId, cb, onError = logError) {
  return onSnapshot(sub(tripId, 'places'), (s) => cb(docsOf(s).sort(byOrder)), onError);
}

export async function addPlace(tripId, data) {
  const sameDay = docsOf(await getDocs(query(sub(tripId, 'places'), where('dayId', '==', data.dayId))));
  const ref = await addDoc(sub(tripId, 'places'), {
    name: '', time: null, stayMinutes: null, category: 'sight', memo: '',
    lat: null, lng: null, address: null, photos: [],
    ...data, order: nextOrder(sameDay),
  });
  return ref.id;
}

export function updatePlace(tripId, placeId, data) {
  return updateDoc(doc(sub(tripId, 'places'), placeId), data);
}

export async function deletePlace(tripId, placeId) {
  const photosSnap = await getDocs(query(sub(tripId, 'photos'), where('placeId', '==', placeId)));
  const batch = writeBatch(db);
  photosSnap.docs.forEach((p) => batch.delete(p.ref));
  await unlinkReservations(batch, tripId, [placeId]);
  batch.delete(doc(sub(tripId, 'places'), placeId));
  await batch.commit();
}

// 장소를 다른 Day로 옮긴다 (옮긴 Day의 맨 뒤로)
export async function movePlaceToDay(tripId, placeId, dayId) {
  const sameDay = docsOf(await getDocs(query(sub(tripId, 'places'), where('dayId', '==', dayId))));
  await updateDoc(doc(sub(tripId, 'places'), placeId), { dayId, order: nextOrder(sameDay) });
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
  await batch.commit();
  return ref.id;
}

export async function deletePhoto(tripId, photoId, placeId) {
  const batch = writeBatch(db);
  batch.delete(doc(sub(tripId, 'photos'), photoId));
  batch.update(doc(sub(tripId, 'places'), placeId), { photoCount: increment(-1) });
  await batch.commit();
}

export async function reorderPlaces(tripId, updates) {
  if (!updates.length) return;
  const batch = writeBatch(db);
  updates.forEach((u) => batch.update(doc(sub(tripId, 'places'), u.id), { order: u.order }));
  await batch.commit();
}

// ---------- checklist ----------
export function watchChecklist(tripId, cb, onError = logError) {
  return onSnapshot(sub(tripId, 'checklist'), (s) => cb(docsOf(s)), onError);
}

export async function addChecklistItem(tripId, { group, groupOrder, text }) {
  const inGroup = docsOf(await getDocs(query(sub(tripId, 'checklist'), where('group', '==', group))));
  const ref = await addDoc(sub(tripId, 'checklist'), { group, groupOrder, order: nextOrder(inGroup), text, done: false });
  return ref.id;
}

export function updateChecklistItem(tripId, itemId, data) {
  return updateDoc(doc(sub(tripId, 'checklist'), itemId), data);
}

export function deleteChecklistItem(tripId, itemId) {
  return deleteDoc(doc(sub(tripId, 'checklist'), itemId));
}

export async function renameChecklistGroup(tripId, from, to) {
  const snap = await getDocs(query(sub(tripId, 'checklist'), where('group', '==', from)));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { group: to }));
  await batch.commit();
}

export async function deleteChecklistGroup(tripId, group) {
  const snap = await getDocs(query(sub(tripId, 'checklist'), where('group', '==', group)));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ---------- reservations ----------
export function watchReservations(tripId, cb, onError = logError) {
  return onSnapshot(sub(tripId, 'reservations'), (s) => cb(docsOf(s)), onError);
}

export async function addReservation(tripId, data) {
  const ref = await addDoc(sub(tripId, 'reservations'), {
    type: 'etc', title: '', datetime: null, code: '', note: '', linkedPlaceId: null, flightNumber: null, ...data,
  });
  return ref.id;
}

export function updateReservation(tripId, id, data) {
  return updateDoc(doc(sub(tripId, 'reservations'), id), data);
}

export async function deleteReservation(tripId, id) {
  const files = await getDocs(query(sub(tripId, 'files'), where('reservationId', '==', id)));
  const batch = writeBatch(db);
  files.docs.forEach((f) => batch.delete(f.ref));
  batch.delete(doc(sub(tripId, 'reservations'), id));
  await batch.commit();
}

// ---------- expenses (지출) ----------
// trips/{tripId}/expenses/{id}: { title, amount, currency, category, date, paidBy, sharedWith, note, createdAt }
export function watchExpenses(tripId, cb, onError = logError) {
  return onSnapshot(sub(tripId, 'expenses'), (s) => cb(docsOf(s)), onError);
}

export async function addExpense(tripId, data) {
  const ref = await addDoc(sub(tripId, 'expenses'), {
    title: '', amount: 0, currency: 'KRW', category: 'etc', date: null, paidBy: me().email, sharedWith: [], note: '',
    ...data, createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function updateExpense(tripId, id, data) {
  return updateDoc(doc(sub(tripId, 'expenses'), id), data);
}

export function deleteExpense(tripId, id) {
  return deleteDoc(doc(sub(tripId, 'expenses'), id));
}

// 여행별 환율 (외화 1단위당 원화). 사용자가 고칠 수 있다.
export function setTripRates(tripId, rates) {
  return updateDoc(tripDoc(tripId), { rates });
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
  await batch.commit();
  return ref.id;
}

export async function getReservationFile(tripId, fileId) {
  const s = await getDoc(doc(sub(tripId, 'files'), fileId));
  if (!s.exists()) return null;
  const d = s.data();
  return { name: d.name, type: d.type, bytes: d.data.toUint8Array() };
}

// meta 는 예약 문서 files 배열의 항목 그대로 (arrayRemove 는 내용이 같아야 지워진다)
export async function deleteReservationFile(tripId, reservationId, meta) {
  const batch = writeBatch(db);
  batch.delete(doc(sub(tripId, 'files'), meta.id));
  batch.update(doc(sub(tripId, 'reservations'), reservationId), { files: arrayRemove(meta) });
  await batch.commit();
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
