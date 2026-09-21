import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmail, sortTripsByStart, isTripOwner, canCreateTrips } from '../js/lib/members.js';

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
