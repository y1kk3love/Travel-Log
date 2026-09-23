// Firestore 보안 규칙 테스트 (에뮬레이터에서만 돈다: npm run test:rules)
// 실제 프로젝트와 무관한 demo- 프로젝트라 로그인·과금 없이 돈다.
import { test, before, after, beforeEach } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs, writeBatch, Bytes, serverTimestamp, setLogLevel } from 'firebase/firestore';

setLogLevel('silent'); // 막혀야 할 요청의 PERMISSION_DENIED 경고가 결과를 덮지 않게

const OWNER_UID = 'cA5VgvDvMKQMVKtEDyggCGVqTvW2';
const OWNER = 'owner@gmail.com';
const FRIEND = 'friend@gmail.com';     // 초대받은 동행 (여행 만들기 꺼짐)
const CREATOR = 'creator@gmail.com';   // 여행 만들기 켜진 초대 계정
const STRANGER = 'stranger@gmail.com'; // 초대 안 됨

let env;
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8181').split(':');

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-travel-log',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
});
after(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'allowedUsers', FRIEND), { invitedAt: 1, invitedBy: OWNER_UID, canCreate: false });
    await setDoc(doc(db, 'allowedUsers', CREATOR), { invitedAt: 1, invitedBy: OWNER_UID, canCreate: true });
    await setDoc(doc(db, 'trips', 'T1'), {
      title: '오사카', startDate: '2027-02-13', endDate: '2027-02-16', coverPhoto: null, createdAt: 1,
      ownerUid: OWNER_UID, ownerEmail: OWNER, memberEmails: [OWNER, FRIEND],
    });
    await setDoc(doc(db, 'trips', 'T1', 'places', 'P1'), { name: '오사카성', time: '13:00', category: 'sight', memo: '', dayId: 'D1', order: 0, lat: 1, lng: 2, address: null, stayMinutes: null, photos: [] });
  });
});

const as = (uid, email) => env.authenticatedContext(uid, { email }).firestore();
const owner = () => as(OWNER_UID, OWNER);
const friend = () => as('friend-uid', FRIEND);
const creator = () => as('creator-uid', CREATOR);
const stranger = () => as('stranger-uid', STRANGER);
const place = (extra = {}) => ({ name: '카페', time: null, category: 'cafe', memo: '', dayId: 'D1', order: 1, lat: null, lng: null, address: null, stayMinutes: null, photos: [], ...extra });
const bytes = (n) => Bytes.fromUint8Array(new Uint8Array(n));

test('초대 안 된 계정은 여행과 그 안의 문서를 읽거나 쓸 수 없다', async () => {
  await assertFails(getDoc(doc(stranger(), 'trips', 'T1')));
  await assertFails(getDocs(collection(stranger(), 'trips', 'T1', 'places')));
  await assertFails(setDoc(doc(stranger(), 'trips', 'T1', 'places', 'X'), place()));
});

test('초대 안 된 계정은 자기 프로필도 만들 수 없다 (하루 쓰기 한도를 쓰지 못하게)', async () => {
  await assertFails(setDoc(doc(stranger(), 'profiles', STRANGER), { uid: 'stranger-uid', nickname: '누구' }));
});

test('동행은 여행을 읽고, 정해진 필드로 장소를 만들고 고칠 수 있다', async () => {
  await assertSucceeds(getDoc(doc(friend(), 'trips', 'T1')));
  await assertSucceeds(setDoc(doc(friend(), 'trips', 'T1', 'places', 'P2'), place()));
  await assertSucceeds(updateDoc(doc(friend(), 'trips', 'T1', 'places', 'P1'), { time: '14:00', routeToNext: { key: 'a>b', none: true, at: 1 } }));
});

test('모르는 필드·모르는 모음·너무 긴 글은 막는다', async () => {
  await assertFails(setDoc(doc(friend(), 'trips', 'T1', 'places', 'P3'), place({ evil: 1 })));
  await assertFails(setDoc(doc(friend(), 'trips', 'T1', 'junk', 'x'), { a: 1 }));
  await assertFails(setDoc(doc(friend(), 'trips', 'T1', 'places', 'P4'), place({ memo: 'x'.repeat(10001) })));
});

test('동행은 동행 목록·소유자를 바꾸거나 여행을 지울 수 없고, 환율은 고칠 수 있다', async () => {
  await assertFails(updateDoc(doc(friend(), 'trips', 'T1'), { memberEmails: [OWNER, FRIEND, STRANGER] }));
  await assertFails(updateDoc(doc(friend(), 'trips', 'T1'), { ownerUid: 'friend-uid' }));
  await assertFails(updateDoc(doc(friend(), 'trips', 'T1'), { ownerEmail: FRIEND }));
  await assertFails(deleteDoc(doc(friend(), 'trips', 'T1')));
  await assertSucceeds(updateDoc(doc(friend(), 'trips', 'T1'), { rates: { JPY: 9 } }));
});

