import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleNotifications } from '../js/native.js';

// 플러그인 프록시는 모듈 안에 캐시되므로, 테스트마다 모듈을 새로 불러 순서에 의존하지 않게 한다
const fresh = () => import('../js/native.js?t=' + Math.random());

test('native: Capacitor 가 없으면(웹) 전부 조용히 no-op', async () => {
  delete globalThis.window;
  const m = await fresh();
  assert.equal(m.isNative(), false);
  assert.equal(m.plugin('LocalNotifications'), null);
  assert.equal(await m.appVersion(), null);
  const off = m.onResume(() => {});
  assert.equal(typeof off, 'function');
  off();
});

test('native: Capacitor 가 있으면 registerPlugin 으로 플러그인을 얻는다', async () => {
  globalThis.window = { Capacitor: { isNativePlatform: () => true, registerPlugin: (name) => ({ name, getInfo: async () => ({ version: '1.2.3' }) }) } };
  const m = await fresh();
  assert.equal(m.isNative(), true);
  assert.equal(m.plugin('App').name, 'App');
  assert.equal(await m.appVersion(), '1.2.3');
  delete globalThis.window;
});

test('native: 정확 알람 권한이 없으면(또는 확인할 수 없으면) 정확 알람을 요구하지 않는다 (권한 설정 화면으로 튕기지 않게)', async () => {
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

test('native: 정확 알람이 허용돼 있으면(USE_EXACT_ALARM) 출발 알림을 제시간에 울린다', async () => {
  const calls = [];
  globalThis.window = { Capacitor: { isNativePlatform: () => true, registerPlugin: (name) => ({
    name, schedule: async (o) => { calls.push(o); }, checkExactNotificationSetting: async () => ({ exact_alarm: 'granted' }),
  }) } };
  const m = await fresh();
  await m.scheduleNotifications([{ id: 8, title: 't', body: 'b', at: Date.now() + 60000, tripId: 't1', placeId: 'p2' }]);
  assert.equal(calls[0].notifications[0].isExactNotification, true);
  delete globalThis.window;
});

test('native: 정확 알람이 거부돼 있으면 정확 알람을 요구하지 않는다', async () => {
  const calls = [];
  globalThis.window = { Capacitor: { isNativePlatform: () => true, registerPlugin: (name) => ({
    name, schedule: async (o) => { calls.push(o); }, checkExactNotificationSetting: async () => ({ exact_alarm: 'denied' }),
  }) } };
  const m = await fresh();
  await m.scheduleNotifications([{ id: 9, title: 't', body: 'b', at: Date.now() + 60000, tripId: 't1', placeId: 'p3' }]);
  assert.equal(calls[0].notifications[0].isExactNotification, false);
  delete globalThis.window;
});

test('native: 구글 로그인 실패는 삼키지 않는다 — 취소는 code auth/native-cancelled, 그 외는 원래 메시지 그대로', async () => {
  const fake = (impl) => { globalThis.window = { Capacitor: { isNativePlatform: () => true, registerPlugin: () => ({ signInWithGoogle: impl }) } }; };
  const { googleIdToken: login1 } = await fresh();
  fake(async () => { throw new Error('activity is cancelled by the user.'); });
  await assert.rejects(login1(), (e) => e.code === 'auth/native-cancelled' && /cancelled by the user/.test(e.message));
  const { googleIdToken: login2 } = await fresh();
  fake(async () => { throw new Error('[28444] Developer console is not set up correctly.'); });
  await assert.rejects(login2(), (e) => e.code === 'auth/native-failed' && /28444/.test(e.message));
  const { googleIdToken: login3 } = await fresh();
  fake(async () => ({ credential: { idToken: 'tok' } }));
  assert.equal(await login3(), 'tok');
  const { googleIdToken: login4 } = await fresh();
  fake(async () => ({ user: {} }));
  await assert.rejects(login4(), (e) => e.code === 'auth/native-no-token');
  delete globalThis.window;
});

test('native: 구글 로그인은 Credential Manager 대신 기존 방식(useCredentialManager:false)으로 부른다', async () => {
  let opts = null;
  globalThis.window = { Capacitor: { isNativePlatform: () => true, registerPlugin: () => ({ signInWithGoogle: async (o) => { opts = o; return { credential: { idToken: 't' } }; } }) } };
  const { googleIdToken: login } = await fresh();
  assert.equal(await login(), 't');
  assert.deepEqual(opts, { useCredentialManager: false });
  delete globalThis.window;
});

test('native: registerPlugin 이 없으면(안드로이드 주입 런타임) Capacitor.Plugins.<이름> 프록시를 쓴다', async () => {
  const appProxy = { getInfo: async () => ({ version: '2.0.0' }) };
  globalThis.window = { Capacitor: { isNativePlatform: () => true, Plugins: { App: appProxy } } };
  const mod = await fresh();
  assert.equal(mod.isNative(), true);
  assert.equal(mod.plugin('App'), appProxy);
  assert.equal(await mod.appVersion(), '2.0.0');
  assert.equal(mod.plugin('FirebaseAuthentication'), null, '없는 플러그인은 null');
  delete globalThis.window;
});

test('native: 공유 텍스트는 앱 자체 플러그인 ShareIntent.take 에서 받는다 (title+url → 한 텍스트)', async () => {
  let taken = 0;
  globalThis.window = { Capacitor: { isNativePlatform: () => true, Plugins: { ShareIntent: { take: async () => { taken++; return { type: 'text/plain', title: '센소지', url: 'https://maps.app.goo.gl/x' }; } } } } };
  const m = await fresh();
  assert.equal(await m.takeSharedText(), '센소지\nhttps://maps.app.goo.gl/x');
  assert.equal(taken, 1);
  delete globalThis.window;
});

test('native: takeSharedText 는 공유가 없으면 null (빈 결과·플러그인 없음)', async () => {
  globalThis.window = { Capacitor: { isNativePlatform: () => true, Plugins: { ShareIntent: { take: async () => ({}) } } } };
  const m = await fresh();
  assert.equal(await m.takeSharedText(), null);
  delete globalThis.window;
  const w = await fresh();
  assert.equal(await w.takeSharedText(), null);
});

test('native: onBackButton 은 App.backButton 리스너, exitApp 은 App.exitApp — 웹에서는 no-op', async () => {
  const calls = [];
  globalThis.window = { Capacitor: { isNativePlatform: () => true, Plugins: { App: {
    addListener: (ev, cb) => { calls.push(['listen', ev]); cb({ canGoBack: false }); return { remove: () => calls.push(['remove', ev]) }; },
    exitApp: async () => { calls.push(['exit']); },
  } } } };
  const m = await fresh();
  let got = null;
  const off = m.onBackButton((e) => { got = e; });
  assert.deepEqual(got, { canGoBack: false });
  await m.exitApp();
  off();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(calls, [['listen', 'backButton'], ['exit'], ['remove', 'backButton']]);
  delete globalThis.window;
  const w = await fresh();
  assert.equal(typeof w.onBackButton(() => {}), 'function');
  await w.exitApp();
});

test('native: 알림 권한은 한 번만 묻는다 (거절하면 앱으로 돌아올 때마다 다시 묻지 않게)', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  let asked = 0;
  globalThis.window = { Capacitor: { isNativePlatform: () => true, registerPlugin: (name) => ({
    name, checkPermissions: async () => ({ display: 'prompt-with-rationale' }), requestPermissions: async () => { asked += 1; return { display: 'denied' }; },
  }) } };
  const m = await fresh();
  assert.equal(await m.notificationPermission(), 'denied');
  assert.equal(await m.notificationPermission(), 'denied');
  assert.equal(asked, 1);
  delete globalThis.window;
  delete globalThis.localStorage;
});

test('native: 이미 허용돼 있으면 묻지 않고 granted', async () => {
  let asked = 0;
  globalThis.window = { Capacitor: { isNativePlatform: () => true, registerPlugin: (name) => ({
    name, checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => { asked += 1; return { display: 'granted' }; },
  }) } };
  const m = await fresh();
  assert.equal(await m.notificationPermission(), 'granted');
  assert.equal(asked, 0);
  delete globalThis.window;
});

test('native: 권한 요청이 실패하면 물어본 것으로 치지 않는다 (다음에 다시 묻는다)', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  let asked = 0;
  globalThis.window = { Capacitor: { isNativePlatform: () => true, registerPlugin: (name) => ({
    name, checkPermissions: async () => ({ display: 'prompt' }),
    requestPermissions: async () => { asked += 1; if (asked === 1) throw new Error('activity gone'); return { display: 'granted' }; },
  }) } };
  const m = await fresh();
  assert.equal(await m.notificationPermission(), 'unavailable');
  assert.equal(await m.notificationPermission(), 'granted');
  assert.equal(asked, 2);
  delete globalThis.window;
  delete globalThis.localStorage;
});

