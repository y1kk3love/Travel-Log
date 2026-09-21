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
