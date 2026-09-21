import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePolyline, legKey, splitLegs } from '../js/lib/polyline.js';

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
