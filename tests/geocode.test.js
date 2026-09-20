import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNominatim, debounce } from '../js/geocode.js';

test('parseNominatim: name/display_name/lat/lon을 정리한다', () => {
  const json = [
    { name: '伏見稲荷大社', display_name: '伏見稲荷大社, 68, 深草藪之内町, 伏見区, 京都市, 京都府, 日本', lat: '34.9671', lon: '135.7727' },
    { name: '', display_name: '니시키 시장, 나카교구, 교토시', lat: '35.0050', lon: '135.7649' },
  ];
  assert.deepEqual(parseNominatim(json), [
    { name: '伏見稲荷大社', address: '伏見稲荷大社, 68, 深草藪之内町, 伏見区, 京都市, 京都府, 日本', lat: 34.9671, lng: 135.7727 },
    { name: '니시키 시장', address: '니시키 시장, 나카교구, 교토시', lat: 35.005, lng: 135.7649 },
  ]);
});

test('parseNominatim: 배열이 아니거나 좌표가 깨지면 버린다', () => {
  assert.deepEqual(parseNominatim(null), []);
  assert.deepEqual(parseNominatim({ error: 'x' }), []);
  assert.deepEqual(parseNominatim([{ display_name: 'a', lat: 'abc', lon: '1' }]), []);
});

test('debounce: 마지막 호출만 실행된다', async () => {
  const calls = [];
  const fn = debounce((v) => calls.push(v), 20);
  fn(1); fn(2); fn(3);
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(calls, [3]);
});
