import { test } from 'node:test';
import assert from 'node:assert/strict';
import { easeOutCubic, tween, createSeen, touchedRecently, staggerIndex, slideDir, countFrames } from '../js/lib/motion.js';

test('easeOutCubic / tween: 처음엔 빠르고 끝에서 천천히, 범위 밖은 끝값으로', () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.ok(easeOutCubic(0.5) > 0.8); // 절반 시간에 87.5% — 토스식 숫자 세기
  assert.equal(easeOutCubic(-1), 0);
  assert.equal(easeOutCubic(2), 1);
  assert.equal(tween(10, 20, 1), 20);
  assert.equal(tween(10, 20, 0), 10);
});

test('countFrames: 여러 숫자를 이전 값에서 새 값으로, 정수로 센다 (마지막은 정확히 새 값)', () => {
  assert.deepEqual(countFrames([0, 0], [4, 6], 0), [0, 0]);
  assert.deepEqual(countFrames([0, 0], [4, 6], 1), [4, 6]);
  assert.deepEqual(countFrames([10], [20], 0.5), [19]); // 10 + 10 × 0.875 → 18.75 → 반올림
  assert.deepEqual(countFrames([], [3], 0.5), [3]); // 이전 값이 없던 칸은 새 값 그대로
});

test('createSeen: 처음 그릴 때는 전부, 다시 그릴 때는 새로 생긴 것만 등장 (순서·지난 시간)', () => {
  const seen = createSeen(700);
  assert.deepEqual([...seen.plan('home', ['a', 'b'], 0)], [['a', { order: 0, elapsed: 0 }], ['b', { order: 1, elapsed: 0 }]]);
  // 데이터가 몇 ms 뒤 또 와서 다시 그려져도(Firestore 스냅숏 여러 개) 등장하던 항목은 이어서 움직인다
  assert.deepEqual([...seen.plan('home', ['a', 'b'], 120)], [['a', { order: 0, elapsed: 120 }], ['b', { order: 1, elapsed: 120 }]]);
  // 한참 뒤 다시 그리면 움직이지 않고, 새로 생긴 것만 (그 묶음에서 0번부터)
  assert.deepEqual([...seen.plan('home', ['b', 'c', 'a'], 5000)], [['c', { order: 0, elapsed: 0 }]]);
  assert.deepEqual([...seen.plan('other', ['a'], 5000)], [['a', { order: 0, elapsed: 0 }]]); // 화면(범위)마다 따로
  seen.forget('home');
  assert.deepEqual([...seen.plan('home', ['a'], 6000)].map(([k]) => k), ['a']); // 화면을 떠났다 오면 다시 등장
});

test('createSeen.silent: 다른 움직임(Day 밀기)을 쓸 때는 등장시키지 않고 기억만 한다', () => {
  const seen = createSeen(700);
  seen.silent('planner', ['x', 'y'], 0);
  assert.deepEqual([...seen.plan('planner', ['x', 'y'], 50)], []);
  assert.deepEqual([...seen.plan('planner', ['x', 'y', 'z'], 60)].map(([k]) => k), ['z']);
});

test('touchedRecently: 방금 내가 누른 항목만 (다시 그려져도 체크 애니메이션이 한 번만)', () => {
  const touched = new Map([['x', 1000]]);
  assert.equal(touchedRecently(touched, 'x', 1500), true);
  assert.equal(touchedRecently(touched, 'x', 3000), false);
  assert.equal(touchedRecently(touched, 'y', 1500), false);
});

test('staggerIndex / slideDir: 차례 등장은 10번째에서 멈추고, Day 이동 방향', () => {
  assert.equal(staggerIndex(3), 3);
  assert.equal(staggerIndex(40), 10);
  assert.equal(slideDir(0, 2), 1);
  assert.equal(slideDir(3, 1), -1);
  assert.equal(slideDir(1, 1), 0);
  assert.equal(slideDir(-1, 2), 0); // 이전 Day 를 모르면 밀지 않는다
});
