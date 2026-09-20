import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitWithin, nextQuality } from '../js/lib/image.js';

test('fitWithin: 긴 변이 최대치를 넘으면 비율을 유지해 줄인다', () => {
  assert.deepEqual(fitWithin(4000, 3000, 1280), { width: 1280, height: 960 });
  assert.deepEqual(fitWithin(3000, 4000, 1280), { width: 960, height: 1280 });
});

test('fitWithin: 작은 사진은 키우지 않는다', () => {
  assert.deepEqual(fitWithin(800, 600, 1280), { width: 800, height: 600 });
});

test('fitWithin: 결과는 정수이고 최소 1px', () => {
  assert.deepEqual(fitWithin(1281, 1, 1280), { width: 1280, height: 1 });
});

test('nextQuality: 0.85에서 시작해 0.1씩 내리고 0.4 아래로는 내려가지 않는다', () => {
  assert.equal(nextQuality(null), 0.85);
  assert.equal(nextQuality(0.85), 0.75);
  assert.equal(nextQuality(0.45), 0.4);
  assert.equal(nextQuality(0.4), null);
});
