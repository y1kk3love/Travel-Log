import { el, clear, toast, confirmDialog, openModal, icon, linkedText, onSubmit } from '../ui.js';
import { watchTrip, watchExpenses, addExpense, updateExpense, deleteExpense, setTripRates, getProfiles } from '../db.js';
import { CURRENCIES, EXPENSE_CATEGORIES, summarize, settle, toKRW, formatKRW, formatAmount } from '../lib/expenses.js';
import { fetchKrwRates } from '../rates.js';
import { displayNameFor } from '../lib/profile.js';
import { formatShort, toDateStr } from '../lib/dates.js';
import { auth } from '../firebase.js';

// 지출 탭: 손으로 적는 가계부 + 동행 정산. 결제 수단 연동 없음.
export function mount(content, ctx) {
  const { tripId } = ctx;
  const state = { trip: ctx.trip ?? null, expenses: [], profiles: {}, ratesFetched: false };
  const main = el('main', { class: 'container expenses-page' });
  content.append(main);
  const redraw = () => draw(main, tripId, state);
  // 닉네임: 지금 동행과, 지출에 낸 사람·나눈 사람으로 남은 나간 동행까지 (없는 사람만 한 번 더 읽는다)
  const asked = new Set();
  const loadProfiles = () => {
    const emails = [...(state.trip?.memberEmails ?? []), ...state.expenses.flatMap((e) => [e.paidBy, ...(e.sharedWith ?? [])])]
      .filter((m) => m && !asked.has(m));
    if (!emails.length) return;
    emails.forEach((m) => asked.add(m));
    getProfiles([...new Set(emails)]).then((p) => { Object.assign(state.profiles, p); redraw(); });
  };
  const unsubs = [
    watchTrip(tripId, (trip) => {
      if (!trip) return;
      state.trip = trip;
      loadProfiles();
      redraw();
      ensureRates(tripId, state);
    }),
    watchExpenses(tripId, (list) => { state.expenses = list; loadProfiles(); redraw(); ensureRates(tripId, state); },
      (err) => { console.error(err); toast('지출을 불러오지 못했어요', { kind: 'error' }); }),
  ];
  return () => unsubs.forEach((u) => u());
}

// 쓰인 외화 중 환율이 없는 통화가 있으면 한 번 받아 여행에 저장한다 (사용자가 나중에 고칠 수 있다)
async function ensureRates(tripId, state) {
  if (!state.trip || state.ratesFetched) return;
  const used = [...new Set(state.expenses.map((e) => e.currency).filter((c) => c && c !== 'KRW'))];
  const missing = used.filter((c) => !(state.trip.rates?.[c] > 0));
  if (!missing.length) return;
  state.ratesFetched = true;
  const fetched = await fetchKrwRates();
  if (!fetched) return;
  const rates = { ...(state.trip.rates ?? {}) };
  for (const c of missing) if (fetched[c]) rates[c] = fetched[c];
  await setTripRates(tripId, rates).catch((err) => console.warn('환율 저장 실패', err));
}

function nameOf(state, email) {
  return displayNameFor(state.profiles[email], email);
}

