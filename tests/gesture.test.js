import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rubberBand, velocity, shouldDismiss, swipeOut, resist, stackLayout, createCountdown, liftAbove } from '../js/lib/gesture.js';

test('rubberBand: 경계 밖으로 끌면 처음엔 따라오다 점점 무거워지고 한계(80px)를 넘지 않는다 (iOS 고무줄)', () => {
  assert.equal(rubberBand(0), 0);
  const a = rubberBand(-20), b = rubberBand(-100), c = rubberBand(-1000);
  assert.ok(a < 0 && a > -20); // 따라오되 덜
  assert.ok(Math.abs(b) > Math.abs(a) && Math.abs(c) > Math.abs(b)); // 더 끌면 더 가지만
  assert.ok(Math.abs(c) < 80); // 한계를 넘지 않는다
  assert.equal(rubberBand(30), -rubberBand(-30)); // 방향 대칭
});

test('velocity: 최근 100ms 움직임으로 속도(px/ms), 오래전 움직임은 빼고 본다', () => {
  assert.equal(velocity([]), 0);
  assert.equal(velocity([{ t: 0, y: 0 }]), 0);
  assert.equal(velocity([{ t: 0, y: 0 }, { t: 50, y: 25 }, { t: 100, y: 50 }]), 0.5);
  // 천천히 끌다가 마지막에 휙: 최근 100ms 만 본다
  assert.equal(velocity([{ t: 0, y: 0 }, { t: 900, y: 40 }, { t: 1000, y: 100 }]), 0.6);
});

test('velocity: 빠르게 끌다가 멈춘 채 누르고 있다 놓으면 속도는 0 (놓은 시각까지 본다)', () => {
  const samples = [{ t: 0, y: 0 }, { t: 50, y: 40 }];
  assert.equal(velocity(samples, 100, 1050), 0); // 1초 멈췄다 놓음 → 튕긴 게 아니다
  assert.equal(velocity(samples, 100, 60), 0.8); // 움직이며 바로 놓음 → 그대로
});

test('liftAbove: 아래 시트가 열려 있으면 알림을 시트 아래 버튼 줄 위로 띄운다 (가려서 저장을 못 누르지 않게)', () => {
  assert.equal(liftAbove(null, 812), null); // 시트가 없으면 원래 자리
  assert.equal(liftAbove(730, 812), 94); // 버튼 줄 위쪽(730) 위로 12px
  assert.equal(liftAbove(800, 812), null); // 원래 자리(28px)로도 가리지 않으면 그대로
  assert.equal(liftAbove(900, 812), null); // 화면 밖이면 그대로
});

test('shouldDismiss: 시트 높이의 25% 넘게 끌었거나 아래로 빠르게(0.4px/ms) 튕기면 닫는다 (Vaul)', () => {
  assert.equal(shouldDismiss({ distance: 120, velocity: 0, size: 400 }), true); // 30%
  assert.equal(shouldDismiss({ distance: 60, velocity: 0.1, size: 400 }), false); // 15%, 느림 → 제자리
  assert.equal(shouldDismiss({ distance: 40, velocity: 0.8, size: 400 }), true); // 짧아도 휙
  assert.equal(shouldDismiss({ distance: 4, velocity: 2, size: 400 }), false); // 탭 수준 흔들림은 무시
  assert.equal(shouldDismiss({ distance: -50, velocity: -1, size: 400 }), false); // 위로는 닫지 않는다
});

test('swipeOut / resist: 알림은 좌우·아래로 45px 또는 빠르게(0.11px/ms) 밀면 닫고, 위로는 저항 (Sonner)', () => {
  assert.equal(swipeOut({ dx: 60, dy: 5, vx: 0, vy: 0 }), 'right');
  assert.equal(swipeOut({ dx: -20, dy: 2, vx: -0.3, vy: 0 }), 'left');
  assert.equal(swipeOut({ dx: 3, dy: 50, vx: 0, vy: 0 }), 'down');
  assert.equal(swipeOut({ dx: 10, dy: 3, vx: 0.05, vy: 0 }), null); // 조금만 밀면 제자리
  assert.equal(swipeOut({ dx: 2, dy: -60, vx: 0, vy: -1 }), null); // 위로는 닫지 않는다
  assert.ok(resist(-40) > -40 && resist(-40) < 0);
  assert.ok(Math.abs(resist(-400)) < 20 + 0.001); // 아무리 끌어도 20px 남짓
});

test('stackLayout: 최신 알림이 맨 앞, 뒤로 두 개가 12px씩 비치며 작아지고 넷째부터 숨는다. 펼치면 높이대로 늘어선다', () => {
  assert.deepEqual(stackLayout([40, 40, 40, 40]), [
    { y: 0, scale: 1, opacity: 1 },
    { y: -12, scale: 0.95, opacity: 1 },
    { y: -24, scale: 0.9, opacity: 1 },
    { y: -36, scale: 0.85, opacity: 0 },
  ]);
  assert.deepEqual(stackLayout([40, 60, 40], { expanded: true }), [
    { y: 0, scale: 1, opacity: 1 },
    { y: -48, scale: 1, opacity: 1 },
    { y: -116, scale: 1, opacity: 1 },
  ]);
});

test('createCountdown: 알림 타이머는 멈췄다 이어 가며, 남은 시간만큼만 더 기다린다', () => {
  const timers = [];
  const setT = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  const clearT = (id) => { timers[id - 1].cleared = true; };
  let done = 0;
  const cd = createCountdown(3000, () => { done += 1; }, { setTimer: setT, clearTimer: clearT });
  cd.start(0);
  assert.equal(timers[0].ms, 3000);
  cd.pause(1000); // 마우스를 올림 → 2000ms 남음
  assert.equal(timers[0].cleared, true);
  cd.pause(1500); // 두 번 멈춰도 그대로
  cd.resume(5000); // 한참 뒤에 이어도 남은 2000ms 만
  assert.equal(timers[1].ms, 2000);
  timers[1].fn();
  assert.equal(done, 1);
});
