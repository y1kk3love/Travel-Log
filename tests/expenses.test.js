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

test('summarize: 동행에서 빠진 사람이 낸 돈도 정산에 남는다 (합이 0 이 되게)', () => {
  const members = ['a@x.com', 'b@x.com']; // c 는 여행에서 빠짐
  const expenses = [
    { amount: 30000, currency: 'KRW', paidBy: 'c@x.com', sharedWith: ['a@x.com', 'b@x.com', 'c@x.com'] },
  ];
  const s = summarize(expenses, members, {});
  assert.deepEqual(s.participants, ['a@x.com', 'b@x.com', 'c@x.com']);
  assert.deepEqual(s.former, ['c@x.com']);
  assert.deepEqual(s.perPerson['c@x.com'], { paid: 30000, share: 10000, net: 20000 });
  assert.deepEqual(s.perPerson['a@x.com'], { paid: 0, share: 10000, net: -10000 });
  const sum = Object.values(s.perPerson).reduce((t, p) => t + p.net, 0);
  assert.equal(Math.round(sum), 0);
  assert.equal(settle(s.perPerson).length, 2); // a·b 가 c 에게 보낸다
});

test('summarize: 나누는 사람이 비어 있는 예전 지출은 지금 동행 전원이 나눈다', () => {
  const s = summarize([{ amount: 9000, currency: 'KRW', paidBy: 'a@x.com', sharedWith: [] }], ['a@x.com', 'b@x.com', 'c@x.com'], {});
  assert.equal(s.perPerson['b@x.com'].share, 3000);
  assert.deepEqual(s.former, []);
});

test('summarize: 동행이 아닌 사람이 나누는 사람에만 있어도 부담액을 받는다', () => {
  const s = summarize([{ amount: 10000, currency: 'KRW', paidBy: 'a@x.com', sharedWith: ['a@x.com', 'gone@x.com'] }], ['a@x.com'], {});
  assert.deepEqual(s.perPerson['gone@x.com'], { paid: 0, share: 5000, net: -5000 });
  assert.deepEqual(s.former, ['gone@x.com']);
});

test('보낸 돈 기록: 보낸 사람은 그만큼 더 낸 것, 받은 사람은 덜 낸 것. 총 지출·분류에는 들어가지 않는다', async () => {
  const { isTransfer, TRANSFER } = await import('../js/lib/expenses.js');
  const members = ['a@x.com', 'b@x.com', 'c@x.com'];
  const expenses = [
    { amount: 300000, currency: 'KRW', category: 'stay', date: '2027-02-13', paidBy: 'a@x.com', sharedWith: members }, // 총무 a 가 숙소 결제
    { amount: 100000, currency: 'KRW', category: TRANSFER, date: '2027-01-10', paidBy: 'b@x.com', sharedWith: ['a@x.com'] }, // b 가 a 에게 미리 보냄
  ];
  assert.equal(isTransfer(expenses[1]), true);
  const s = summarize(expenses, members, {});
  assert.equal(s.totalKRW, 300000);
  assert.deepEqual(s.byCategory, { stay: 300000 });
  assert.deepEqual(s.byDate, { '2027-02-13': 300000 });
  assert.deepEqual(s.byCurrency, { KRW: 300000 });
  assert.deepEqual(s.perPerson['a@x.com'], { paid: 200000, share: 100000, net: 100000 });
  assert.deepEqual(s.perPerson['b@x.com'], { paid: 100000, share: 100000, net: 0 }); // 이미 다 냈다
  assert.deepEqual(s.perPerson['c@x.com'], { paid: 0, share: 100000, net: -100000 });
  assert.deepEqual(s.moved['b@x.com'], { sent: 100000, received: 0 });
  assert.deepEqual(s.moved['a@x.com'], { sent: 0, received: 100000 });
  assert.deepEqual(settle(s.perPerson), [{ from: 'c@x.com', to: 'a@x.com', amountKRW: 100000 }]); // 남은 건 c 뿐
});

test('보낸 돈 기록: 옛 버전의 계산(받은 사람 혼자 부담한 지출)으로도 사람별 차액이 같다', async () => {
  const { TRANSFER } = await import('../js/lib/expenses.js');
  const members = ['a@x.com', 'b@x.com'];
  const base = { amount: 50000, currency: 'KRW', paidBy: 'b@x.com', sharedWith: ['a@x.com'] };
  const now = summarize([{ ...base, category: TRANSFER }], members, {});
  const old = summarize([{ ...base, category: 'etc' }], members, {});
  for (const m of members) assert.equal(now.perPerson[m].net, old.perPerson[m].net);
});

test('보낸 돈 기록: 외화는 환율로 바꾸고, 환율이 없으면 빠진 통화로 알린다. 받는 사람이 없거나 자기 자신이면 무시한다', async () => {
  const { TRANSFER } = await import('../js/lib/expenses.js');
  const members = ['a@x.com', 'b@x.com'];
  const t = (extra) => ({ amount: 1000, currency: 'JPY', category: TRANSFER, paidBy: 'b@x.com', sharedWith: ['a@x.com'], ...extra });
  assert.equal(summarize([t()], members, { JPY: 9 }).perPerson['b@x.com'].paid, 9000);
  assert.deepEqual(summarize([t()], members, {}).missingRates, ['JPY']);
  assert.equal(summarize([t({ sharedWith: [] })], members, { JPY: 9 }).perPerson['b@x.com'].paid, 0);
  assert.equal(summarize([t({ sharedWith: ['b@x.com'] })], members, { JPY: 9 }).perPerson['b@x.com'].paid, 0);
});

test('defaultReceiver: 가장 많이 받아야 하는 사람(보통 총무), 보내는 사람은 빼고', async () => {
  const { defaultReceiver } = await import('../js/lib/expenses.js');
  const perPerson = { 'a@x.com': { net: 200000 }, 'b@x.com': { net: -100000 }, 'c@x.com': { net: -100000 } };
  const all = ['a@x.com', 'b@x.com', 'c@x.com'];
  assert.equal(defaultReceiver(perPerson, 'b@x.com', all), 'a@x.com');
  assert.equal(defaultReceiver(perPerson, 'a@x.com', all), 'b@x.com'); // 총무 자신이 보낼 때는 다른 사람 중에서
  assert.equal(defaultReceiver(perPerson, 'a@x.com', ['a@x.com']), null);
});
