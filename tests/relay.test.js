import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// relay/maps-link.gs (Google Apps Script 웹 앱)를 가짜 UrlFetchApp·CacheService·ContentService 로 돌려 본다
function loadRelay(fetchPlan) {
  const fetched = [];
  const store = new Map();
  const context = {
    UrlFetchApp: {
      fetch(url, opts) {
        fetched.push([url, opts]);
        const step = fetchPlan[url];
        if (step instanceof Error) throw step;
        return { getResponseCode: () => step?.code ?? 404, getAllHeaders: () => (step?.location ? { Location: step.location } : {}) };
      },
    },
    CacheService: { getScriptCache: () => ({ get: (k) => store.get(k) ?? null, put: (k, v) => store.set(k, v) }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('relay/maps-link.gs', 'utf8'), context);
  const get = (url) => JSON.parse(context.doGet({ parameter: { url } }).text);
  return { get, fetched, store };
}

const SHORT = 'https://maps.app.goo.gl/oE5XvMgAL6gmk2q89';
const LONG = 'https://www.google.com/maps/place/%EC%B0%BD%EB%B9%88/data=!4m4!3m3!1s0x357ca1c42a786c85:0x686e3406375f7ddd?entry=tts';

test('relay: 짧은 링크의 Location 을 따라가 긴 구글 지도 주소를 돌려준다 (자동 따라가기 끔)', () => {
  const r = loadRelay({ [SHORT]: { code: 302, location: LONG } });
  assert.deepEqual(r.get(SHORT), { url: LONG });
  assert.equal(r.fetched.length, 1);
  assert.equal(r.fetched[0][1].followRedirects, false);
  assert.deepEqual(r.get(SHORT), { url: LONG }); // 두 번째는 캐시
  assert.equal(r.fetched.length, 1);
});

test('relay: 구글 짧은 링크가 아니면 요청하지 않고, 구글 지도가 아닌 곳으로 가면 null', () => {
  const r = loadRelay({ 'https://maps.app.goo.gl/evil': { code: 302, location: 'https://evil.example/x' } });
  assert.deepEqual(r.get('https://example.com/x'), { url: null });
  assert.deepEqual(r.get(''), { url: null });
  assert.equal(r.fetched.length, 0);
  assert.deepEqual(r.get('https://maps.app.goo.gl/evil'), { url: null });
  assert.equal(r.fetched.length, 1); // 구글이 아닌 주소는 따라가지 않는다
});

test('relay: 요청이 실패하면 null 이고 캐시에 남기지 않는다 (다음에 다시 시도)', () => {
  const r = loadRelay({ [SHORT]: new Error('timeout') });
  assert.deepEqual(r.get(SHORT), { url: null });
  assert.equal(r.store.size, 0);
});
