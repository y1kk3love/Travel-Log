import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePolyline, legKey, splitLegs, isFreshRoute, isKnownNoRoute, ROUTE_TTL_MS } from '../js/lib/polyline.js';

test('decodePolyline: Google 예제 문자열을 좌표 배열로 푼다', () => {
  // https://developers.google.com/maps/documentation/utilities/polylinealgorithm 의 예제
  const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  assert.deepEqual(pts.map(([lat, lng]) => [Number(lat.toFixed(5)), Number(lng.toFixed(5))]),
    [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
});

test('decodePolyline: 빈 문자열·이상한 값은 빈 배열', () => {
  assert.deepEqual(decodePolyline(''), []);
  assert.deepEqual(decodePolyline(null), []);
});

test('legKey: 좌표를 소수 5자리로 반올림해 방향이 있는 키를 만든다', () => {
  const a = { lat: 35.658584, lng: 139.745431 };
  const b = { lat: 35.6595, lng: 139.7005 };
  assert.equal(legKey(a, b), '35.65858,139.74543>35.6595,139.7005');
  assert.notEqual(legKey(a, b), legKey(b, a));
});

test('splitLegs: 좌표 있는 장소만 이어서 구간 목록을 만든다', () => {
  const places = [
    { id: 'a', lat: 1, lng: 1 }, { id: 'b', lat: null, lng: null }, { id: 'c', lat: 2, lng: 2 }, { id: 'd', lat: 3, lng: 3 },
  ];
  assert.deepEqual(splitLegs(places).map((l) => [l.from.id, l.to.id]), [['a', 'c'], ['c', 'd']]);
  assert.deepEqual(splitLegs([{ id: 'x', lat: 1, lng: 1 }]), []);
});

test('isFreshRoute: 같은 구간이고 30일 안이면 저장본을 쓴다', () => {
  const now = 1_800_000_000_000;
  const route = { key: 'a>b', encoded: '_p~iF~ps|U', at: now - 5 * 24 * 3600 * 1000 };
  assert.equal(isFreshRoute(route, 'a>b', now), true);
  assert.equal(isFreshRoute(route, 'a>c', now), false);            // 구간이 바뀜(좌표·순서 변경)
  assert.equal(isFreshRoute({ ...route, at: now - ROUTE_TTL_MS }, 'a>b', now), false); // 30일 경과
  assert.equal(isFreshRoute({ ...route, encoded: '' }, 'a>b', now), false);
  assert.equal(isFreshRoute(null, 'a>b', now), false);
  assert.equal(isFreshRoute(undefined, 'a>b', now), false);
});

test('isKnownNoRoute: 같은 구간을 "경로 없음"으로 30일 안에 저장했으면 다시 묻지 않는다', () => {
  const now = 1_800_000_000_000;
  const none = { key: 'a>b', none: true, at: now - 24 * 3600 * 1000 };
  assert.equal(isKnownNoRoute(none, 'a>b', now), true);
  assert.equal(isKnownNoRoute(none, 'a>c', now), false); // 장소가 바뀌면 다시 묻는다
  assert.equal(isKnownNoRoute({ ...none, at: now - ROUTE_TTL_MS }, 'a>b', now), false);
  assert.equal(isKnownNoRoute({ key: 'a>b', encoded: '_p~iF~ps|U', at: now }, 'a>b', now), false); // 실제 경로
  assert.equal(isKnownNoRoute(null, 'a>b', now), false);
});

test('isFreshRoute: "경로 없음" 저장본은 그릴 경로가 아니다', () => {
  const now = 1_800_000_000_000;
  assert.equal(isFreshRoute({ key: 'a>b', none: true, at: now }, 'a>b', now), false);
});
