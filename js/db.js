import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where, orderBy,
  onSnapshot, writeBatch, serverTimestamp, getCountFromServer, increment, Bytes,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { db } from './firebase.js';
import { dayList, addDays, toDateStr } from './lib/dates.js';
import { nextOrder } from './lib/order.js';

export const DEFAULT_CHECKLIST = [
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
export function watchTrips(cb, onError = logError) {
  return onSnapshot(query(tripsCol(), orderBy('startDate', 'desc')), (s) => cb(docsOf(s)), onError);
}

export function watchTrip(tripId, cb, onError = logError) {
  return onSnapshot(tripDoc(tripId), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null), onError);
}

export async function createTrip({ title, startDate, endDate }) {
  const days = dayList(startDate, endDate);
  if (!title.trim() || days.length === 0) throw new Error('invalid-trip');
  const ref = doc(tripsCol());
  const batch = writeBatch(db);
  batch.set(ref, { title: title.trim(), startDate, endDate, coverPhoto: null, createdAt: serverTimestamp() });
  for (const day of days) batch.set(doc(sub(ref.id, 'days')), day);
  DEFAULT_CHECKLIST.forEach((g, groupOrder) => g.items.forEach((text, order) => {
    batch.set(doc(sub(ref.id, 'checklist')), { group: g.group, groupOrder, order, text, done: false });
  }));
  await batch.commit();
  return ref.id;
}

export function updateTrip(tripId, data) {
  return updateDoc(tripDoc(tripId), data);
}

export async function deleteTrip(tripId) {
  const batch = writeBatch(db);
  for (const name of ['days', 'places', 'photos', 'checklist', 'reservations']) {
    const snap = await getDocs(sub(tripId, name));
    snap.docs.forEach((d) => batch.delete(d.ref));
  }
  batch.delete(tripDoc(tripId));
  await batch.commit();
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
    return null;
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
  batch.delete(doc(sub(tripId, 'places'), placeId));
  await batch.commit();
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

export function deleteReservation(tripId, id) {
  return deleteDoc(doc(sub(tripId, 'reservations'), id));
}
