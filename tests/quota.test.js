import test from 'node:test';
import assert from 'node:assert/strict';
import { isQuotaError, quotaResetLabel } from '../js/lib/quota.js';

test('isQuotaError: 429·RESOURCE_EXHAUSTED·quota 문구는 한도 초과로 본다', () => {
  assert.equal(isQuotaError(new Error('routes 429')), true);
  assert.equal(isQuotaError({ code: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' }), true);
  assert.equal(isQuotaError('OVER_QUERY_LIMIT'), true);
  assert.equal(isQuotaError(429), true);
});

test('isQuotaError: 다른 오류는 아니다', () => {
  assert.equal(isQuotaError(new Error('routes 403')), false);
  assert.equal(isQuotaError(new TypeError('Failed to fetch')), false);
  assert.equal(isQuotaError(null), false);
  assert.equal(isQuotaError(404), false);
});

test('quotaResetLabel: 서머타임이면 오후 4시, 아니면 오후 5시', () => {
  assert.equal(quotaResetLabel(new Date('2026-07-01T12:00:00Z')), '한국 시간 오후 4시');
  assert.equal(quotaResetLabel(new Date('2026-01-15T12:00:00Z')), '한국 시간 오후 5시');
});
