import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveItem, reorderUpdates, nextOrder } from '../js/lib/order.js';

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
