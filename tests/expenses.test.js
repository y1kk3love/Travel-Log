import test from 'node:test';
import assert from 'node:assert/strict';
import { toKRW, summarize, settle, invertRates, formatKRW, formatAmount } from '../js/lib/expenses.js';

const members = ['a@x.com', 'b@x.com', 'c@x.com'];
const rates = { JPY: 9 };

test('toKRW: 원화는 그대로, 외화는 환율 곱, 환율 없으면 null', () => {
  assert.equal(toKRW(1000, 'KRW', rates), 1000);
  assert.equal(toKRW(100, 'JPY', rates), 900);
  assert.equal(toKRW(10, 'USD', rates), null);
});

test('summarize: 통화별·분류별 합계와 사람별 낸 돈·부담액', () => {
  const expenses = [
    { amount: 3000, currency: 'JPY', category: 'food', date: '2026-01-01', paidBy: 'a@x.com', sharedWith: [] },          // 27,000원, 셋이 나눔
    { amount: 12000, currency: 'KRW', category: 'transport', date: '2026-01-01', paidBy: 'b@x.com', sharedWith: ['a@x.com', 'b@x.com'] },
    { amount: 5, currency: 'USD', category: 'etc', date: '2026-01-02', paidBy: 'c@x.com', sharedWith: [] },                // 환율 없음
  ];
  const s = summarize(expenses, members, rates);
  assert.equal(s.totalKRW, 39000);
  assert.deepEqual(s.byCurrency, { JPY: 3000, KRW: 12000, USD: 5 });
  assert.deepEqual(s.byCategory, { food: 27000, transport: 12000 });
  assert.deepEqual(s.byDate, { '2026-01-01': 39000 });
  assert.deepEqual(s.missingRates, ['USD']);
  assert.deepEqual(s.perPerson['a@x.com'], { paid: 27000, share: 15000, net: 12000 });
  assert.deepEqual(s.perPerson['b@x.com'], { paid: 12000, share: 15000, net: -3000 });
  assert.deepEqual(s.perPerson['c@x.com'], { paid: 0, share: 9000, net: -9000 });
});

test('settle: 덜 낸 사람이 더 낸 사람에게 보내는 송금 목록', () => {
  const per = { a: { net: 12000 }, b: { net: -3000 }, c: { net: -9000 } };
  assert.deepEqual(settle(per), [{ from: 'c', to: 'a', amountKRW: 9000 }, { from: 'b', to: 'a', amountKRW: 3000 }]);
  assert.deepEqual(settle({ a: { net: 0 }, b: { net: 0 } }), []);
});

test('invertRates / format', () => {
  assert.deepEqual(invertRates({ JPY: 0.1, USD: 0.00075, XXX: 0 }, ['KRW', 'JPY', 'USD', 'XXX']), { JPY: 10, USD: 1333.3333 });
  assert.equal(formatKRW(12345.6), '12,346원');
  assert.equal(formatAmount(3000, 'JPY'), '¥3,000');
  assert.equal(formatAmount(12.5, 'USD'), '$12.5');
  assert.equal(formatAmount(1500, 'KRW'), '1,500원');
});
