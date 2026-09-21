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

test('checkForUpdate: 마지막 확인이 30분 넘었으면 다시 조회해 새 버전 배너를 띄운다 (하루 1회면 같은 날 릴리스를 놓친다)', async () => {
  const store = new Map([['tl.update.checkedAt', String(Date.now() - 31 * 60 * 1000)]]);
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  globalThis.sessionStorage = { getItem: () => null, setItem: () => {} };
  globalThis.window = { Capacitor: { isNativePlatform: () => true, Plugins: { App: { getInfo: async () => ({ version: '1.1.1' }) } } } };
  let fetched = 0;
  globalThis.fetch = async () => { fetched++; return { ok: true, json: async () => ({ tag_name: 'v1.1.2', html_url: 'https://rel', assets: [{ name: 'travel-log-1.1.2.apk', browser_download_url: 'https://apk' }] }) }; };
  const banners = [];
  // el() 이 쓰는 최소한의 DOM 흉내
  const fakeNode = () => ({ children: [], append(...c) { this.children.push(...c); }, setAttribute() {}, addEventListener() {}, remove() {}, style: {}, dataset: {} });
  globalThis.document = { body: { prepend: (n) => banners.push(n) }, createElement: fakeNode, createTextNode: (t) => t, querySelector: () => (banners[0] ?? null) };
  globalThis.Node = function Node() {}; // el() 의 instanceof Node 검사용
  const { checkForUpdate } = await import('../js/update-check.js?t2=' + Date.now());
  await checkForUpdate();
  assert.equal(fetched, 1);
  assert.equal(banners.length, 1);
  // 10분 뒤 다시 불리면 조회하지 않는다
  await checkForUpdate();
  assert.equal(fetched, 1);
  delete globalThis.window; delete globalThis.fetch; delete globalThis.localStorage; delete globalThis.sessionStorage; delete globalThis.document; delete globalThis.Node;
});
