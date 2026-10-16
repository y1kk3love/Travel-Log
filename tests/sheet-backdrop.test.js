import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// 폰에서 시트가 올라오면 뒤 화면(#app)이 살짝 작아진다. 닫힌 뒤에는 어떤 경우에도 원래대로 남아야 한다
let app, classes;
beforeEach(() => {
  app = { style: {}, isConnected: false };
  classes = new Set();
  globalThis.window = { innerWidth: 375, scrollY: 300 };
  globalThis.matchMedia = (q) => ({ matches: q.includes('max-width') }); // 폰, 움직임 줄이기 꺼짐
  globalThis.document = {
    getElementById: (id) => (id === 'app' ? app : null),
    documentElement: { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) } },
  };
  mock.timers.enable({ apis: ['setTimeout'] });
});
afterEach(() => {
  mock.timers.reset();
  delete globalThis.window; delete globalThis.matchMedia; delete globalThis.document;
});

test('시트를 끄는 도중에 닫혀도(뒤로가기·화면 이동) 남은 끌기·놓기가 뒤 화면을 다시 줄이지 않는다', async () => {
  const { sheetBackdrop } = await import('../js/motion.js');
  const backdrop = sheetBackdrop();
  backdrop.open();
  assert.match(app.style.transform, /scale/);
  assert.ok(classes.has('sheet-backdrop'));
  backdrop.drag(0.8); // 끄는 중
  backdrop.close(); // 그 사이 안드로이드 뒤로가기
  backdrop.drag(0.6); // 손가락은 아직 움직이고
  backdrop.release(1); // 놓는다
  assert.equal(app.style.transform, '');
  assert.equal(app.style.clipPath, '');
  mock.timers.tick(500);
  assert.ok(!classes.has('sheet-backdrop'), '검은 배경이 남음');
});
