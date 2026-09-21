import { el, clear, toast, confirmDialog, openModal, icon, linkedText, openLightbox } from '../ui.js';
import {
  watchReservations, addReservation, updateReservation, deleteReservation, watchPlaces, watchDays,
  addReservationFile, getReservationFile, deleteReservationFile, FILE_MAX_BYTES, addPlace, updatePlace,
} from '../db.js';
import { parseFlightNumber, airlineName, flightradarUrl, parseRoute, airportCode, flightDuration, airportSuggestions, flightTitle } from '../lib/flight.js';
import { placesFromReservation } from '../lib/reservation-place.js';
import { orderForTime } from '../lib/order.js';
import { compressImage } from '../photo.js';

const FILE_ACCEPT = 'image/*,application/pdf';
const formatSize = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

const TYPE_LABELS = { flight: '항공', stay: '숙소', food: '식당', etc: '기타' };

export function mount(content, ctx) {
  const { tripId } = ctx;
  // 일정에서 넘어온 예약: 강조는 다시 그릴 때마다 유지하고, 스크롤은 처음 한 번만
  const state = { reservations: [], places: [], days: [], focusId: ctx.reservationId ?? null, scrolled: false };
  const main = el('main', { class: 'container reservations-page' });
  content.append(main);
  const redraw = () => {
    draw(main, tripId, state);
    const target = state.focusId && main.querySelector(`.reservation[data-id="${state.focusId}"]`);
    if (!target) return;
    target.classList.add('active');
    if (!state.scrolled) { state.scrolled = true; target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  };
  const unsubs = [
    watchReservations(tripId, (r) => { state.reservations = r; redraw(); }, (err) => { console.error(err); toast('예약을 불러오지 못했어요', { kind: 'error' }); }),
    watchPlaces(tripId, (p) => { state.places = p; redraw(); }),
    watchDays(tripId, (d) => { state.days = d; redraw(); }),
  ];
  return () => unsubs.forEach((u) => u());
}

function placeLabel(state, placeId) {
  const place = state.places.find((p) => p.id === placeId);
  if (!place) return null;
  if (place.dayId == null) return `보관함 · ${place.name}`;
  const dayIndex = state.days.findIndex((d) => d.id === place.dayId);
  if (dayIndex < 0) return null; // days 스냅샷이 아직 안 온 첫 렌더에서 "Day 0"을 찍지 않는다
  const order = state.places.filter((p) => p.dayId === place.dayId).findIndex((p) => p.id === place.id);
  return `Day ${dayIndex + 1} · ${order + 1}번 ${place.name}`;
}

function formatDatetime(str) {
  if (!str) return '일시 미정';
  const [d, t] = str.split('T');
  const [, m, day] = d.split('-');
  return `${m}.${day}${t ? ` ${t}` : ''}`;
}

function draw(main, tripId, state) {
  clear(main);
  const sorted = [...state.reservations].sort((a, b) => String(a.datetime ?? '9').localeCompare(String(b.datetime ?? '9')));
  main.append(
    el('div', { class: 'page-head' },
      el('div', {}, el('h2', { class: 'checklist-title', text: '예약' }), el('p', { class: 'muted', text: `${sorted.length}건` })),
      el('button', { class: 'btn', onClick: () => openDialog(tripId, state) }, icon('plus'), '예약 추가')),
    el('div', { class: 'reservation-list' }, ...sorted.map((r) => card(tripId, state, r))),
    ...(sorted.length === 0 ? [el('p', { class: 'muted', text: '항공, 숙소, 식당 예약을 적어 두면 여행 중에 바로 찾을 수 있어요.' })] : []));
}

function card(tripId, state, r) {
  // 연결된 일정: 여러 개(숙소 기간)면 전부, 하나면 그것
  const linkedIds = [...new Set([...(r.linkedPlaceIds ?? []), ...(r.linkedPlaceId ? [r.linkedPlaceId] : [])])];
  const linkedEls = linkedIds.map((id) => ({ id, label: placeLabel(state, id) })).filter((x) => x.label)
    .map((x, i) => [i ? ' · ' : null, el('a', { href: `#/trip/${tripId}/planner/${x.id}`, class: 'link-accent', text: x.label })]);
  const linked = linkedEls.length ? el('span', {}, ...linkedEls.flat()) : null;
  const actions = () => [
    el('button', { class: 'btn btn-icon btn-sm', 'aria-label': '편집', onClick: () => openDialog(tripId, state, r) }, icon('edit')),
    el('button', {
      class: 'btn btn-icon btn-sm', 'aria-label': '삭제',
      onClick: async () => {
        if (!(await confirmDialog(`'${r.title}' 예약을 삭제할까요?`))) return;
        await deleteReservation(tripId, r.id).catch((err) => { console.error(err); toast('삭제하지 못했어요', { kind: 'error' }); });
      },
    }, icon('trash')),
  ];
  if (r.type === 'flight') return ticketCard(tripId, r, linked, actions);
  return el('section', { class: 'card reservation', dataset: { id: r.id } },
    el('div', { class: 'reservation-head' },
      el('div', { class: 'reservation-title' },
        el('span', { class: 'badge badge-muted', text: TYPE_LABELS[r.type] ?? '기타' }),
        el('strong', { text: r.title || '(제목 없음)' })),
      el('div', {},
        el('span', { class: 'muted', text: r.checkout ? `${formatDatetime(r.datetime)} → ${formatDatetime(r.checkout)}` : formatDatetime(r.datetime) }),
        ...actions())),
    el('div', { class: 'reservation-grid' },
      ...(r.flightNumber ? [field('편명', el('span', {},
        `${airlineName(parseFlightNumber(r.flightNumber)?.airline) ?? ''} ${r.flightNumber} · `.replace(/^ /, ''),
        el('a', { href: flightradarUrl(r.flightNumber), target: '_blank', rel: 'noopener', class: 'link-accent', text: 'Flightradar24에서 보기' })))] : []),
      field('예약번호', r.code ? el('code', { text: r.code }) : el('span', { class: 'muted', text: '없음' })),
      field('메모', r.note ? el('span', { class: 'pre-wrap' }, linkedText(r.note)) : '—'),
      field('연결된 일정', linked ?? '없음'),
      field('서류', filesField(tripId, r))));
}

// 항공 예약은 탑승권 모양: 위에 색 띠(탑승권·항공사·편명), 본문에 공항 코드와 시각, 아래 줄에 편명·예약번호·비행 시간·연결 일정.
// 스텁(폰은 아래, 넓은 화면은 오른쪽)에 항공사 띠와 메모·Flightradar·서류. 공항 코드는 제목의 "인천 → 후쿠오카" 에서.
function ticketCard(tripId, r, linked, actions) {
  const flight = parseFlightNumber(r.flightNumber);
  // 공항: 정식 칸(출발·도착 공항)을 먼저, 없으면 옛 예약처럼 제목의 "인천 → 후쿠오카" 에서
  const route = r.fromAirport || r.toAirport ? { from: r.fromAirport || null, to: r.toAirport || null } : parseRoute(r.title);
  const airline = airlineName(flight?.airline);
  const timeOf = (dt) => (dt ? String(dt).slice(11, 16) : null);
  const dateOf = (dt) => (dt ? formatDatetime(dt).split(' ')[0] : '');
  const endpoint = (city, dt, label, align) => el('div', { class: `ticket-end ${align}` },
    el('div', { class: 'ticket-k', text: label }),
    el('div', { class: `ticket-code${airportCode(city) ? '' : ' ticket-code-text'}`, text: airportCode(city) ?? (city || '—') }),
    el('div', { class: 'ticket-city', text: airportCode(city) && city ? city : '' }),
    el('div', { class: `ticket-time${dt ? '' : ' muted'}`, text: dt ? `${dateOf(dt)} ${timeOf(dt)}` : '시각 미정' }));
  const duration = flightDuration(r.datetime, r.arrival);
  const cell = (k, v) => el('div', { class: 'ticket-cell' }, el('div', { class: 'ticket-k', text: k }), el('div', { class: 'ticket-v' }, v));
  return el('section', { class: 'card reservation ticket', dataset: { id: r.id } },
    el('div', { class: 'ticket-main' },
      el('div', { class: 'ticket-band' },
        el('span', { class: 'ticket-band-title' }, icon('pin'), '탑승권'),
        el('span', { class: 'ticket-band-right' },
          el('span', { text: flight ? `${airline ?? ''} ${flight.iata}`.trim() : (r.title || '(제목 없음)') }),
          ...actions())),
      el('div', { class: 'ticket-body' },
        el('div', { class: 'ticket-route' },
          endpoint(route?.from, r.datetime, '출발', 'from'),
          el('div', { class: 'ticket-plane' }, el('span', { class: 'ticket-line' }), el('span', { class: 'muted', text: duration ?? '' })),
          endpoint(route?.to, r.arrival, '도착', 'to')),
        !route ? el('p', { class: 'muted ps-hint', text: '편집에서 출발·도착 공항을 넣으면 공항 코드가 표시돼요' }) : null,
        el('div', { class: 'ticket-cells' },
          cell('편명', flight ? el('span', { class: 'ticket-mono', text: flight.iata }) : el('span', { class: 'muted', text: '—' })),
          cell('예약번호', r.code ? el('span', { class: 'ticket-mono', text: r.code }) : el('span', { class: 'muted', text: '없음' })),
          cell('비행 시간', duration ? el('span', { text: duration }) : el('span', { class: 'muted', text: r.arrival ? '—' : '도착 일시 없음' })),
          cell('연결된 일정', linked ?? el('span', { class: 'muted', text: '없음' }))))),
    el('div', { class: 'ticket-cut' }),
    el('div', { class: 'ticket-stub' },
      el('div', { class: 'ticket-band ticket-band-stub' }, el('span', { text: airline ?? '항공' }), el('span', { class: 'ticket-band-date', text: dateOf(r.datetime) || '일시 미정' })),
      el('div', { class: 'ticket-stub-body' },
        el('div', { class: 'ticket-cell' }, el('div', { class: 'ticket-k', text: '메모' }), el('div', { class: 'ticket-v ticket-memo' }, r.note ? el('span', { class: 'pre-wrap' }, linkedText(r.note)) : el('span', { class: 'muted', text: '—' }))),
        el('div', { class: 'ticket-foot' },
          flight ? el('a', { href: flightradarUrl(flight.iata), target: '_blank', rel: 'noopener', class: 'link-accent', text: 'Flightradar24에서 보기' }) : null,
          filesField(tripId, r)))));
}

// 예약 서류: 항공권 PDF·바우처·여권 사본을 붙여 두고 여행 중에 바로 연다 (한 번 연 서류는 오프라인에서도 열린다)
function filesField(tripId, r) {
  const files = r.files ?? [];
  const input = el('input', { type: 'file', accept: FILE_ACCEPT, multiple: true, class: 'visually-hidden' });
  const status = el('span', { class: 'muted' });
  input.addEventListener('change', async () => {
    const list = [...input.files];
    input.value = '';
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      status.textContent = `올리는 중 ${i + 1} / ${list.length}`;
      try {
        const payload = await prepareFile(file);
        await addReservationFile(tripId, r.id, payload);
      } catch (err) {
        console.error(err);
        toast(err?.message === 'too-large' ? `'${file.name}'은(는) 너무 커요. PDF는 ${formatSize(FILE_MAX_BYTES)}까지, 사진은 자동으로 줄여요`
          : err?.message === 'unsupported' ? `'${file.name}'은(는) 사진이나 PDF가 아니에요` : `'${file.name}'을(를) 올리지 못했어요`, { kind: 'error', ms: 5000 });
      }
    }
    status.textContent = '';
  });
  return el('div', { class: 'file-field' },
    el('div', { class: 'file-chips' },
      ...files.map((f) => el('span', { class: 'file-chip' },
        el('button', { type: 'button', class: 'file-open', title: `${f.name} 열기`, onClick: () => openFile(tripId, f) },
          icon(f.type === 'application/pdf' ? 'calendar' : 'expand'), el('span', { class: 'file-name', text: f.name }), el('span', { class: 'muted', text: formatSize(f.size) })),
        el('button', {
          type: 'button', class: 'btn btn-icon btn-sm', 'aria-label': `${f.name} 삭제`,
          onClick: async () => {
            if (!(await confirmDialog(`'${f.name}' 서류를 삭제할까요?`))) return;
            await deleteReservationFile(tripId, r.id, f).catch((err) => { console.error(err); toast('삭제하지 못했어요', { kind: 'error' }); });
          },
        }, icon('close')))),
      el('button', { type: 'button', class: 'btn btn-sm', onClick: () => input.click() }, icon('plus'), '서류 추가'),
      status),
    input);
}

