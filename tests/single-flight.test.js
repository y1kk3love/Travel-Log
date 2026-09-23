import { test } from 'node:test';
import assert from 'node:assert/strict';
import { singleFlight } from '../js/lib/single-flight.js';

const later = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('singleFlight: 실행 중에 다시 불러도 한 번만 실행한다 (저장 버튼 두 번 누르기)', async () => {
  let runs = 0;
  const save = singleFlight(async () => { runs += 1; await later(20); return runs; });
  const [a, b] = await Promise.all([save(), save()]);
  assert.equal(runs, 1);
  assert.equal(a, 1);
  assert.equal(b, 1);
});

test('singleFlight: 끝난 뒤에는 다시 실행할 수 있다', async () => {
  let runs = 0;
  const save = singleFlight(async () => { runs += 1; });
  await save();
  await save();
  assert.equal(runs, 2);
});

test('singleFlight: 실패해도 잠금이 풀린다', async () => {
  let runs = 0;
  const save = singleFlight(async () => { runs += 1; throw new Error('fail'); });
  await assert.rejects(save(), /fail/);
  await assert.rejects(save(), /fail/);
  assert.equal(runs, 2);
});

test('singleFlight: 동기 예외도 거부된 약속으로 바꾼다', async () => {
  const save = singleFlight(() => { throw new Error('sync'); });
  await assert.rejects(save(), /sync/);
});

test('singleFlight: 인자를 그대로 넘긴다', async () => {
  const save = singleFlight(async (x, y) => x + y);
  assert.equal(await save(2, 3), 5);
});
