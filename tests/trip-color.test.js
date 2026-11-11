import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverHue } from '../js/lib/trip-color.js';

test('coverHue: 같은 여행은 늘 같은 색조, 0~359', () => {
  assert.equal(coverHue('h9Yot3iMekBIEXiXjGlT'), coverHue('h9Yot3iMekBIEXiXjGlT'));
  for (const id of ['T1', 'T2', 'lqnQUKWoQ2cbDUaVSSRx', '']) {
    const h = coverHue(id);
    assert.ok(Number.isInteger(h) && h >= 0 && h < 360, `${id} → ${h}`);
  }
  assert.notEqual(coverHue('T1'), coverHue('T2'));
});