// 사진은 긴 변 1280px JPEG 로 줄이고, PDF 는 그대로 (문서 한도 안일 때만)
async function prepareFile(file) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (file.size > FILE_MAX_BYTES) throw new Error('too-large');
    return { name: file.name, type: 'application/pdf', bytes: new Uint8Array(await file.arrayBuffer()) };
  }
  if (file.type.startsWith('image/')) {
    const { bytes } = await compressImage(file);
    return { name: file.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', bytes };
  }
  throw new Error('unsupported');
}

const objectUrls = new Map(); // fileId -> object URL (같은 세션에서 다시 열면 재사용)
async function openFile(tripId, meta) {
  try {
    let url = objectUrls.get(meta.id);
    if (!url) {
      const f = await getReservationFile(tripId, meta.id);
      if (!f) { toast('서류를 찾을 수 없어요', { kind: 'error' }); return; }
      url = URL.createObjectURL(new Blob([f.bytes], { type: f.type }));
      objectUrls.set(meta.id, url);
    }
    if (meta.type === 'application/pdf') {
      const win = window.open(url, '_blank', 'noopener');
      if (!win) { const a = el('a', { href: url, download: meta.name }); document.body.append(a); a.click(); a.remove(); }
    } else {
      openLightbox(url);
    }
  } catch (err) { console.error(err); toast('서류를 열지 못했어요', { kind: 'error' }); }
}