test('여행 주인은 동행을 더하고 여행을 지울 수 있다', async () => {
  await assertSucceeds(updateDoc(doc(owner(), 'trips', 'T1'), { memberEmails: [OWNER, FRIEND, CREATOR] }));
  await assertSucceeds(deleteDoc(doc(owner(), 'trips', 'T1')));
});

test('여행 만들기: 켜진 계정만, 자기를 주인·멤버로, 정해진 필드로', async () => {
  const trip = (email, uid, extra = {}) => ({ title: '새 여행', startDate: '2027-05-01', endDate: '2027-05-03', coverPhoto: null, createdAt: serverTimestamp(), ownerUid: uid, ownerEmail: email, memberEmails: [email], ...extra });
  await assertSucceeds(setDoc(doc(creator(), 'trips', 'N1'), trip(CREATOR, 'creator-uid')));
  await assertFails(setDoc(doc(friend(), 'trips', 'N2'), trip(FRIEND, 'friend-uid')));
  await assertFails(setDoc(doc(creator(), 'trips', 'N3'), trip(CREATOR, 'someone-else')));
  await assertFails(setDoc(doc(creator(), 'trips', 'N4'), trip(CREATOR, 'creator-uid', { evil: true })));
  await assertFails(setDoc(doc(creator(), 'trips', 'N5'), trip(CREATOR, 'creator-uid', { startDate: '5월 1일' })));
});

test('여행과 첫 Day·체크리스트를 한 배치로 만들 수 있다 (새 여행 만들기 흐름)', async () => {
  const db = creator();
  const batch = writeBatch(db);
  batch.set(doc(db, 'trips', 'B1'), { title: '배치', startDate: '2027-06-01', endDate: '2027-06-01', coverPhoto: null, createdAt: serverTimestamp(), ownerUid: 'creator-uid', ownerEmail: CREATOR, memberEmails: [CREATOR] });
  batch.set(doc(db, 'trips', 'B1', 'days', 'D1'), { date: '2027-06-01', order: 0 });
  batch.set(doc(db, 'trips', 'B1', 'checklist', 'C1'), { group: '짐', groupOrder: 0, order: 0, text: '여권', done: false });
  await assertSucceeds(batch.commit());
});

test('프로필: 초대받은 본인만, 닉네임 20자·Google 사진 주소만', async () => {
  await assertSucceeds(setDoc(doc(friend(), 'profiles', FRIEND), { uid: 'friend-uid', nickname: '동행', photoURL: 'https://lh3.googleusercontent.com/a/abc=s96-c', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(friend(), 'profiles', OWNER), { uid: 'friend-uid', nickname: '사칭' }));
  await assertFails(setDoc(doc(friend(), 'profiles', FRIEND), { uid: 'friend-uid', nickname: 'x'.repeat(21) }));
  await assertFails(setDoc(doc(friend(), 'profiles', FRIEND), { uid: 'friend-uid', photoURL: 'https://evil.example.com/x.png' }));
});

test('예약 서류: PDF·JPEG 만, 950 KiB 까지', async () => {
  const file = (type, size) => ({ reservationId: 'R1', name: 'a.pdf', type, size, data: bytes(size), createdAt: serverTimestamp() });
  await assertSucceeds(setDoc(doc(friend(), 'trips', 'T1', 'files', 'F1'), file('application/pdf', 1000)));
  await assertFails(setDoc(doc(friend(), 'trips', 'T1', 'files', 'F2'), file('text/html', 1000)));
  await assertFails(setDoc(doc(friend(), 'trips', 'T1', 'files', 'F3'), file('application/pdf', 950 * 1024 + 1)));
});

test('사진은 720 KiB 까지', async () => {
  const photo = (size) => ({ placeId: 'P1', data: bytes(size), width: 1, height: 1, createdAt: serverTimestamp() });
  await assertSucceeds(setDoc(doc(friend(), 'trips', 'T1', 'photos', 'PH1'), photo(700 * 1024)));
  await assertFails(setDoc(doc(friend(), 'trips', 'T1', 'photos', 'PH2'), photo(720 * 1024 + 1)));
});

test('초대 목록: 여행 만들기 켜진 계정은 동행을 초대할 수 있지만 여행 만들기를 켤 수 없고, 목록은 사이트 주인만 본다', async () => {
  await assertSucceeds(setDoc(doc(creator(), 'allowedUsers', 'new@gmail.com'), { invitedAt: serverTimestamp(), invitedBy: 'creator-uid' }));
  await assertFails(setDoc(doc(creator(), 'allowedUsers', 'new2@gmail.com'), { invitedAt: serverTimestamp(), invitedBy: 'creator-uid', canCreate: true }));
  await assertFails(setDoc(doc(friend(), 'allowedUsers', 'new3@gmail.com'), { invitedAt: serverTimestamp(), invitedBy: 'friend-uid' }));
  await assertFails(getDocs(collection(friend(), 'allowedUsers')));
  await assertSucceeds(getDocs(collection(owner(), 'allowedUsers')));
});
