import test from 'node:test';
import assert from 'node:assert/strict';
import { isQuotaError, quotaResetLabel, sameQuotaDay } from '../js/lib/quota.js';

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

test('sameQuotaDay: 한도는 미국 태평양 시간 하루 단위라 그 날짜가 같을 때만 같은 날', () => {
  // 2026-09-23 은 서머타임(PDT, UTC-7). 07:00Z 가 태평양 자정
  assert.equal(sameQuotaDay(Date.parse('2026-09-23T08:00:00Z'), Date.parse('2026-09-23T20:00:00Z')), true);
  assert.equal(sameQuotaDay(Date.parse('2026-09-23T06:59:00Z'), Date.parse('2026-09-23T07:01:00Z')), false);
  assert.equal(sameQuotaDay(Date.parse('2026-09-23T08:00:00Z'), Date.parse('2026-09-24T08:00:00Z')), false);
});
