import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOverlayStack } from '../js/lib/overlays.js';

test('closeTop: 맨 나중에 연 창부터 닫고, 닫은 게 있으면 true', () => {
  const stack = createOverlayStack();
  const closed = [];
  stack.push(() => closed.push('sheet'));
  stack.push(() => closed.push('dialog'));
  assert.equal(stack.closeTop(), true);
  assert.deepEqual(closed, ['dialog']);
  assert.equal(stack.closeTop(), true);
  assert.deepEqual(closed, ['dialog', 'sheet']);
});

test('closeTop: 열린 창이 없으면 false (뒤로가기는 화면 이동으로 넘어간다)', () => {
  const stack = createOverlayStack();
  assert.equal(stack.closeTop(), false);
});

test('release: 창이 스스로 닫히면 목록에서 빠져서 다시 닫지 않는다', () => {
  const stack = createOverlayStack();
  const closed = [];
  stack.push(() => closed.push('sheet'));
  const dialog = stack.push(() => closed.push('dialog'));
  dialog.release();
  assert.equal(stack.closeTop(), true);
  assert.deepEqual(closed, ['sheet']);
  assert.equal(stack.closeTop(), false);
});

test('release 는 여러 번 불러도 다른 창을 건드리지 않는다', () => {
  const stack = createOverlayStack();
  const a = stack.push(() => {});
  stack.push(() => {});
  a.release();
  a.release();
  assert.equal(stack.size, 1);
});

test('isTop: 맨 위에 있는 창만 true (Esc 가 아래 창까지 닫지 않게)', () => {
  const stack = createOverlayStack();
  const sheet = stack.push(() => {});
  assert.equal(sheet.isTop(), true);
  const dialog = stack.push(() => {});
  assert.equal(sheet.isTop(), false);
  assert.equal(dialog.isTop(), true);
  dialog.release();
  assert.equal(sheet.isTop(), true);
});

test('closeTop 이 부른 닫기 함수가 release 를 다시 불러도 안전하다', () => {
  const stack = createOverlayStack();
  const closed = [];
  const sheet = stack.push(() => { closed.push('sheet'); sheet.release(); });
  const dialog = stack.push(() => { closed.push('dialog'); dialog.release(); });
  assert.equal(stack.closeTop(), true);
  assert.equal(stack.closeTop(), true);
  assert.deepEqual(closed, ['dialog', 'sheet']);
  assert.equal(stack.size, 0);
});
