import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVersion, isNewer, pickApk, latestApk } from '../js/lib/version.js';

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

test('latestApk: 릴리스에서 APK 주소와 버전을 뽑고, APK 가 없으면 릴리스 페이지로', () => {
  const rel = { tag_name: 'v1.0.2', html_url: 'https://github.com/y1kk3love/Travel-Log/releases/tag/v1.0.2', assets: [{ name: 'travel-log-1.0.2.apk', browser_download_url: 'https://x/travel-log-1.0.2.apk' }] };
  assert.deepEqual(latestApk(rel), { url: 'https://x/travel-log-1.0.2.apk', version: 'v1.0.2' });
  assert.deepEqual(latestApk({ tag_name: 'v2.0.0', html_url: 'https://rel', assets: [] }), { url: 'https://rel', version: 'v2.0.0' });
  assert.equal(latestApk(null), null);
  assert.equal(latestApk({ assets: [] }), null);
});
