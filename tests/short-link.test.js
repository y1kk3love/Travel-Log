import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveShortLink, relayResolver, isShortMapsLink, isGoogleMapsUrl } from '../js/lib/short-link.js';

const SHORT = 'https://maps.app.goo.gl/oE5XvMgAL6gmk2q89';
const LONG = 'https://www.google.com/maps/place/%EC%B0%BD%EB%B9%88/data=!4m4!3m3!1s0x357ca1c42a786c85:0x686e3406375f7ddd';

test('isShortMapsLink / isGoogleMapsUrl: 구글 짧은 지도 링크와 긴 구글 지도 주소만', () => {
  assert.equal(isShortMapsLink(SHORT), true);
  assert.equal(isShortMapsLink(`${SHORT}?g_st=ac`), true);
  assert.equal(isShortMapsLink('https://goo.gl/maps/abc'), true);
  assert.equal(isShortMapsLink('https://example.com/abc'), false);
  assert.equal(isShortMapsLink('http://maps.app.goo.gl/abc'), false);
  assert.equal(isGoogleMapsUrl(LONG), true);
  assert.equal(isGoogleMapsUrl('https://www.google.co.in/maps/place/X'), true);
  assert.equal(isGoogleMapsUrl('https://evil.example/maps/place/X'), false);
  assert.equal(isGoogleMapsUrl('intent://maps.app.goo.gl/x#Intent;end'), false);
  assert.equal(isGoogleMapsUrl(null), false);
});

test('resolveShortLink: 앱(네이티브) → 웹 중계 순서로, 구글 지도 주소가 나오면 멈춘다', async () => {
  const calls = [];
  const native = async (u) => { calls.push(['native', u]); return null; }; // 웹에서는 null
  const relay = async (u) => { calls.push(['relay', u]); return LONG; };
  assert.equal(await resolveShortLink(SHORT, [native, relay]), LONG);
  assert.deepEqual(calls, [['native', SHORT], ['relay', SHORT]]);

  calls.length = 0;
  const nativeOk = async (u) => { calls.push(['native', u]); return LONG; };
  assert.equal(await resolveShortLink(SHORT, [nativeOk, relay]), LONG);
  assert.deepEqual(calls, [['native', SHORT]]); // 앱에서 되면 중계는 부르지 않는다
});

test('resolveShortLink: 실패·이상한 주소는 건너뛰고, 짧은 링크가 아니면 아무것도 부르지 않는다', async () => {
  const boom = async () => { throw new Error('offline'); };
  const evil = async () => 'https://evil.example/maps';
  assert.equal(await resolveShortLink(SHORT, [boom, evil]), null);
  let called = false;
  assert.equal(await resolveShortLink('https://example.com/x', [async () => { called = true; return LONG; }]), null);
  assert.equal(called, false);
});

test('relayResolver: 중계 주소에 url 을 붙여 GET 하고 { url } 을 받는다. 주소가 없으면 null', async () => {
  const requests = [];
  const fakeFetch = async (href, opts) => { requests.push([href, !!opts?.signal]); return { ok: true, json: async () => ({ url: LONG }) }; };
  const resolve = relayResolver('https://script.google.com/macros/s/ABC/exec', fakeFetch);
  assert.equal(await resolve(SHORT), LONG);
  assert.deepEqual(requests, [[`https://script.google.com/macros/s/ABC/exec?url=${encodeURIComponent(SHORT)}`, true]]);
  assert.equal(await relayResolver('', fakeFetch)(SHORT), null);
  const notOk = relayResolver('https://script.google.com/macros/s/ABC/exec', async () => ({ ok: false, json: async () => ({}) }));
  assert.equal(await notOk(SHORT), null);
});
