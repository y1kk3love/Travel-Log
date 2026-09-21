import test from 'node:test';
import assert from 'node:assert/strict';
import { isNative, plugin, appVersion, onResume } from '../js/native.js';

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
