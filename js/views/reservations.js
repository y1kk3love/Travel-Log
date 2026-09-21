import { el, clear, toast, confirmDialog, openModal, icon, linkedText } from '../ui.js';
import { watchReservations, addReservation, updateReservation, deleteReservation, watchPlaces, watchDays } from '../db.js';
import { parseFlightNumber, airlineName, flightradarUrl } from '../lib/flight.js';

const TYPE_LABELS = { flight: '항공', stay: '숙소', food: '식당', etc: '기타' };

export function mount(content, ctx) {
  const { tripId } = ctx;
  const state = { reservations: [], places: [], days: [] };
  const main = el('main', { class: 'container reservations-page' });
  content.append(main);
  const redraw = () => draw(main, tripId, state);
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
  const linked = r.linkedPlaceId ? placeLabel(state, r.linkedPlaceId) : null;
  return el('section', { class: 'card reservation' },
    el('div', { class: 'reservation-head' },
      el('div', { class: 'reservation-title' },
        el('span', { class: 'badge badge-muted', text: TYPE_LABELS[r.type] ?? '기타' }),
        el('strong', { text: r.title || '(제목 없음)' })),
      el('div', {},
        el('span', { class: 'muted', text: formatDatetime(r.datetime) }),
        el('button', { class: 'btn btn-icon btn-sm', 'aria-label': '편집', onClick: () => openDialog(tripId, state, r) }, icon('edit')),
        el('button', {
          class: 'btn btn-icon btn-sm', 'aria-label': '삭제',
          onClick: async () => {
            if (!(await confirmDialog(`'${r.title}' 예약을 삭제할까요?`))) return;
            await deleteReservation(tripId, r.id).catch((err) => { console.error(err); toast('삭제하지 못했어요', { kind: 'error' }); });
          },
        }, icon('trash')))),
    el('div', { class: 'reservation-grid' },
      ...(r.flightNumber ? [field('편명', el('span', {},
        `${airlineName(parseFlightNumber(r.flightNumber)?.airline) ?? ''} ${r.flightNumber} · `.replace(/^ /, ''),
        el('a', { href: flightradarUrl(r.flightNumber), target: '_blank', rel: 'noopener', class: 'link-accent', text: 'Flightradar24에서 보기' })))] : []),
      field('예약번호', r.code ? el('code', { text: r.code }) : el('span', { class: 'muted', text: '없음' })),
      field('메모', r.note ? el('span', { class: 'pre-wrap' }, linkedText(r.note)) : '—'),
      field('연결된 일정', linked ? el('a', { href: `#/trip/${tripId}/planner/${r.linkedPlaceId}`, class: 'link-accent', text: linked }) : '없음')));
}

function field(label, value) {
  return el('div', { class: 'stat' }, el('span', { class: 'muted', text: label }), el('span', {}, value));
}

function openDialog(tripId, state, existing = null) {
  const type = el('select', { class: 'input', id: 'rs-type' },
    ...Object.entries(TYPE_LABELS).map(([k, v]) => el('option', { value: k, selected: (existing?.type ?? 'etc') === k, text: v })));
  const title = el('input', { class: 'input', id: 'rs-title', value: existing?.title ?? '', required: true, placeholder: '예: 인천 → 간사이 KE723' });
  const flight = el('input', { class: 'input', id: 'rs-flight', value: existing?.flightNumber ?? '', placeholder: '예: LJ213', autocomplete: 'off', autocapitalize: 'characters' });
  const flightHint = el('p', { class: 'muted ps-hint rs-flight-hint' });
  const flightField = el('div', { class: 'field', hidden: (existing?.type ?? 'etc') !== 'flight' },
    el('label', { for: 'rs-flight', text: '편명' }), flight, flightHint);
  function drawFlightHint() {
    const parsed = parseFlightNumber(flight.value);
    flightHint.replaceChildren();
    if (!parsed) { flightHint.textContent = flight.value.trim() ? '편명 형식이 아니에요 (예: LJ213)' : '편명을 넣으면 항공사 이름이 붙고 Flightradar24로 시간표를 볼 수 있어요'; return; }
    const name = airlineName(parsed.airline);
    flightHint.append(name ? `${name} ${parsed.iata} · ` : `${parsed.iata} (항공사 코드 ${parsed.airline}) · `,
      el('a', { href: flightradarUrl(parsed.iata), target: '_blank', rel: 'noopener', class: 'link-accent', text: 'Flightradar24에서 보기' }));
    if (!title.value.trim() && name) title.value = `${name} ${parsed.iata}`;
  }
  flight.addEventListener('input', drawFlightHint);
  type.addEventListener('change', () => { flightField.hidden = type.value !== 'flight'; });
  drawFlightHint();
  const datetime = el('input', { class: 'input', id: 'rs-datetime', type: 'datetime-local', value: existing?.datetime ?? '' });
  const code = el('input', { class: 'input', id: 'rs-code', value: existing?.code ?? '', placeholder: '예약번호' });
  const note = el('textarea', { class: 'input', id: 'rs-note', rows: '3', placeholder: '좌석, 체크인 시간, 주소 등' });
  note.value = existing?.note ?? '';
  const linked = el('select', { class: 'input', id: 'rs-linked' },
    el('option', { value: '', text: '연결 안 함' }),
    ...state.places.map((p) => el('option', { value: p.id, selected: existing?.linkedPlaceId === p.id, text: placeLabel(state, p.id) })));
  const dialog = el('dialog', {});
  const form = el('form', { method: 'dialog' },
    el('h2', { text: existing ? '예약 편집' : '예약 추가' }),
    el('div', { class: 'dialog-body' },
      el('div', { class: 'form-grid' },
        el('div', { class: 'field' }, el('label', { for: 'rs-type', text: '종류' }), type),
        el('div', { class: 'field' }, el('label', { for: 'rs-datetime', text: '일시' }), datetime)),
      flightField,
      el('div', { class: 'field' }, el('label', { for: 'rs-title', text: '제목' }), title),
      el('div', { class: 'field' }, el('label', { for: 'rs-code', text: '예약번호' }), code),
      el('div', { class: 'field' }, el('label', { for: 'rs-note', text: '메모' }), note),
      el('div', { class: 'field' }, el('label', { for: 'rs-linked', text: '연결된 일정' }), linked)),
    el('div', { class: 'dialog-actions' },
      el('button', { type: 'button', class: 'btn', onClick: () => dialog.close() }, '취소'),
      el('button', { type: 'submit', class: 'btn btn-primary' }, existing ? '저장' : '추가')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const parsedFlight = type.value === 'flight' ? parseFlightNumber(flight.value) : null;
    const data = {
      type: type.value, title: title.value.trim(), datetime: datetime.value || null, code: code.value.trim(), note: note.value,
      linkedPlaceId: linked.value || null, flightNumber: parsedFlight ? parsedFlight.iata : null,
    };
    if (!data.title) { toast('제목을 입력해 주세요', { kind: 'error' }); return; }
    try {
      if (existing) await updateReservation(tripId, existing.id, data); else await addReservation(tripId, data);
      dialog.close();
    } catch (err) { console.error(err); toast('저장하지 못했어요', { kind: 'error' }); }
  });
  dialog.append(form); openModal(dialog); title.focus();
}
