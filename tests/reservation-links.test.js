import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkedIds, chooseLink, withoutPlaces, linkFields } from '../js/lib/reservation-links.js';

test('linkedIds: 여러 개 연결(linkedPlaceIds)과 예전 한 개 연결(linkedPlaceId)을 합쳐 중복 없이', () => {
  assert.deepEqual(linkedIds({ linkedPlaceIds: ['a', 'b'], linkedPlaceId: 'a' }), ['a', 'b']);
  assert.deepEqual(linkedIds({ linkedPlaceId: 'x' }), ['x']);
  assert.deepEqual(linkedIds({ linkedPlaceIds: [], linkedPlaceId: null }), []);
  assert.deepEqual(linkedIds(null), []);
});

test('chooseLink: "연결 안 함"을 고르면 여러 박 연결까지 전부 끊는다', () => {
  assert.deepEqual(chooseLink(['in', 'night', 'out'], ''), []);
});

test('chooseLink: 첫 연결을 그대로 두면 숙소 여러 박 연결을 지킨다', () => {
  assert.deepEqual(chooseLink(['in', 'night', 'out'], 'in'), ['in', 'night', 'out']);
});

test('chooseLink: 다른 장소를 고르면 그 하나로 바뀐다 (예전 연결이 남지 않는다)', () => {
  assert.deepEqual(chooseLink(['in', 'night', 'out'], 'other'), ['other']);
  assert.deepEqual(chooseLink([], 'p1'), ['p1']);
});

test('withoutPlaces: 지운 장소를 연결에서 뺀다 (예전 한 개 연결 필드도 함께 본다)', () => {
  assert.deepEqual(withoutPlaces({ linkedPlaceIds: ['a', 'b', 'c'] }, ['b']), ['a', 'c']);
  assert.deepEqual(withoutPlaces({ linkedPlaceId: 'a', linkedPlaceIds: [] }, ['a']), []);
});

test('linkFields: 저장할 두 필드 (한 개 연결 필드는 첫 연결로 맞춘다)', () => {
  assert.deepEqual(linkFields(['a', 'b']), { linkedPlaceIds: ['a', 'b'], linkedPlaceId: 'a' });
  assert.deepEqual(linkFields([]), { linkedPlaceIds: [], linkedPlaceId: null });
});
