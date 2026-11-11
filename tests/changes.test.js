import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedFields, hasChanges } from '../js/lib/changes.js';

test('changedFields: 내가 바꾼 필드만 고른다 (동행이 그 사이 고친 다른 필드를 덮어쓰지 않게)', () => {
  const base = { name: '오사카성', time: '13:00', memo: '입장권 현장 구매', lat: 34.6, lng: 135.5, stayMinutes: 90 };
  const next = { name: '오사카성', time: '14:00', memo: '입장권 현장 구매', lat: 34.6, lng: 135.5, stayMinutes: 90 };
  assert.deepEqual(changedFields(base, next), { time: '14:00' });
});

test('changedFields: 없는 필드와 null 은 같은 값으로 본다 (예전 문서엔 필드가 없기도 하다)', () => {
  assert.deepEqual(changedFields({ name: '카페' }, { name: '카페', time: null, placeId: null }), {});
  assert.deepEqual(changedFields({ name: '카페', time: '10:00' }, { name: '카페', time: null }), { time: null });
});

test('changedFields: 배열·맵은 내용으로 비교한다', () => {
  const base = { sharedWith: ['a@x.com', 'b@x.com'], linkedPlaceIds: ['P1'] };
  assert.deepEqual(changedFields(base, { sharedWith: ['a@x.com', 'b@x.com'], linkedPlaceIds: ['P1'] }), {});
  assert.deepEqual(changedFields(base, { sharedWith: ['a@x.com'], linkedPlaceIds: ['P1'] }), { sharedWith: ['a@x.com'] });
});

test('changedFields: 빈 글자와 null 은 다르다 (메모를 지우면 저장한다)', () => {
  assert.deepEqual(changedFields({ memo: '안녕' }, { memo: '' }), { memo: '' });
  assert.deepEqual(changedFields({ amount: 0 }, { amount: 0 }), {});
});

test('hasChanges: 바뀐 게 없으면 저장하지 않는다', () => {
  assert.equal(hasChanges({}), false);
  assert.equal(hasChanges({ time: null }), true);
});
