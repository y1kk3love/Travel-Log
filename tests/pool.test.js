import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPooled, poolPlaces, chunk } from '../js/lib/pool.js';

test('isPooled: 날짜가 없는 장소는 보관함', () => {
  assert.equal(isPooled({ dayId: null }, new Set(['D1'])), true);
  assert.equal(isPooled({ dayId: 'D1' }, new Set(['D1'])), false);
});

test('isPooled: 지워진 Day 를 가리키는 장소도 보관함에 보인다 (Day 를 지우는 사이 동행이 넣은 장소가 사라지지 않게)', () => {
  assert.equal(isPooled({ dayId: 'GONE' }, new Set(['D1', 'D2'])), true);
});

test('isPooled: Day 목록을 아직 못 받았으면 날짜 있는 장소를 보관함으로 옮겨 보이지 않는다', () => {
  assert.equal(isPooled({ dayId: 'D1' }, null), false);
  assert.equal(isPooled({ dayId: 'D1' }, new Set()), false);
});

test('chunk: 배치 한도(500) 아래로 나눈다', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 450), []);
  assert.equal(chunk(Array.from({ length: 1001 }, (_, i) => i), 450).length, 3);
});

test('poolPlaces: 날짜 미정 장소와 지워진 Day 의 장소·메모 (날짜 미정 메모는 원래 없고, 있는 Day 의 메모는 그 Day 에)', () => {
  const dayIds = new Set(['D1']);
  const places = [
    { id: 'a', dayId: null, category: 'sight' },
    { id: 'b', dayId: 'D1', category: 'sight' },
    { id: 'c', dayId: 'GONE', category: 'food' },
    { id: 'm1', dayId: 'D1', category: 'note' },
    { id: 'm2', dayId: 'GONE', category: 'note' },
  ];
  assert.deepEqual(poolPlaces(places, dayIds).map((p) => p.id), ['a', 'c', 'm2']);
});