function field(label, value) {
  return el('div', { class: 'stat' }, el('span', { class: 'muted', text: label }), el('span', {}, value));
}

function openDialog(tripId, state, existing = null) {
  const type = el('select', { class: 'input', id: 'rs-type' },
    ...Object.entries(TYPE_LABELS).map(([k, v]) => el('option', { value: k, selected: (existing?.type ?? 'etc') === k, text: v })));
  const title = el('input', { class: 'input', id: 'rs-title', value: existing?.title ?? '', placeholder: '비워 두면 항공은 자동으로 채워요' });
  const flight = el('input', { class: 'input', id: 'rs-flight', value: existing?.flightNumber ?? '', placeholder: '예: LJ213', autocomplete: 'off', autocapitalize: 'characters' });
  const flightHint = el('p', { class: 'muted ps-hint rs-flight-hint' });
  const arrival = el('input', { class: 'input', id: 'rs-arrival', type: 'datetime-local', value: existing?.arrival ?? '' });
  // 출발·도착 공항: 도시 이름이나 코드. 자동완성 목록은 자주 가는 공항 표에서
  const airportList = el('datalist', { id: 'rs-airports' }, ...airportSuggestions().map((a) => el('option', { value: a.label })));
  const airportValue = (v) => String(v ?? '').replace(/\s*\([A-Z]{3}\)$/, '').split('·')[0].trim(); // "오사카·간사이 (KIX)" → "오사카"
  const fromAirport = el('input', { class: 'input', id: 'rs-from', list: 'rs-airports', value: existing?.fromAirport ?? '', placeholder: '예: 인천', autocomplete: 'off' });
  const toAirport = el('input', { class: 'input', id: 'rs-to', list: 'rs-airports', value: existing?.toAirport ?? '', placeholder: '예: 오사카', autocomplete: 'off' });
  const flightField = el('div', { class: 'field', hidden: (existing?.type ?? 'etc') !== 'flight' },
    el('div', { class: 'form-grid' },
      el('div', { class: 'field' }, el('label', { for: 'rs-from', text: '출발 공항' }), fromAirport),
      el('div', { class: 'field' }, el('label', { for: 'rs-to', text: '도착 공항' }), toAirport)),
    airportList,
    el('label', { for: 'rs-flight', text: '편명' }), flight, flightHint,
    el('label', { for: 'rs-arrival', text: '도착 일시' }), arrival,
    el('p', { class: 'muted ps-hint', text: '일시는 출발 시각. 제목을 비워 두면 "인천 → 오사카 · 진에어 LJ313" 처럼 자동으로 채워요.' }));
  function drawFlightHint() {
    const parsed = parseFlightNumber(flight.value);
    flightHint.replaceChildren();
    if (!parsed) { flightHint.textContent = flight.value.trim() ? '편명 형식이 아니에요 (예: LJ213)' : '편명을 넣으면 항공사 이름이 붙고 Flightradar24로 시간표를 볼 수 있어요'; return; }
    const name = airlineName(parsed.airline);
    flightHint.append(name ? `${name} ${parsed.iata} · ` : `${parsed.iata} (항공사 코드 ${parsed.airline}) · `,
      el('a', { href: flightradarUrl(parsed.iata), target: '_blank', rel: 'noopener', class: 'link-accent', text: 'Flightradar24에서 보기' }));
  }
  flight.addEventListener('input', drawFlightHint);
  type.addEventListener('change', () => { flightField.hidden = type.value !== 'flight'; checkoutField.hidden = type.value !== 'stay'; });
  drawFlightHint();
  const datetime = el('input', { class: 'input', id: 'rs-datetime', type: 'datetime-local', value: existing?.datetime ?? '' });
  // 숙소만: 체크아웃. 있으면 체크인~체크아웃 기간의 Day 마다 일정을 만든다
  const checkout = el('input', { class: 'input', id: 'rs-checkout', type: 'datetime-local', value: existing?.checkout ?? '' });
  const checkoutField = el('div', { class: 'field', hidden: (existing?.type ?? 'etc') !== 'stay' },
    el('label', { for: 'rs-checkout', text: '체크아웃' }), checkout,
    el('p', { class: 'muted ps-hint', text: '넣으면 체크인 날부터 체크아웃 날까지 날마다 일정(체크인·숙박·체크아웃)이 생겨요' }));
  const code = el('input', { class: 'input', id: 'rs-code', value: existing?.code ?? '', placeholder: '예약번호' });
  const note = el('textarea', { class: 'input', id: 'rs-note', rows: '3', placeholder: '좌석, 체크인 시간, 주소 등' });
  note.value = existing?.note ?? '';
  const linked = el('select', { class: 'input', id: 'rs-linked' },
    el('option', { value: '', text: '연결 안 함' }),
    ...state.places.map((p) => el('option', { value: p.id, selected: existing?.linkedPlaceId === p.id, text: placeLabel(state, p.id) })));
  // 일시가 있고 연결한 일정이 없으면, 저장할 때 그 날 일정에 장소를 만들어 연결한다 (기본 켜짐)
  const autoAdd = el('input', { type: 'checkbox', id: 'rs-auto', checked: !existing?.linkedPlaceId });
  const autoField = el('label', { class: 'check-inline', for: 'rs-auto' }, autoAdd, '일정에 자동 추가 (일시의 날짜 Day 에 시각 순서로)');
  const syncAuto = () => { autoField.hidden = !datetime.value || !!linked.value; };
  datetime.addEventListener('input', syncAuto); linked.addEventListener('change', syncAuto); syncAuto();
  const dialog = el('dialog', {});
  const form = el('form', { method: 'dialog' },
    el('h2', { text: existing ? '예약 편집' : '예약 추가' }),
    el('div', { class: 'dialog-body' },
      el('div', { class: 'form-grid' },
        el('div', { class: 'field' }, el('label', { for: 'rs-type', text: '종류' }), type),
        el('div', { class: 'field' }, el('label', { for: 'rs-datetime', text: '일시' }), datetime)),
      flightField, checkoutField,
      el('div', { class: 'field' }, el('label', { for: 'rs-title', text: '제목' }), title),
      el('div', { class: 'field' }, el('label', { for: 'rs-code', text: '예약번호' }), code),
      el('div', { class: 'field' }, el('label', { for: 'rs-note', text: '메모' }), note),
      el('div', { class: 'field' }, el('label', { for: 'rs-linked', text: '연결된 일정' }), linked, autoField)),
    el('div', { class: 'dialog-actions' },
      el('button', { type: 'button', class: 'btn', onClick: () => dialog.close() }, '취소'),
      el('button', { type: 'submit', class: 'btn btn-primary' }, existing ? '저장' : '추가')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const parsedFlight = type.value === 'flight' ? parseFlightNumber(flight.value) : null;
    const isFlight = type.value === 'flight';
    const from = isFlight ? airportValue(fromAirport.value) : '';
    const to = isFlight ? airportValue(toAirport.value) : '';
    // 항공은 제목이 비어 있으면 공항·항공사·편명으로 만든다
    if (isFlight && !title.value.trim()) title.value = flightTitle({ from, to, airline: airlineName(parsedFlight?.airline), iata: parsedFlight?.iata ?? null });
    const data = {
      type: type.value, title: title.value.trim(), datetime: datetime.value || null, code: code.value.trim(), note: note.value,
      fromAirport: from, toAirport: to,
      checkout: type.value === 'stay' && checkout.value ? checkout.value : null,
      arrival: type.value === 'flight' && arrival.value ? arrival.value : null,
      linkedPlaceId: linked.value || null, linkedPlaceIds: existing?.linkedPlaceIds ?? [], flightNumber: parsedFlight ? parsedFlight.iata : null,
    };
    if (!data.title) { toast('제목을 입력해 주세요', { kind: 'error' }); return; }
    try {
      const specs = placesFromReservation(data, state.days);
      const alreadyLinked = data.linkedPlaceId || data.linkedPlaceIds.length;
      if (!alreadyLinked && data.datetime && autoAdd.checked) {
        // 새로 연결: 해당 Day 마다 시각 순서로 장소를 만들고 전부 연결 (숙소는 기간만큼 여러 개)
        if (!specs.length) toast('그 날짜의 Day 가 없어 일정에는 넣지 않았어요', { ms: 4000 });
        else {
          const ids = [];
          for (const spec of specs) {
            const sameDay = state.places.filter((p) => p.dayId === spec.dayId);
            ids.push(await addPlace(tripId, { ...spec, order: orderForTime(sameDay, spec.time) }));
          }
          data.linkedPlaceId = ids[0];
          data.linkedPlaceIds = ids;
          const dayNums = specs.map((s) => state.days.findIndex((d) => d.id === s.dayId) + 1);
          toast(ids.length === 1 ? `Day ${dayNums[0]} 일정에 넣었어요` : `Day ${dayNums[0]}~${dayNums[dayNums.length - 1]} 일정에 ${ids.length}개 넣었어요`);
        }
      } else if (existing?.linkedPlaceId && data.linkedPlaceIds.length <= 1 && data.linkedPlaceId === existing.linkedPlaceId && data.datetime !== existing.datetime && specs[0]) {
        // 하나짜리 연결에서 일시를 고쳤으면 연결된 일정의 시각(날짜가 바뀌면 Day 도)을 따라 옮긴다. 여러 개짜리는 손대지 않는다
        await updatePlace(tripId, data.linkedPlaceId, { time: specs[0].time, dayId: specs[0].dayId });
      }
      if (existing) await updateReservation(tripId, existing.id, data); else await addReservation(tripId, data);
      dialog.close();
    } catch (err) { console.error(err); toast('저장하지 못했어요', { kind: 'error' }); }
  });
  dialog.append(form); openModal(dialog); title.focus();
}
