import test from 'node:test';
import assert from 'node:assert/strict';
import { isNative, plugin, appVersion, onResume, scheduleNotifications } from '../js/native.js';

test('native: Capacitor 가 없으면(웹) 전부 조용히 no-op', async () => {
  assert.equal(isNative(), false);
  assert.equal(plugin('LocalNotifications'), null);
  assert.equal(await appVersion(), null);
  const off = onResume(() => {});
  assert.equal(typeof off, 'function');
  off();
});

test('native: Capacitor 가 있으면 registerPlugin 으로 플러그인을 얻는다', async () => {
  globalThis.window = { Capacitor: { isNativePlatform: () => true, registerPlugin: (name) => ({ name, getInfo: async () => ({ version: '1.2.3' }) }) } };
  assert.equal(isNative(), true);
  assert.equal(plugin('App').name, 'App');
  assert.equal(await appVersion(), '1.2.3');
  delete globalThis.window;
});

test('native: 알림 예약은 정확 알람을 요구하지 않는다 (권한 설정 화면으로 튕기지 않게)', async () => {
  const calls = [];
  globalThis.window = { Capacitor: { isNativePlatform: () => true, registerPlugin: (name) => ({ name, schedule: async (o) => { calls.push(o); } }) } };
  await scheduleNotifications([{ id: 7, title: '곧 출발: 센소지', body: '10:00 도착 예정', at: Date.now() + 60000, tripId: 't1', placeId: 'p1' }]);
  assert.equal(calls.length, 1);
  const n = calls[0].notifications[0];
  assert.equal(n.id, 7);
  assert.equal(n.isExactNotification, false);
  assert.deepEqual(n.extra, { tripId: 't1', placeId: 'p1' });
  delete globalThis.window;
});

test('native: 구글 로그인 실패는 삼키지 않는다 — 취소는 code auth/native-cancelled, 그 외는 원래 메시지 그대로', async () => {
  const fake = (impl) => { globalThis.window = { Capacitor: { isNativePlatform: () => true, registerPlugin: () => ({ signInWithGoogle: impl }) } }; };
  const { googleIdToken: fresh } = await import('../js/native.js?cancel=' + Date.now());
  fake(async () => { throw new Error('activity is cancelled by the user.'); });
  await assert.rejects(fresh(), (e) => e.code === 'auth/native-cancelled' && /cancelled by the user/.test(e.message));
  const { googleIdToken: fresh2 } = await import('../js/native.js?dev=' + Date.now());
  fake(async () => { throw new Error('[28444] Developer console is not set up correctly.'); });
  await assert.rejects(fresh2(), (e) => e.code === 'auth/native-failed' && /28444/.test(e.message));
  const { googleIdToken: fresh3 } = await import('../js/native.js?ok=' + Date.now());
  fake(async () => ({ credential: { idToken: 'tok' } }));
  assert.equal(await fresh3(), 'tok');
  const { googleIdToken: fresh4 } = await import('../js/native.js?none=' + Date.now());
  fake(async () => ({ user: {} }));
  await assert.rejects(fresh4(), (e) => e.code === 'auth/native-no-token');
  delete globalThis.window;
});

test('native: 구글 로그인은 Credential Manager 대신 기존 방식(useCredentialManager:false)으로 부른다', async () => {
  let opts = null;
  globalThis.window = { Capacitor: { isNativePlatform: () => true, registerPlugin: () => ({ signInWithGoogle: async (o) => { opts = o; return { credential: { idToken: 't' } }; } }) } };
  const { googleIdToken: fresh } = await import('../js/native.js?legacy=' + Date.now());
  assert.equal(await fresh(), 't');
  assert.deepEqual(opts, { useCredentialManager: false });
  delete globalThis.window;
});
