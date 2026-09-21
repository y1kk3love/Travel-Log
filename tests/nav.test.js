import test from 'node:test';
import assert from 'node:assert/strict';
import { isHomeHash } from '../js/lib/nav.js';

test('isHomeHash: 홈(#/, #, 빈 값)이면 true, 여행·공유 화면이면 false', () => {
  assert.equal(isHomeHash('#/'), true);
  assert.equal(isHomeHash('#'), true);
  assert.equal(isHomeHash(''), true);
  assert.equal(isHomeHash('#/trip/abc'), false);
  assert.equal(isHomeHash('#/share'), false);
});