function draw(main, tripId, state) {
  clear(main);
  const trip = state.trip;
  if (!trip) return;
  const members = trip.memberEmails ?? [];
  const rates = trip.rates ?? {};
  const s = summarize(state.expenses, members, rates);
  const perHead = members.length ? s.totalKRW / members.length : s.totalKRW;

  main.append(el('div', { class: 'page-head' },
    el('div', {}, el('h2', { class: 'checklist-title', text: '지출' }), el('p', { class: 'muted', text: `${state.expenses.length}건` })),
    el('button', { class: 'btn', onClick: () => openDialog(tripId, state) }, icon('plus'), '지출 추가')));

  // 요약
  main.append(el('section', { class: 'card expense-summary' },
    stat('총 지출', formatKRW(s.totalKRW)),
    members.length > 1 ? stat('1인당', formatKRW(perHead)) : null,
    ...Object.entries(s.byCurrency).filter(([c]) => c !== 'KRW').map(([c, v]) => stat(`${c} 합계`, formatAmount(v, c))),
    el('div', { class: 'stat' }, el('span', { class: 'muted', text: '분류별' }),
      el('div', { class: 'expense-chips' }, ...Object.entries(s.byCategory).sort((a, b) => b[1] - a[1])
        .map(([k, v]) => el('span', { class: 'tag', text: `${EXPENSE_CATEGORIES[k] ?? k} ${formatKRW(v)}` }))))));

  // 환율 (쓰인 외화만)
  const used = [...new Set(state.expenses.map((e) => e.currency).filter((c) => c && c !== 'KRW'))];
  if (used.length) {
    main.append(el('section', { class: 'card expense-rates' },
      el('span', { class: 'muted', text: '환율 (외화 1단위당 원화)' }),
      ...used.map((c) => {
        const input = el('input', { class: 'input', type: 'number', step: '0.0001', min: '0', value: rates[c] ?? '', placeholder: '직접 입력', 'aria-label': `${c} 환율` });
        input.addEventListener('change', async () => {
          const v = Number(input.value);
          if (!(v > 0)) return;
          await setTripRates(tripId, { ...rates, [c]: v }).catch((err) => { console.error(err); toast('환율을 저장하지 못했어요', { kind: 'error' }); });
        });
        return el('label', { class: 'expense-rate' }, `1 ${c} =`, input, '원');
      }),
      s.missingRates.length ? el('span', { class: 'muted', text: `${s.missingRates.join(', ')} 환율이 없어 원화 합계에서 빠졌어요` }) : null));
  }

  // 정산: 영수증 종이 모양 (위아래 뜯긴 자국, 점선 이음줄, 고정폭 금액)
  if (members.length > 1 || s.former.length) {
    const transfers = settle(s.perPerson);
    const who = (m) => `${nameOf(state, m)}${s.former.includes(m) ? ' (나간 동행)' : ''}`;
    const row = (label, value, cls = '') => el('div', { class: `receipt-row ${cls}` },
      el('span', { class: 'receipt-label', text: label }), el('span', { class: 'receipt-dots' }), el('span', { class: 'receipt-amount', text: value }));
    main.append(el('section', { class: 'card receipt' },
      el('div', { class: 'receipt-head' },
        el('div', { class: 'receipt-title', text: '정산 영수증' }),
        el('div', { class: 'muted', text: `${state.trip?.title ?? ''} · ${members.length}명` })),
      el('div', { class: 'receipt-section' },
        ...s.participants.map((m) => row(who(m), `낸 돈 ${formatKRW(s.perPerson[m].paid)} · 부담 ${formatKRW(s.perPerson[m].share)}`))),
      el('div', { class: 'receipt-sep' }),
      el('div', { class: 'receipt-section' },
        ...(transfers.length
          ? transfers.map((t) => row(`${who(t.from)} → ${who(t.to)}`, formatKRW(t.amountKRW), 'receipt-transfer'))
          : [el('p', { class: 'muted receipt-note', text: state.expenses.length ? '정산할 금액이 없어요' : '지출을 적으면 누가 누구에게 얼마를 보내면 되는지 나와요' })])),
      el('div', { class: 'receipt-sep' }),
      el('div', { class: 'receipt-section' },
        row('총 지출', formatKRW(s.totalKRW), 'receipt-total'),
        row('1인당', formatKRW(perHead))),
      el('div', { class: 'receipt-foot', text: '★ 즐거운 여행 되세요 ★' })));
  }

  // 날짜별 목록 (최근 날짜부터)
  const byDate = new Map();
  for (const e of [...state.expenses].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')) || (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))) {
    const key = e.date ?? '';
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(e);
  }
  if (!state.expenses.length) {
    main.append(el('p', { class: 'muted expense-empty', text: '식비, 교통비, 입장료를 적어 두면 여행 경비 합계와 동행 정산이 자동으로 계산돼요.' }));
    return;
  }
  for (const [date, list] of byDate) {
    const dayTotal = list.reduce((sum, e) => sum + (toKRW(e.amount, e.currency, rates) ?? 0), 0);
    main.append(el('section', { class: 'expense-day' },
      el('div', { class: 'expense-day-head' }, el('strong', { text: date ? formatShort(date) : '날짜 없음' }), el('span', { class: 'muted', text: formatKRW(dayTotal) })),
      ...list.map((e) => row(tripId, state, e, rates))));
  }
}

function stat(label, value) {
  return el('div', { class: 'stat' }, el('span', { class: 'muted', text: label }), el('strong', { text: value }));
}

function row(tripId, state, e, rates) {
  const krw = toKRW(e.amount, e.currency, rates);
  return el('div', { class: 'expense-row' },
    el('button', { class: 'tl-body', onClick: () => openDialog(tripId, state, e) },
      el('div', { class: 'tl-meta' }, el('span', { class: 'tag', text: EXPENSE_CATEGORIES[e.category] ?? '기타' }),
        e.paidBy && el('span', { class: 'muted', text: `${nameOf(state, e.paidBy)} 결제` })),
      el('div', { class: 'tl-name', text: e.title || '(제목 없음)' }),
      e.note && el('div', { class: 'muted tl-memo' }, linkedText(e.note, { firstLineOnly: true }))),
    el('div', { class: 'expense-amount' },
      el('strong', { text: formatAmount(e.amount, e.currency) }),
      e.currency !== 'KRW' ? el('span', { class: 'muted', text: krw == null ? '환율 없음' : `≈ ${formatKRW(krw)}` }) : null));
}

