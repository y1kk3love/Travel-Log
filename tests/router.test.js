import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHash } from '../js/router.js';

test('빈 해시와 #/ 는 trips', () => {
  assert.deepEqual(parseHash(''), { name: 'trips' });
  assert.deepEqual(parseHash('#/'), { name: 'trips' });
  assert.deepEqual(parseHash('#/unknown'), { name: 'trips' });
});

test('trip 경로와 탭', () => {
  assert.deepEqual(parseHash('#/trip/abc'), { name: 'trip', tripId: 'abc', tab: 'planner' });
  assert.deepEqual(parseHash('#/trip/abc/checklist'), { name: 'trip', tripId: 'abc', tab: 'checklist' });
  assert.deepEqual(parseHash('#/trip/abc/reservations'), { name: 'trip', tripId: 'abc', tab: 'reservations' });
  assert.deepEqual(parseHash('#/trip/abc/bogus'), { name: 'trip', tripId: 'abc', tab: 'planner' });
});

test('planner 탭 뒤의 장소 ID는 placeId로 넘어온다', () => {
  assert.deepEqual(parseHash('#/trip/abc/planner/p1'), { name: 'trip', tripId: 'abc', tab: 'planner', placeId: 'p1' });
  assert.deepEqual(parseHash('#/trip/abc/checklist/p1'), { name: 'trip', tripId: 'abc', tab: 'checklist' });
});