test('native: 메뉴의 "알림 켜기"(ask) 는 한 번 물은 뒤에도 다시 묻는다', async () => {
  const store = new Map([['tl.notif.asked', '1']]);
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  let asked = 0;
  globalThis.window = { Capacitor: { isNativePlatform: () => true, registerPlugin: (name) => ({
    name, checkPermissions: async () => ({ display: 'prompt-with-rationale' }), requestPermissions: async () => { asked += 1; return { display: 'granted' }; },
  }) } };
  const m = await fresh();
  assert.equal(await m.notificationPermission(), 'denied'); // 앱이 알아서 다시 묻지는 않는다
  assert.equal(await m.notificationPermission({ ask: true }), 'granted');
  assert.equal(asked, 1);
  delete globalThis.window;
  delete globalThis.localStorage;
});

test('native: 짧은 지도 링크는 앱(ShareIntent.resolveLink)이 따라가 긴 주소를 준다 — 웹·실패·다른 링크는 null', async () => {
  const calls = [];
  globalThis.window = { Capacitor: { isNativePlatform: () => true, Plugins: { ShareIntent: {
    resolveLink: async ({ url }) => { calls.push(url); return { url: 'https://www.google.com/maps/place/X/data=!4m2!3m1!1s0x1:0x2' }; },
  } } } };
  const m = await fresh();
  assert.equal(await m.resolveMapsLink('https://maps.app.goo.gl/abc'), 'https://www.google.com/maps/place/X/data=!4m2!3m1!1s0x1:0x2');
  assert.equal(await m.resolveMapsLink('https://example.com/abc'), null); // 짧은 지도 링크가 아니면 부르지 않는다
  assert.deepEqual(calls, ['https://maps.app.goo.gl/abc']);
  globalThis.window.Capacitor.Plugins.ShareIntent.resolveLink = async () => { throw new Error('not implemented'); }; // 예전 앱
  assert.equal(await (await fresh()).resolveMapsLink('https://maps.app.goo.gl/abc'), null);
  globalThis.window.Capacitor.Plugins.ShareIntent.resolveLink = async () => ({ url: 'https://evil.example/maps' }); // 구글 지도가 아닌 곳
  assert.equal(await (await fresh()).resolveMapsLink('https://maps.app.goo.gl/abc'), null);
  delete globalThis.window;
  assert.equal(await (await fresh()).resolveMapsLink('https://maps.app.goo.gl/abc'), null); // 웹
});

test('native: shareText 는 앱이면 안드로이드 공유 창(ShareIntent.shareText)을 열고 true, 웹·예전 앱은 false', async () => {
  const calls = [];
  globalThis.window = { Capacitor: { isNativePlatform: () => true, Plugins: { ShareIntent: { shareText: async (o) => { calls.push(o); return {}; } } } } };
  const m = await fresh();
  assert.equal(await m.shareText({ title: 't', text: 'x' }), true);
  assert.deepEqual(calls, [{ title: 't', text: 'x' }]);
  globalThis.window.Capacitor.Plugins.ShareIntent.shareText = async () => { throw new Error('not implemented'); };
  assert.equal(await (await fresh()).shareText({ title: 't', text: 'x' }), false);
  delete globalThis.window;
  assert.equal(await (await fresh()).shareText({ title: 't', text: 'x' }), false);
});
