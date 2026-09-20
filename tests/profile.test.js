import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNickname, displayNameFor } from '../js/lib/profile.js';

test('normalizeNickname: 앞뒤 공백 제거, 1~20자, 아니면 null', () => {
  assert.equal(normalizeNickname('  선민 '), '선민');
  assert.equal(normalizeNickname(''), null);
  assert.equal(normalizeNickname('   '), null);
  assert.equal(normalizeNickname('가'.repeat(20)), '가'.repeat(20));
  assert.equal(normalizeNickname('가'.repeat(21)), null);
  assert.equal(normalizeNickname(null), null);
});

test('displayNameFor: 닉네임이 있으면 닉네임, 없으면 이메일 앞부분', () => {
  assert.equal(displayNameFor({ nickname: '선민' }, 'y1kk3love@gmail.com'), '선민');
  assert.equal(displayNameFor({ nickname: '' }, 'y1kk3love@gmail.com'), 'y1kk3love');
  assert.equal(displayNameFor(null, 'friend@example.com'), 'friend');
});
