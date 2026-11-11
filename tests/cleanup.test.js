import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCleanup, removeCleanup, parseCleanups } from '../js/lib/cleanup.js';

const e1 = { tripId: 'T1', col: 'photos', field: 'placeId', value: 'P1' };
const e2 = { tripId: 'T1', col: 'files', field: 'reservationId', value: 'R1' };

test('addCleanup: 같은 항목은 한 번만, 원본 목록은 건드리지 않는다', () => {
  const a = addCleanup([], e1);
  const b = addCleanup(a, { ...e1 });
  assert.deepEqual(a, [e1]);
  assert.deepEqual(b, [e1]);
  assert.deepEqual(addCleanup(b, e2), [e1, e2]);
});

test('addCleanup: 모양이 다른 항목은 넣지 않고, 200개를 넘으면 오래된 것부터 버린다', () => {
  assert.deepEqual(addCleanup([], { tripId: 'T1' }), []);
  let list = [];
  for (let i = 0; i < 205; i++) list = addCleanup(list, { ...e1, value: `P${i}` });
  assert.equal(list.length, 200);
  assert.equal(list[0].value, 'P5');
});

test('removeCleanup: 끝낸 항목만 뺀다', () => {
  assert.deepEqual(removeCleanup([e1, e2], e1), [e2]);
});

test('parseCleanups: 깨진 글자·다른 모양은 빈 목록', () => {
  assert.deepEqual(parseCleanups(null), []);
  assert.deepEqual(parseCleanups('{'), []);
  assert.deepEqual(parseCleanups('{"a":1}'), []);
  assert.deepEqual(parseCleanups(JSON.stringify([e1, { x: 1 }])), [e1]);
});
