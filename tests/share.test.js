import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedTextFrom, shareFromQuery } from '../js/lib/share.js';

test('sharedTextFrom: 제목·설명·URL 을 합쳐 한 텍스트로 (중복·빈 값 제거)', () => {
  assert.equal(sharedTextFrom({ title: '센소지 · 도쿄', url: 'https://maps.app.goo.gl/abc', type: 'text/plain' }), '센소지 · 도쿄\nhttps://maps.app.goo.gl/abc');
  assert.equal(sharedTextFrom({ title: 'https://maps.app.goo.gl/abc', url: 'https://maps.app.goo.gl/abc' }), 'https://maps.app.goo.gl/abc');
  assert.equal(sharedTextFrom({ description: '35.71, 139.79' }), '35.71, 139.79');
});

test('sharedTextFrom: 텍스트가 아니거나 비어 있으면 null', () => {
  assert.equal(sharedTextFrom(null), null);
  assert.equal(sharedTextFrom({ type: 'image/jpeg', url: 'content://x' }), null);
  assert.equal(sharedTextFrom({ title: '   ' }), null);
});

test('shareFromQuery: 웹앱 공유 대상(Web Share Target)으로 받은 주소 파라미터를 공유 텍스트로', () => {
  assert.equal(shareFromQuery('?title=%EC%84%BC%EC%86%8C%EC%A7%80&text=&url=https%3A%2F%2Fmaps.app.goo.gl%2Fabc'), '센소지\nhttps://maps.app.goo.gl/abc');
  assert.equal(shareFromQuery('?text=%EC%84%BC%EC%86%8C%EC%A7%80%20https%3A%2F%2Fmaps.app.goo.gl%2Fabc'), '센소지 https://maps.app.goo.gl/abc');
  assert.equal(shareFromQuery('?r=1'), null);
  assert.equal(shareFromQuery(''), null);
});
