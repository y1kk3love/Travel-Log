import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, toDateStr, addDays, diffDays, dayList, weekdayKo, formatShort, formatRange, tripStatus, formatStatus } from '../js/lib/dates.js';

test('parseDate/toDateStr 왕복', () => {
  assert.equal(toDateStr(parseDate('2026-10-10')), '2026-10-10');
  assert.equal(parseDate('2026-10-10').getHours(), 0);
});

test('addDays와 diffDays', () => {
  assert.equal(addDays('2026-10-30', 3), '2026-11-02');
  assert.equal(diffDays('2026-10-10', '2026-10-14'), 4);
  assert.equal(diffDays('2026-10-14', '2026-10-10'), -4);
});

test('dayList는 시작~종료 날짜를 order와 함께 돌려준다', () => {
  assert.deepEqual(dayList('2026-10-10', '2026-10-12'), [
    { date: '2026-10-10', order: 0 },
    { date: '2026-10-11', order: 1 },
    { date: '2026-10-12', order: 2 },
  ]);
  assert.deepEqual(dayList('2026-10-10', '2026-10-10'), [{ date: '2026-10-10', order: 0 }]);
});

test('dayList는 종료일이 시작일보다 빠르면 빈 배열', () => {
  assert.deepEqual(dayList('2026-10-14', '2026-10-10'), []);
});

test('weekdayKo와 formatShort', () => {
  assert.equal(weekdayKo('2026-10-10'), '토');
  assert.equal(formatShort('2026-10-10'), '10.10 (토)');
});

test('formatRange', () => {
  assert.equal(formatRange('2026-10-10', '2026-10-14'), '2026.10.10 – 10.14 · 4박 5일');
  assert.equal(formatRange('2026-12-30', '2027-01-02'), '2026.12.30 – 2027.01.02 · 3박 4일');
});

test('tripStatus: 여행 전 / 여행 중 / 지난 여행', () => {
  assert.deepEqual(tripStatus('2026-10-10', '2026-10-14', '2026-09-20'), { kind: 'before', days: 20 });
  assert.deepEqual(tripStatus('2026-10-10', '2026-10-14', '2026-10-10'), { kind: 'during', days: 0 });
  assert.deepEqual(tripStatus('2026-10-10', '2026-10-14', '2026-10-12'), { kind: 'during', days: 2 });
  assert.deepEqual(tripStatus('2026-10-10', '2026-10-14', '2026-10-20'), { kind: 'after', days: 6 });
});

test('formatStatus', () => {
  assert.equal(formatStatus({ kind: 'before', days: 20 }), 'D-20');
  assert.equal(formatStatus({ kind: 'during', days: 0 }), 'D-Day');
  assert.equal(formatStatus({ kind: 'during', days: 2 }), '여행 중');
  assert.equal(formatStatus({ kind: 'after', days: 6 }), '지난 여행');
});
