import test from 'node:test';
import assert from 'node:assert/strict';

// 앱 전용 새 버전 확인: 요청이 실패하면 "오늘 확인함" 도장을 찍지 않아 다음에 다시 시도한다
test('checkForUpdate: 릴리스 조회가 실패하면 하루 도장을 찍지 않는다', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
  globalThis.window = { Capacitor: { isNativePlatform: () => true, Plugins: { App: { getInfo: async () => ({ version: '1.0.0' }) } } } };
  globalThis.fetch = async () => ({ ok: false, status: 500 });
  const { checkForUpdate } = await import('../js/update-check.js?t=' + Date.now());
  await checkForUpdate();
  assert.equal(store.has('tl.update.checkedAt'), false);
  delete globalThis.window; delete globalThis.fetch; delete globalThis.localStorage; delete globalThis.sessionStorage;
});
