import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planScheduleChange } from '../js/lib/schedule.js';

const days = [
  { id: 'd1', date: '2026-10-10', order: 0 },
  { id: 'd2', date: '2026-10-11', order: 1 },
  { id: 'd3', date: '2026-10-12', order: 2 },
];

test('시작일만 옮기면 모든 Day가 같이 밀린다', () => {
  const plan = planScheduleChange(days, '2026-11-01', '2026-11-03');
  assert.deepEqual(plan.redate, [
    { id: 'd1', date: '2026-11-01', order: 0 },
    { id: 'd2', date: '2026-11-02', order: 1 },
    { id: 'd3', date: '2026-11-03', order: 2 },
  ]);
  assert.deepEqual(plan.add, []);
  assert.deepEqual(plan.remove, []);
});

test('종료일을 늘리면 뒤에 Day가 추가된다', () => {
  const plan = planScheduleChange(days, '2026-10-10', '2026-10-14');
  assert.deepEqual(plan.redate, []);
  assert.deepEqual(plan.add, [{ date: '2026-10-13', order: 3 }, { date: '2026-10-14', order: 4 }]);
  assert.deepEqual(plan.remove, []);
});

test('종료일을 줄이면 뒤쪽 Day가 제거 대상이 된다', () => {
  const plan = planScheduleChange(days, '2026-10-10', '2026-10-10');
  assert.deepEqual(plan.remove, ['d2', 'd3']);
  assert.deepEqual(plan.add, []);
});

test('시작일과 길이를 동시에 바꾸면 밀기 + 추가/제거를 함께 계산한다', () => {
  const plan = planScheduleChange(days, '2026-10-12', '2026-10-15');
  assert.deepEqual(plan.redate.map((d) => d.date), ['2026-10-12', '2026-10-13', '2026-10-14']);
  assert.deepEqual(plan.add, [{ date: '2026-10-15', order: 3 }]);
});

test('종료일이 시작일보다 빠르면 null', () => {
  assert.equal(planScheduleChange(days, '2026-10-12', '2026-10-10'), null);
});

test('아무것도 안 바뀌면 빈 계획', () => {
  assert.deepEqual(planScheduleChange(days, '2026-10-10', '2026-10-12'), { redate: [], add: [], remove: [] });
});