function openDialog(tripId, state, existing = null) {
  const trip = state.trip;
  const members = trip.memberEmails ?? [];
  const me = (auth.currentUser?.email ?? '').toLowerCase();
  const title = el('input', { class: 'input', id: 'ex-title', value: existing?.title ?? '', required: true, placeholder: '예: 이치란 라멘' });
  const amount = el('input', { class: 'input', id: 'ex-amount', type: 'number', step: 'any', min: '0', inputmode: 'decimal', value: existing?.amount ?? '', required: true, placeholder: '금액' });
  const lastCurrency = state.expenses[0]?.currency ?? 'KRW';
  const currency = el('select', { class: 'input', id: 'ex-currency' },
    ...CURRENCIES.map((c) => el('option', { value: c, selected: (existing?.currency ?? lastCurrency) === c, text: c })));
  const inTrip = toDateStr(new Date()) >= trip.startDate && toDateStr(new Date()) <= trip.endDate;
  const date = el('input', { class: 'input', id: 'ex-date', type: 'date', value: existing?.date ?? (inTrip ? toDateStr(new Date()) : trip.startDate) });
  // 이 지출에 낸 사람·나눈 사람으로 남은 나간 동행도 목록에 둔다 (편집하다가 조용히 빠지지 않게)
  const people = [...new Set([...members, ...(existing?.paidBy ? [existing.paidBy] : []), ...(existing?.sharedWith ?? [])])];
  const paidBy = el('select', { class: 'input', id: 'ex-paidby' },
    ...people.map((m) => el('option', { value: m, selected: (existing?.paidBy ?? me) === m, text: displayNameFor(state.profiles[m], m) })));
  const note = el('textarea', { class: 'input', id: 'ex-note', rows: '2', placeholder: '메모 (선택)' });
  note.value = existing?.note ?? '';
  let category = existing?.category ?? 'food';
  const chips = el('div', { class: 'chips' });
  const drawChips = () => chips.replaceChildren(...Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => el('button', {
    type: 'button', class: `chip${category === k ? ' active' : ''}`, onClick: () => { category = k; drawChips(); },
  }, v)));
  drawChips();
  const shareBoxes = people.map((m) => {
    const box = el('input', { type: 'checkbox', value: m, checked: existing?.sharedWith?.length ? existing.sharedWith.includes(m) : members.includes(m) });
    return el('label', {}, box, displayNameFor(state.profiles[m], m));
  });

  const dialog = el('dialog', {});
  const form = el('form', { method: 'dialog' },
    el('h2', { text: existing ? '지출 편집' : '지출 추가' }),
    el('div', { class: 'dialog-body' },
      el('div', { class: 'field' }, el('label', { for: 'ex-title', text: '내용' }), title),
      el('div', { class: 'form-grid' },
        el('div', { class: 'field' }, el('label', { for: 'ex-amount', text: '금액' }), amount),
        el('div', { class: 'field' }, el('label', { for: 'ex-currency', text: '통화' }), currency)),
      el('div', { class: 'field' }, el('label', { text: '분류' }), chips),
      el('div', { class: 'form-grid' },
        el('div', { class: 'field' }, el('label', { for: 'ex-date', text: '날짜' }), date),
        people.length > 1 ? el('div', { class: 'field' }, el('label', { for: 'ex-paidby', text: '낸 사람' }), paidBy) : null),
      people.length > 1 ? el('div', { class: 'field' }, el('label', { text: '나누는 사람' }), el('div', { class: 'share-list' }, ...shareBoxes)) : null,
      el('div', { class: 'field' }, el('label', { for: 'ex-note', text: '메모' }), note)),
    el('div', { class: 'dialog-actions' },
      existing ? el('button', {
        type: 'button', class: 'btn btn-danger',
        onClick: async () => {
          if (!(await confirmDialog(`'${existing.title}' 지출을 삭제할까요?`))) return;
          try { await deleteExpense(tripId, existing.id); dialog.close(); } catch (err) { console.error(err); toast('삭제하지 못했어요', { kind: 'error' }); }
        },
      }, '삭제') : null,
      el('button', { type: 'button', class: 'btn', onClick: () => dialog.close() }, '취소'),
      el('button', { type: 'submit', class: 'btn btn-primary' }, existing ? '저장' : '추가')));
  onSubmit(form, async (e) => { // 저장 중 연타 막기
    e.preventDefault();
    const sharedWith = shareBoxes.map((l) => l.querySelector('input')).filter((b) => b.checked).map((b) => b.value);
    const data = {
      title: title.value.trim(), amount: Number(amount.value), currency: currency.value, category,
      date: date.value || null, paidBy: people.length > 1 ? paidBy.value : (members[0] ?? me),
      sharedWith, note: note.value, // 항상 명시해 둔다 (비워 두면 '그때 동행 전원'이 아니라 '지금 동행 전원'이 되어 나중에 합류한 사람까지 나눠 낸다)
    };
    if (!data.title) { toast('내용을 입력해 주세요', { kind: 'error' }); title.focus(); return; }
    if (!(data.amount > 0)) { toast('금액을 입력해 주세요', { kind: 'error' }); amount.focus(); return; }
    if (people.length > 1 && !sharedWith.length) { toast('나누는 사람을 한 명 이상 골라 주세요', { kind: 'error' }); return; }
    try {
      if (existing) await updateExpense(tripId, existing.id, data); else await addExpense(tripId, data);
      dialog.close();
    } catch (err) { console.error(err); toast('저장하지 못했어요', { kind: 'error' }); }
  });
  dialog.append(form); openModal(dialog); title.focus();
}
