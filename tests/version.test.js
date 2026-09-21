import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVersion, isNewer, pickApk } from '../js/lib/version.js';

test('parseVersion / isNewer: 숫자 비교 (1.10.0 > 1.9.0), v 접두어 허용', () => {
  assert.deepEqual(parseVersion('v1.2.3'), [1, 2, 3]);
  assert.deepEqual(parseVersion('1.2'), [1, 2, 0]);
  assert.equal(parseVersion('abc'), null);
  assert.equal(isNewer('v1.10.0', '1.9.0'), true);
  assert.equal(isNewer('1.9.0', 'v1.10.0'), false);
  assert.equal(isNewer('1.0.0', '1.0.0'), false);
  assert.equal(isNewer('x', '1.0.0'), false);
});

test('pickApk: 릴리스 자산에서 .apk 를 고른다', () => {
  assert.equal(pickApk([{ name: 'notes.txt', browser_download_url: 'a' }, { name: 'travel-log-1.0.0.apk', browser_download_url: 'b' }]), 'b');
  assert.equal(pickApk([]), null);
});
