import { el, clear, toast, confirmDialog, icon, CATEGORY_LABELS } from '../ui.js';
import { watchDays, watchPlaces, addDay, deleteDay } from '../db.js';
import { formatShort } from '../lib/dates.js';
import { legLabel } from '../lib/geo.js';
import { createMap } from '../map.js';
import { openPlaceSheet } from './place-sheet.js';

export function mount(content, ctx) {
  const { tripId } = ctx;
  const state = { days: [], places: [], selectedDayId: null, showAll: false, dragging: false, pending: false };

  const panel = el('section', { class: 'planner-panel' });
  const mapArea = el('section', { class: 'planner-map' });
  const mapBox = el('div', { class: 'map-box' });
  const toggleDay = el('button', { class: 'btn btn-sm map-toggle active', onClick: () => setShowAll(false) }, '이 날만');
  const toggleAll = el('button', { class: 'btn btn-sm map-toggle', onClick: () => setShowAll(true) }, '전체 일정');
  mapArea.append(mapBox, el('div', { class: 'map-controls' }, toggleDay, toggleAll));
  content.append(el('div', { class: 'planner' }, panel, mapArea));

  const map = createMap(mapBox);
  map.onSelect((placeId) => highlight(placeId));
  requestAnimationFrame(() => map.invalidate());

  const unsubs = [
    watchDays(tripId, (days) => {
      state.days = days;
      if (!state.selectedDayId || !days.some((d) => d.id === state.selectedDayId)) state.selectedDayId = days[0]?.id ?? null;
      redraw();
    }),
    watchPlaces(tripId, (places) => { state.places = places; redraw(); }),
  ];

  function setShowAll(value) {
    state.showAll = value;
    toggleDay.classList.toggle('active', !value);
    toggleAll.classList.toggle('active', value);
    drawMap();
  }

  function selectDay(dayId) {
    state.selectedDayId = dayId;
    redraw();
  }

  function placesOf(dayId) {
    return state.places.filter((p) => p.dayId === dayId);
  }

  function redraw() {
    if (state.dragging) { state.pending = true; return; }
    drawPanel();
    drawMap();
  }

  function drawMap() {
    const groups = state.showAll
      ? state.days.map((d, di) => placesOf(d.id).map((p, i) => ({ ...p, label: `${di + 1}-${i + 1}` })))
      : [placesOf(state.selectedDayId).map((p, i) => ({ ...p, label: String(i + 1) }))];
    map.setRoutes(groups, { fit: true });
  }

  function highlight(placeId) {
    panel.querySelectorAll('.tl-item').forEach((n) => n.classList.toggle('active', n.dataset.id === placeId));
    panel.querySelector(`.tl-item[data-id="${placeId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function drawPanel() {
    clear(panel);
    const dayIndex = state.days.findIndex((d) => d.id === state.selectedDayId);
    const day = state.days[dayIndex];
    panel.append(el('div', { class: 'day-tabs' },
      ...state.days.map((d, i) => el('button', {
        class: `day-tab${d.id === state.selectedDayId ? ' active' : ''}`, onClick: () => selectDay(d.id),
      }, el('strong', { text: `Day ${i + 1}` }), el('span', { text: formatShort(d.date) }))),
      el('button', {
        class: 'day-tab day-tab-add', 'aria-label': '날짜 추가',
        onClick: () => addDay(tripId).catch((err) => { console.error(err); toast('날짜를 추가하지 못했어요', { kind: 'error' }); }),
      }, icon('plus'))));

    if (!day) { panel.append(el('p', { class: 'muted', text: '날짜가 없어요' })); return; }
    const places = placesOf(day.id);

    panel.append(el('div', { class: 'day-head' },
      el('span', { class: 'day-title', text: `Day ${dayIndex + 1} · ${formatShort(day.date)}` }),
      el('div', { class: 'day-head-right' },
        el('span', { class: 'muted', text: `장소 ${places.length}곳` }),
        el('button', {
          class: 'btn btn-sm btn-danger', disabled: state.days.length <= 1,
          onClick: async () => {
            if (!(await confirmDialog(`Day ${dayIndex + 1}과 그 날의 장소 ${places.length}곳을 삭제할까요?`))) return;
            try { await deleteDay(tripId, day.id); toast('날짜를 삭제했어요'); }
            catch (err) { console.error(err); toast('삭제하지 못했어요', { kind: 'error' }); }
          },
        }, '이 날 삭제'))));

    const list = el('div', { class: 'timeline' });
    places.forEach((p, i) => {
      if (i > 0) {
        const label = legLabel(places[i - 1], p);
        list.append(el('div', { class: 'tl-leg' }, el('span', { class: 'tl-leg-line' }), el('span', { class: 'muted', text: label ?? '' })));
      }
      list.append(timelineItem(p, i));
    });
    if (!places.length) list.append(el('p', { class: 'muted tl-empty', text: '아직 장소가 없어요. 아래에서 추가해 보세요.' }));
    panel.append(list);
    panel.append(el('button', { class: 'btn btn-dashed', onClick: () => openSheet({ dayId: day.id, dayIndex }) }, icon('plus'), '장소 추가'));
  }

  function timelineItem(p, index) {
    return el('div', { class: 'tl-item', dataset: { id: p.id, index: String(index) } },
      el('div', { class: 'tl-num', text: String(index + 1) }),
      el('button', { class: 'tl-body', onClick: () => { map.focus(p.id); highlight(p.id); openSheet({ dayId: p.dayId, place: p }); } },
        el('div', { class: 'tl-meta' },
          p.time && el('span', { class: 'muted', text: p.time }),
          el('span', { class: 'tag', text: CATEGORY_LABELS[p.category] ?? '기타' }),
          p.stayMinutes ? el('span', { class: 'muted', text: `${p.stayMinutes}분` }) : null),
        el('div', { class: 'tl-name', text: p.name || '(이름 없음)' }),
        p.memo && el('div', { class: 'muted tl-memo', text: p.memo.split('\n')[0] })),
      el('button', { class: 'btn btn-icon drag-handle', 'aria-label': '순서 이동' }, icon('drag')));
  }

  function openSheet({ dayId, dayIndex = state.days.findIndex((d) => d.id === dayId), place = null }) {
    openPlaceSheet({ tripId, dayId, dayIndex, place });
  }

  return () => { unsubs.forEach((u) => u()); map.destroy(); };
}
