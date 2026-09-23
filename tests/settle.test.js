import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settleSoon, preferWithin } from '../js/lib/settle.js';

const later = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
const failLater = (ms, message) => new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));

test('settleSoon: 서버가 빨리 확인하면 saved', async () => {
  assert.equal(await settleSoon(later(5), { ms: 50 }), 'saved');
});

test('settleSoon: 서버 확인이 늦으면(오프라인) 기다리지 않고 queued', async () => {
  const started = Date.now();
  assert.equal(await settleSoon(later(300), { ms: 30 }), 'queued');
  assert.ok(Date.now() - started < 250);
});

test('settleSoon: 빨리 실패하면 호출한 쪽에 그대로 던진다', async () => {
  await assert.rejects(settleSoon(failLater(5, 'permission-denied'), { ms: 50 }), /permission-denied/);
});

test('settleSoon: 넘어간 뒤에 실패하면 onLateError 로 알린다 (처리되지 않은 거부 없음)', async () => {
  const late = [];
  const result = await settleSoon(failLater(60, 'denied-later'), { ms: 10, onLateError: (err) => late.push(err.message) });
  assert.equal(result, 'queued');
  await later(80);
  assert.deepEqual(late, ['denied-later']);
});

test('preferWithin: 먼저 온 서버 결과를 쓴다', async () => {
  let fallbackCalled = false;
  const v = await preferWithin(later(5, 'server'), () => { fallbackCalled = true; return Promise.resolve('cache'); }, 50);
  assert.equal(v, 'server');
  assert.equal(fallbackCalled, false);
});

test('preferWithin: 서버가 늦으면 캐시 결과로 넘어간다', async () => {
  const v = await preferWithin(later(300, 'server'), () => Promise.resolve('cache'), 20);
  assert.equal(v, 'cache');
});

test('preferWithin: 서버가 실패하면 캐시 결과로 넘어간다', async () => {
  const v = await preferWithin(failLater(5, 'offline'), () => Promise.resolve('cache'), 50);
  assert.equal(v, 'cache');
});

test('preferWithin: 캐시도 실패하면 그 오류를 던진다', async () => {
  await assert.rejects(preferWithin(later(300, 'server'), () => Promise.reject(new Error('no-cache')), 20), /no-cache/);
});
