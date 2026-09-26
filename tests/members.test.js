import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmail, sortTripsByStart, isTripOwner, canCreateTrips, canEditTripInfo, NEW_INVITE, canManageTrip, isAdminViewing } from '../js/lib/members.js';

test('normalizeEmail: 공백 제거·소문자, 형식이 아니면 null', () => {
  assert.equal(normalizeEmail('  Friend@Gmail.com '), 'friend@gmail.com');
  assert.equal(normalizeEmail('not-an-email'), null);
  assert.equal(normalizeEmail(''), null);
  assert.equal(normalizeEmail(null), null);
});

test('sortTripsByStart: 시작일 내림차순, 같은 날은 제목순', () => {
  const trips = [
    { title: 'b', startDate: '2026-01-01' },
    { title: 'c', startDate: '2026-05-01' },
    { title: 'a', startDate: '2026-01-01' },
  ];
  assert.deepEqual(sortTripsByStart(trips).map((t) => t.title), ['c', 'a', 'b']);
  assert.deepEqual(trips.map((t) => t.title), ['b', 'c', 'a']);
});

test('isTripOwner', () => {
  assert.equal(isTripOwner({ ownerUid: 'u1' }, { uid: 'u1' }), true);
  assert.equal(isTripOwner({ ownerUid: 'u1' }, { uid: 'u2' }), false);
  assert.equal(isTripOwner({}, { uid: 'u1' }), false);
  assert.equal(isTripOwner({ ownerUid: 'u1' }, null), false);
});

test('canCreateTrips: 사이트 주인은 항상, 그 외는 초대 목록 항목에 canCreate 가 켜져 있을 때만', () => {
  assert.equal(canCreateTrips({ isSiteOwner: true, allowed: null }), true);
  assert.equal(canCreateTrips({ isSiteOwner: false, allowed: { canCreate: true } }), true);
  assert.equal(canCreateTrips({ isSiteOwner: false, allowed: { invitedAt: 1 } }), false);
  assert.equal(canCreateTrips({ isSiteOwner: false, allowed: null }), false);
});

test('canEditTripInfo: 여행을 만든 사람과 사이트 주인은 대표 사진·여행 정보를 고칠 수 있다', () => {
  const trip = { ownerUid: 'creator' };
  assert.equal(canEditTripInfo(trip, { uid: 'creator' }, false), true); // 초대받아 직접 만든 여행
  assert.equal(canEditTripInfo(trip, { uid: 'site-owner' }, true), true);
  assert.equal(canEditTripInfo(trip, { uid: 'companion' }, false), false);
  assert.equal(canEditTripInfo(trip, null, false), false);
});

test('NEW_INVITE: 새로 초대한 계정은 동행으로만 참여한다 (여행 만들기는 사이트 주인이 따로 켠다)', () => {
  assert.deepEqual(NEW_INVITE, { canCreate: false });
  assert.equal(canCreateTrips({ isSiteOwner: false, allowed: NEW_INVITE }), false);
});

test('canManageTrip: 동행 관리·여행 삭제는 여행 주인이거나 관리자(사이트 주인)', () => {
  const trip = { ownerUid: 'u1', memberEmails: ['a@x.com', 'b@x.com'] };
  assert.equal(canManageTrip(trip, { uid: 'u1', email: 'a@x.com' }, false), true);
  assert.equal(canManageTrip(trip, { uid: 'u2', email: 'b@x.com' }, false), false);
  assert.equal(canManageTrip(trip, { uid: 'admin', email: 'z@x.com' }, true), true);
  assert.equal(canManageTrip(trip, null, true), false);
});

test('isAdminViewing: 관리자가 동행이 아닌 여행을 볼 때만 (관리자로 보는 중 표시)', () => {
  const trip = { ownerUid: 'u1', memberEmails: ['a@x.com', 'b@x.com'] };
  assert.equal(isAdminViewing(trip, { uid: 'admin', email: 'z@x.com' }, true), true);
  assert.equal(isAdminViewing(trip, { uid: 'admin', email: 'A@x.com' }, true), false); // 대소문자 달라도 동행이면 아님
  assert.equal(isAdminViewing(trip, { uid: 'u2', email: 'z@x.com' }, false), false);
});
