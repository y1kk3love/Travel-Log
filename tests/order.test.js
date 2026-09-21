import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveItem, reorderUpdates, nextOrder, orderForTime } from '../js/lib/order.js';

test('moveItem: 앞→뒤, 뒤→앞, 원본 불변', () => {
  const list = ['a', 'b', 'c', 'd'];
  assert.deepEqual(moveItem(list, 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveItem(list, 3, 1), ['a', 'd', 'b', 'c']);
  assert.deepEqual(list, ['a', 'b', 'c', 'd']);
});

test('moveItem: 같은 자리나 범위 밖이면 그대로', () => {
  assert.deepEqual(moveItem(['a', 'b'], 1, 1), ['a', 'b']);
  assert.deepEqual(moveItem(['a', 'b'], 0, 5), ['a', 'b']);
});

test('reorderUpdates: 바뀐 항목만 새 order로', () => {
  const items = [{ id: 'p1', order: 0 }, { id: 'p2', order: 1 }, { id: 'p3', order: 2 }, { id: 'p4', order: 3 }];
  assert.deepEqual(reorderUpdates(items, 2, 0), [{ id: 'p3', order: 0 }, { id: 'p1', order: 1 }, { id: 'p2', order: 2 }]);
});

test('reorderUpdates: 같은 자리면 빈 배열', () => {
  const items = [{ id: 'p1', order: 0 }, { id: 'p2', order: 1 }];
  assert.deepEqual(reorderUpdates(items, 1, 1), []);
});

test('reorderUpdates: 기존 order에 구멍이 있으면 0부터 다시 매긴다', () => {
  const items = [{ id: 'p1', order: 0 }, { id: 'p2', order: 5 }];
  assert.deepEqual(reorderUpdates(items, 0, 0), [{ id: 'p2', order: 1 }]);
});

test('nextOrder', () => {
  assert.equal(nextOrder([]), 0);
  assert.equal(nextOrder([{ order: 0 }, { order: 4 }]), 5);
});

test('orderForTime: 시각 순서에 맞는 자리의 order 를 돌려준다 (사이면 중간값, 뒤면 끝+1, 빈 날이면 0)', () => {
  const items = [{ id: 'a', order: 0, time: '09:00' }, { id: 'b', order: 1, time: null }, { id: 'c', order: 2, time: '12:00' }, { id: 'd', order: 3, time: '18:00' }];
  assert.equal(orderForTime(items, '10:30'), 1.5); // b(시각 없음)는 a 에 딸린 것으로 보고 c 앞
  assert.equal(orderForTime(items, '08:00'), -1);  // 맨 앞
  assert.equal(orderForTime(items, '20:00'), 4);   // 맨 뒤
  assert.equal(orderForTime(items, '12:00'), 2.5); // 같은 시각이면 그 뒤
  assert.equal(orderForTime([], '10:00'), 0);
  assert.equal(orderForTime([{ id: 'x', order: 5, time: null }], '10:00'), 6); // 시각 없는 것만 있으면 끝
});
