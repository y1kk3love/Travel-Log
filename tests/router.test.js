import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHash, navDirection } from '../js/router.js';

test('빈 해시와 #/ 는 trips', () => {
  assert.deepEqual(parseHash(''), { name: 'trips' });
  assert.deepEqual(parseHash('#/'), { name: 'trips' });
  assert.deepEqual(parseHash('#/unknown'), { name: 'trips' });
});

test('trip 경로와 탭', () => {
  assert.deepEqual(parseHash('#/share'), { name: 'share' });
  assert.deepEqual(parseHash('#/trip/abc'), { name: 'trip', tripId: 'abc', tab: 'planner' });
  assert.deepEqual(parseHash('#/trip/abc/checklist'), { name: 'trip', tripId: 'abc', tab: 'checklist' });
  assert.deepEqual(parseHash('#/trip/abc/reservations'), { name: 'trip', tripId: 'abc', tab: 'reservations' });
  assert.deepEqual(parseHash('#/trip/abc/bogus'), { name: 'trip', tripId: 'abc', tab: 'planner' });
});

test('planner 탭 뒤의 장소 ID는 placeId로 넘어온다', () => {
  assert.deepEqual(parseHash('#/trip/abc/planner/p1'), { name: 'trip', tripId: 'abc', tab: 'planner', placeId: 'p1' });
  assert.deepEqual(parseHash('#/trip/abc/checklist/p1'), { name: 'trip', tripId: 'abc', tab: 'checklist' });
});

test('navDirection: 홈→여행은 forward, 여행→홈은 back, 같은 여행의 탭 이동은 same', () => {
  const home = parseHash('#/'), trip = parseHash('#/trip/abc'), tab = parseHash('#/trip/abc/expenses'), other = parseHash('#/trip/xyz');
  assert.equal(navDirection(home, trip), 'forward');
  assert.equal(navDirection(trip, home), 'back');
  assert.equal(navDirection(trip, tab), 'same');
  assert.equal(navDirection(tab, other), 'same');
  assert.equal(navDirection(null, home), 'same');
  assert.equal(navDirection(home, parseHash('#/share')), 'forward');
});

test('reservations 탭 뒤의 ID 는 reservationId 로 넘어온다 (일정 → 예약 바로가기)', () => {
  assert.deepEqual(parseHash('#/trip/abc/reservations/r1'), { name: 'trip', tripId: 'abc', tab: 'reservations', reservationId: 'r1' });
  assert.deepEqual(parseHash('#/trip/abc/reservations'), { name: 'trip', tripId: 'abc', tab: 'reservations' });
});

test('#/admin 은 관리자 화면 (홈에서 들어가면 forward)', () => {
  assert.deepEqual(parseHash('#/admin'), { name: 'admin' });
  assert.equal(navDirection({ name: 'trips' }, { name: 'admin' }), 'forward');
});
