import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasCoords, distanceKm, walkMinutes, legLabel } from '../js/lib/geo.js';

test('hasCoords', () => {
  assert.equal(hasCoords({ lat: 35, lng: 135 }), true);
  assert.equal(hasCoords({ lat: null, lng: null }), false);
  assert.equal(hasCoords({}), false);
  assert.equal(hasCoords(null), false);
});

test('distanceKm: 같은 점은 0, 후시미이나리→기요미즈데라는 약 3.3km', () => {
  assert.equal(distanceKm({ lat: 35, lng: 135 }, { lat: 35, lng: 135 }), 0);
  const d = distanceKm({ lat: 34.9671, lng: 135.7727 }, { lat: 34.9949, lng: 135.7850 });
  assert.ok(d > 3.2 && d < 3.4, `got ${d}`);
});

test('walkMinutes: 4.5km/h 기준 올림, 최소 1분', () => {
  assert.equal(walkMinutes(1.1), 15);
  assert.equal(walkMinutes(0), 1);
});

test('legLabel: 3km 이하는 도보, 초과는 거리만, 좌표 없으면 null', () => {
  assert.equal(legLabel({ lat: 35, lng: 135 }, { lat: 35.009, lng: 135 }), '도보 14분 · 1.0km');
  assert.equal(legLabel({ lat: 35, lng: 135 }, { lat: 35.05, lng: 135 }), '거리 5.6km');
  assert.equal(legLabel({ lat: 35, lng: 135 }, { lat: null, lng: null }), null);
  assert.equal(legLabel({ name: '이름만' }, { lat: 35, lng: 135 }), null);
});

test('legLabel: 구글 도보 경로가 있으면 그 시간·거리를 쓴다 (3km 넘어도 도보 표시)', () => {
  assert.equal(legLabel({ lat: 35, lng: 135 }, { lat: 35.009, lng: 135 }, { seconds: 970, meters: 1140 }), '도보 17분 · 1.1km');
  assert.equal(legLabel({ lat: 35, lng: 135 }, { lat: 35.009, lng: 135 }, null), '도보 14분 · 1.0km');
});
