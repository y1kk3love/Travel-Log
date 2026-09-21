import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedTextFrom } from '../js/lib/share.js';

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
