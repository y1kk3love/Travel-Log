import test from 'node:test';
import assert from 'node:assert/strict';
import { stampLabel } from '../js/lib/stamp.js';

test('stampLabel: 여권 도장 글자 — 제목의 첫 도시와 시작 연월', () => {
  assert.deepEqual(stampLabel({ title: '후쿠오카 · 벳푸 · 유후인', startDate: '2025-01-11' }), { city: '후쿠오카', date: '2025.01' });
  assert.deepEqual(stampLabel({ title: '강릉 · 속초', startDate: '2025-06-01' }), { city: '강릉', date: '2025.06' });
  assert.deepEqual(stampLabel({ title: '삿포로·도쿄·오사카', startDate: '2024-02-22' }), { city: '삿포로', date: '2024.02' });
  assert.deepEqual(stampLabel({ title: '이멤버리멤버 · 오사카', startDate: '2023-04-28' }), { city: '이멤버리멤버', date: '2023.04' });
  assert.deepEqual(stampLabel({ title: '', startDate: '2023-04-28' }), { city: '여행', date: '2023.04' });
});
