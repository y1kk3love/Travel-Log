// 지출 합계·정산 (순수 함수, 테스트 대상)
// expense: { amount, currency, category, date, paidBy(email), sharedWith([email] 비어 있으면 전원) }
// rates: { JPY: 9.1, ... } = 그 통화 1단위당 원화

export const CURRENCIES = ['KRW', 'JPY', 'TWD', 'USD', 'EUR', 'CNY', 'HKD', 'THB', 'VND', 'SGD', 'GBP'];
const CURRENCY_SYMBOL = { KRW: '원', JPY: '¥', TWD: 'NT$', USD: '$', EUR: '€', CNY: '¥', HKD: 'HK$', THB: '฿', VND: '₫', SGD: 'S$', GBP: '£' };
export const EXPENSE_CATEGORIES = { food: '식비', transport: '교통', stay: '숙소', sight: '관광', shop: '쇼핑', etc: '기타' };

export function toKRW(amount, currency, rates = {}) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  if (currency === 'KRW') return n;
  const rate = Number(rates?.[currency]);
  return Number.isFinite(rate) && rate > 0 ? n * rate : null;
}

export function formatKRW(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

export function formatAmount(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  const digits = ['KRW', 'JPY', 'VND'].includes(currency) ? 0 : 2;
  const text = n.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: digits });
  return currency === 'KRW' ? `${text}원` : `${CURRENCY_SYMBOL[currency] ?? currency}${text}`;
}

// 합계와 사람별 낸 돈·부담액. 환율이 없는 통화는 원화 합계에서 빠지고 missingRates 에 적힌다.
// 정산에는 지금 동행뿐 아니라 지출에 낸 사람·나눈 사람으로 남아 있는 사람(여행에서 빠진 동행)도 들어간다.
// 그래야 모두의 net 합이 0 이 되어 정산이 맞는다. 빠진 사람은 former 에 적힌다.
// 나누는 사람이 비어 있는 예전 지출은 지금 동행 전원이 나눈 것으로 본다.
export function summarize(expenses, members, rates = {}) {
  const byCurrency = {};
  const byCategory = {};
  const byDate = {};
  const participants = [...members];
  const seen = new Set(members);
  for (const e of expenses) {
    for (const m of [e.paidBy, ...(e.sharedWith ?? [])]) if (m && !seen.has(m)) { seen.add(m); participants.push(m); }
  }
  const former = participants.filter((m) => !members.includes(m));
  const perPerson = Object.fromEntries(participants.map((m) => [m, { paid: 0, share: 0, net: 0 }]));
  const missing = new Set();
  let totalKRW = 0;
  const moved = Object.fromEntries(participants.map((m) => [m, { sent: 0, received: 0 }])); // 사람끼리 이미 주고받은 돈
  for (const e of expenses) {
    if (isTransfer(e)) {
      // 보낸 돈 기록: 쓴 돈이 아니라 사람 사이에 오간 돈이라 총 지출·분류에는 넣지 않는다.
      // 보낸 사람은 그만큼 더 낸 것이고 받은 사람은 그만큼 덜 낸 것이 된다 (둘의 합은 그대로라 정산이 맞는다)
      const krw = toKRW(e.amount, e.currency, rates);
      if (krw == null) { missing.add(e.currency); continue; }
      const { from, to } = transferParties(e);
      if (from && to && from !== to && from in perPerson && to in perPerson) {
        perPerson[from].paid += krw; moved[from].sent += krw;
        perPerson[to].paid -= krw; moved[to].received += krw;
      }
      continue;
    }
    byCurrency[e.currency] = (byCurrency[e.currency] ?? 0) + Number(e.amount || 0);
    const krw = toKRW(e.amount, e.currency, rates);
    if (krw == null) { missing.add(e.currency); continue; }
    totalKRW += krw;
    byCategory[e.category ?? 'etc'] = (byCategory[e.category ?? 'etc'] ?? 0) + krw;
    if (e.date) byDate[e.date] = (byDate[e.date] ?? 0) + krw;
    const sharers = (e.sharedWith?.length ? e.sharedWith : members).filter((m) => m in perPerson);
    if (e.paidBy && e.paidBy in perPerson) perPerson[e.paidBy].paid += krw;
    if (sharers.length) { const each = krw / sharers.length; for (const m of sharers) perPerson[m].share += each; }
  }
  for (const m of participants) perPerson[m].net = perPerson[m].paid - perPerson[m].share;
  return { totalKRW, byCurrency, byCategory, byDate, perPerson, moved, participants, former, missingRates: [...missing] };
}

// ---- 보낸 돈 기록 ----
// 동행끼리 이미 주고받은 돈 (총무에게 미리 보낸 회비, 중간 정산 등). 지출과 같은 모음(expenses)에 category 'transfer' 로 둔다:
// paidBy = 보낸 사람, sharedWith = [받은 사람]. 이 모양은 옛 버전의 계산(보낸 사람이 내고 받은 사람 혼자 부담한 지출)으로도
// 사람별 차액이 똑같이 나와서, 앱을 아직 업데이트하지 않은 동행의 정산 결과도 어긋나지 않는다 (총 지출만 그만큼 크게 보인다).
export const TRANSFER = 'transfer';
export const isTransfer = (e) => e?.category === TRANSFER;
export function transferParties(e) {
  return { from: e?.paidBy ?? null, to: (e?.sharedWith ?? [])[0] ?? null };
}

// 보낸 돈을 적을 때 받는 사람의 기본값: 지금까지 가장 많이 받아야 하는 사람 (보통 결제를 도맡은 총무). 보내는 사람은 뺀다
export function defaultReceiver(perPerson, from, candidates) {
  const others = candidates.filter((m) => m !== from);
  if (!others.length) return null;
  return others.reduce((best, m) => ((perPerson[m]?.net ?? 0) > (perPerson[best]?.net ?? 0) ? m : best), others[0]);
}

// 정산: 덜 낸 사람(net<0)이 더 낸 사람(net>0)에게 보내는 최소 송금 목록
export function settle(perPerson) {
  const creditors = Object.entries(perPerson).filter(([, v]) => v.net > 0.5).map(([m, v]) => ({ m, left: v.net })).sort((a, b) => b.left - a.left);
  const debtors = Object.entries(perPerson).filter(([, v]) => v.net < -0.5).map(([m, v]) => ({ m, left: -v.net })).sort((a, b) => b.left - a.left);
  const transfers = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].left, creditors[j].left);
    transfers.push({ from: debtors[i].m, to: creditors[j].m, amountKRW: Math.round(amount) });
    debtors[i].left -= amount; creditors[j].left -= amount;
    if (debtors[i].left <= 0.5) i++;
    if (creditors[j].left <= 0.5) j++;
  }
  return transfers;
}

// 환율 API 응답(1 KRW 당 외화)을 "외화 1단위당 원화"로 뒤집는다
export function invertRates(perKRW, currencies = CURRENCIES) {
  const out = {};
  for (const c of currencies) {
    if (c === 'KRW') continue;
    const v = Number(perKRW?.[c]);
    if (Number.isFinite(v) && v > 0) out[c] = Number((1 / v).toFixed(4));
  }
  return out;
}
