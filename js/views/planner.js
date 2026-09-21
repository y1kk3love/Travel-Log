import { el, clear, toast, confirmDialog, icon, CATEGORY_LABELS, linkedText } from '../ui.js';
import { watchDays, watchPlaces, addDay, deleteDay, reorderPlaces, watchReservations, updatePlace, movePlaceToDay } from '../db.js';
import { formatShort } from '../lib/dates.js';
import { legLabel, hasCoords, distanceKm } from '../lib/geo.js';
import { googleMapsDirectionsUrl } from '../lib/coords.js';
import { reorderUpdates } from '../lib/order.js';
import { createMap } from '../map.js';
import { openPlaceSheet } from './place-sheet.js';
import { takeShareTarget } from './share.js';
import { refreshAlarms } from '../alarms.js';
import { estimateTimes, routeBetween, pickNext } from '../lib/timeline.js';
import { weatherLabel, pickDayLocation, forecastWindow } from '../lib/weather.js';
import { fetchDailyForecast } from '../weather.js';
import { toDateStr } from '../lib/dates.js';

const isNote = (p) => p.category === 'note';
// 메모 항목은 번호를 차지하지 않는다: 장소에만 1, 2, 3… 을 붙인다
function numbered(places) {
  let n = 0;
  return places.map((p) => ({ ...p, label: isNote(p) ? null : String(++n) }));
}

export function mount(content, ctx) {
  const { tripId } = ctx;
  const state = {
    days: [], places: [], reservations: [], selectedDayId: null, showAll: false, dragging: false, pending: false,
    focusPlaceId: ctx.placeId ?? null, lastFitKey: null, highlightId: null, poolOpen: true,
    pendingOpen: null, // Day 목록이 오기 전에 openSheet 가 불리면 여기 담아 두었다가 연다
  };
  let closeSheet = null;

  const panel = el('section', { class: 'planner-panel' });
  const mapArea = el('section', { class: 'planner-map' });
  const mapBox = el('div', { class: 'map-box' });
  const toggleDay = el('button', { class: 'btn btn-sm map-toggle active', onClick: () => setShowAll(false) }, '이 날만');
  const toggleAll = el('button', { class: 'btn btn-sm map-toggle', onClick: () => setShowAll(true) }, '전체 일정');
  const locateBtn = el('button', { class: 'btn btn-sm map-toggle map-locate', 'aria-label': '내 위치 보기', onClick: () => toggleLocate() }, icon('pin'), '내 위치');
  mapArea.append(mapBox, el('div', { class: 'map-controls' }, toggleDay, toggleAll, locateBtn));
  content.append(el('div', { class: 'planner' }, panel, mapArea));

  const map = createMap(mapBox);

  function toggleLocate() {
    if (map.isLocating()) { map.locateStop(); locateBtn.classList.remove('active'); return; }
    const ok = map.locateStart({
      onError: (err) => {
        locateBtn.classList.remove('active');
        const msg = err?.code === 1 ? '위치 권한이 꺼져 있어요. 브라우저 설정에서 허용해 주세요'
          : err?.message === 'unsupported' ? '이 브라우저는 위치를 지원하지 않아요' : '위치를 가져오지 못했어요';
        toast(msg, { kind: 'error', ms: 4000 });
      },
    });
    if (ok) locateBtn.classList.add('active');
  }
  map.onSelect((placeId) => highlight(placeId));
  // 새로 받은 도보 경로는 출발 장소 문서에 30일간 저장해 다른 기기·동행이 다시 요청하지 않게 한다
  map.onRoute((placeId, route) => {
    if (!state.places.some((p) => p.id === placeId)) return;
    updatePlace(tripId, placeId, { routeToNext: route }).catch((err) => console.warn('routeToNext 저장 실패', err));
  });
  requestAnimationFrame(() => map.invalidate());

  const unsubs = [
    watchDays(tripId, (days) => {
      state.days = days;
      if (!state.selectedDayId || !days.some((d) => d.id === state.selectedDayId)) {
        // 오늘 모드: 여행 중이면 오늘 Day 를 먼저 연다
        const today = days.find((d) => d.date === toDateStr(new Date()));
        state.selectedDayId = today?.id ?? days[0]?.id ?? null;
      }
      if (state.pendingOpen && days.length) { const args = state.pendingOpen; state.pendingOpen = null; openSheet(args); }
      redraw();
      refreshAlarms(); // 앱 전용: 일정이 바뀌면 알림 다시 예약 (웹에서는 no-op)
    }),
    watchPlaces(tripId, (places) => {
      state.places = places;
      // 예약 카드 등에서 특정 장소로 들어온 경우: 그 장소의 Day를 열고 강조한다 (한 번만)
      const target = state.focusPlaceId && places.find((p) => p.id === state.focusPlaceId);
      if (target) { state.selectedDayId = target.dayId; state.focusPlaceId = null; }
      redraw();
      if (target) { map.focus(target.id); highlight(target.id); }
      refreshAlarms();
    }),
    watchReservations(tripId, (r) => { state.reservations = r; redraw(); }),
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
  // 보관함: 날짜를 정하지 않은 장소 (dayId 없음)
  const poolPlaces = () => state.places.filter((p) => p.dayId == null && !isNote(p));

  function redraw() {
    if (state.dragging) { state.pending = true; return; }
    drawPanel();
    drawMap();
  }

  function drawMap() {
    const groups = state.showAll
      ? state.days.map((d, di) => numbered(placesOf(d.id)).filter((p) => !isNote(p)).map((p) => ({ ...p, label: `${di + 1}-${p.label}` })))
      : [numbered(placesOf(state.selectedDayId)).filter((p) => !isNote(p))];
    // 핀 구성(어느 장소를 어떤 순서로)이 바뀔 때만 시야를 다시 맞춘다. 메모 수정 같은 갱신은 사용자의 확대·이동을 유지한다.
    const extras = poolPlaces().filter(hasCoords);
    const fitKey = [...groups, extras].map((g) => g.filter(hasCoords).map((p) => `${p.id}@${p.lat},${p.lng}`).join(',')).join('|');
    const fit = fitKey !== state.lastFitKey;
    state.lastFitKey = fitKey;
    map.setRoutes(groups, { fit, extras });
  }

  function highlight(placeId) {
    state.highlightId = placeId; // 재렌더 후에도 강조가 유지되도록 상태로 둔다
    panel.querySelectorAll('.tl-item').forEach((n) => n.classList.toggle('active', n.dataset.id === placeId));
    panel.querySelector(`.tl-item[data-id="${placeId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function drawPanel() {
    clear(panel);
    const dayIndex = state.days.findIndex((d) => d.id === state.selectedDayId);
    const day = state.days[dayIndex];
    panel.append(el('div', { class: 'day-tabs' },
      ...state.days.map((d, i) => el('button', {
        // 지나간 날은 여권 도장처럼 작은 체크 도장
        class: `day-tab${d.id === state.selectedDayId ? ' active' : ''}${d.date < toDateStr(new Date()) ? ' stamped' : ''}`, onClick: () => selectDay(d.id),
      }, el('strong', { text: `Day ${i + 1}` }), el('span', { text: formatShort(d.date) }))),
      el('button', {
        class: 'day-tab day-tab-add', 'aria-label': '날짜 추가',
        onClick: () => addDay(tripId).catch((err) => { console.error(err); toast('날짜를 추가하지 못했어요', { kind: 'error' }); }),
      }, icon('plus'))));

    if (!day) { panel.append(el('p', { class: 'muted', text: '날짜가 없어요' })); return; }
    const places = placesOf(day.id);

    const weatherEl = el('span', { class: 'muted day-weather' });
    loadWeather(day, weatherEl);
    const placeCount = places.filter((p) => !isNote(p)).length;
    panel.append(el('div', { class: 'day-head' },
      el('span', { class: 'day-title' }, `Day ${dayIndex + 1} · ${formatShort(day.date)}`, weatherEl),
      el('div', { class: 'day-head-right' },
        el('span', { class: 'muted', text: `장소 ${placeCount}곳` }),
        el('button', {
          class: 'btn btn-sm btn-danger', disabled: state.days.length <= 1,
          onClick: async () => {
            if (!(await confirmDialog(`Day ${dayIndex + 1}과 그 날의 장소 ${places.length}곳을 삭제할까요?`))) return;
            try { await deleteDay(tripId, day.id); toast('날짜를 삭제했어요'); }
            catch (err) { console.error(err); toast('삭제하지 못했어요', { kind: 'error' }); }
          },
        }, '이 날 삭제'))));

    const list = el('div', { class: 'timeline' });
    const labeled = numbered(places);
    const times = estimateTimes(places);
    // 오늘 모드: 오늘 Day 면 지금 시각 기준으로 다음 목적지를 위에 띄우고 항목에 표시한다
    const isToday = day.date === toDateStr(new Date());
    const next = isToday ? pickNext(places, times, nowHHMM()) : { currentIndex: null, nextIndex: null, done: false };
    if (isToday) panel.append(todayBanner(places, times, next));
    let prevPlace = null; // 이동 구간은 장소끼리만 (메모는 건너뜀)
    labeled.forEach((p, i) => {
      if (!isNote(p)) {
        if (prevPlace) {
          const label = legLabel(prevPlace, p, routeBetween(prevPlace, p)); // 구글 도보 시간이 저장돼 있으면 그걸로
          // 두 장소 모두 위치가 있으면 Google 지도 길찾기(3km 이하 도보, 그 밖은 대중교통)를 연다
          const dir = hasCoords(prevPlace) && hasCoords(p) ? el('a', {
            class: 'btn tl-leg-btn', target: '_blank', rel: 'noopener', title: `${prevPlace.name} → ${p.name} 길찾기`,
            href: googleMapsDirectionsUrl({ from: prevPlace, to: p, mode: distanceKm(prevPlace, p) <= 3 ? 'walking' : 'transit' }),
          }, icon('pin'), '길찾기') : null;
          list.append(el('div', { class: 'tl-leg' }, el('span', { class: 'tl-leg-line' }), el('span', { class: 'muted', text: label ?? '' }), dir));
        }
        prevPlace = p;
      }
      const item = timelineItem(p, i, times[i]);
      if (i === next.nextIndex) { item.classList.add('tl-next'); item.querySelector('.tl-meta')?.prepend(el('span', { class: 'badge badge-next', text: '다음' })); }
      else if (i === next.currentIndex) item.classList.add('tl-now');
      list.append(item);
    });
    if (!places.length) list.append(el('p', { class: 'muted tl-empty', text: '아직 장소가 없어요. 아래에서 추가해 보세요.' }));
    panel.append(list);
    enableDrag(list, places);
    panel.append(el('div', { class: 'tl-actions' },
      el('button', { class: 'btn btn-dashed', onClick: () => openSheet({ dayId: day.id, dayIndex }) }, icon('plus'), '장소 추가'),
      el('button', { class: 'btn btn-dashed', onClick: () => openSheet({ dayId: day.id, dayIndex, kind: 'note' }) }, icon('edit'), '메모 추가')));
    panel.append(poolSection());
  }

  // 가고 싶은 곳 보관함: 날짜 미정 장소. 지도에는 회색 핀으로 같이 보이고, 여기서 바로 Day 에 넣을 수 있다.
  function poolSection() {
    const pool = poolPlaces();
    const head = el('button', {
      class: 'pool-head', 'aria-expanded': String(state.poolOpen),
      onClick: () => { state.poolOpen = !state.poolOpen; drawPanel(); },
    }, el('strong', { text: `가고 싶은 곳 ${pool.length}` }), el('span', { class: 'muted', text: state.poolOpen ? '접기' : '펼치기' }));
    const section = el('section', { class: 'pool' }, head);
    if (!state.poolOpen) return section;
    const list = el('div', { class: 'pool-list' }, ...pool.map((p) => {
      const move = el('select', { class: 'input pool-move', 'aria-label': `${p.name} 넣을 날짜`, onClick: (e) => e.stopPropagation() },
        el('option', { value: '', text: 'Day에 넣기…' }),
        ...state.days.map((d, i) => el('option', { value: d.id, text: `Day ${i + 1} · ${formatShort(d.date)}` })));
      move.addEventListener('change', async () => {
        if (!move.value) return;
        try { await movePlaceToDay(tripId, p.id, move.value); toast(`'${p.name}'을(를) 일정에 넣었어요`); }
        catch (err) { console.error(err); toast('옮기지 못했어요', { kind: 'error' }); move.value = ''; }
      });
      return el('div', { class: 'pool-item', dataset: { id: p.id } },
        el('button', { class: 'tl-body', onClick: () => { map.focus(p.id); openSheet({ dayId: null, place: p }); } },
          el('div', { class: 'tl-meta' }, el('span', { class: 'tag', text: CATEGORY_LABELS[p.category] ?? '기타' }), !hasCoords(p) && el('span', { class: 'muted', text: '위치 없음' })),
          el('div', { class: 'tl-name', text: p.name || '(이름 없음)' }),
          p.memo && el('div', { class: 'muted tl-memo' }, linkedText(p.memo, { firstLineOnly: true }))),
        move);
    }));
    section.append(
      pool.length ? list : el('p', { class: 'muted tl-empty', text: '가고 싶은데 날짜를 아직 못 정한 곳을 담아 두세요. 지도에 회색 핀으로 보여요.' }),
      el('button', { class: 'btn btn-dashed pool-add', onClick: () => openSheet({ dayId: null }) }, icon('plus'), '보관함에 담기'));
    return section;
  }

  // 오늘 모드 배너: 다음 목적지, 남은 시간, 현재 위치에서 길찾기
  function todayBanner(places, times, next) {
    if (next.nextIndex == null) {
      return el('div', { class: `today-banner${next.done ? ' done' : ''}` },
        el('strong', { text: next.done ? '오늘 일정을 모두 마쳤어요' : '오늘 일정이에요' }),
        el('span', { class: 'muted', text: next.done ? '수고했어요!' : '장소에 시간을 적으면 다음 목적지를 알려드려요' }));
    }
    const p = places[next.nextIndex];
    const t = times[next.nextIndex].time;
    const [h, m] = t.split(':').map(Number);
    const now = new Date();
    const left = h * 60 + m - (now.getHours() * 60 + now.getMinutes());
    const leftText = left >= 60 ? `${Math.floor(left / 60)}시간 ${left % 60}분 남음` : `${left}분 남음`;
    return el('div', { class: 'today-banner' },
      el('div', { class: 'today-banner-text' },
        el('span', { class: 'muted', text: `다음 목적지 · ${t}${times[next.nextIndex].estimated ? ' 예상' : ''} · ${leftText}` }),
        el('strong', { text: p.name })),
      hasCoords(p) ? el('a', {
        class: 'btn btn-sm btn-primary', target: '_blank', rel: 'noopener',
        href: googleMapsDirectionsUrl({ to: { lat: p.lat, lng: p.lng, placeId: p.placeId } }),
      }, icon('pin'), '여기서 길찾기') : null);
  }

  // 오늘 Day 를 보고 있으면 1분마다 배너·다음 표시를 갱신한다
  const minuteTimer = setInterval(() => {
    const day = state.days.find((d) => d.id === state.selectedDayId);
    if (day && day.date === toDateStr(new Date()) && !state.dragging) drawPanel();
  }, 60000);

  // 오늘부터 15일 안의 날짜만, 그 날 첫 장소 위치로 예보를 받는다 (없으면 표시 안 함)
  async function loadWeather(day, target) {
    const today = toDateStr(new Date());
    if (!forecastWindow([day.date], today).length) return;
    const loc = pickDayLocation(state.places, day.id);
    if (!loc) return;
    try {
      const daily = await fetchDailyForecast(loc.lat, loc.lng, day.date, day.date);
      const w = daily[day.date];
      if (w && target.isConnected) target.textContent = ` · ${weatherLabel(w.code)} ${w.tmax}°/${w.tmin}°`;
    } catch (err) { console.warn('weather', err); }
  }

  function enableDrag(list, places) {
    list.querySelectorAll('.drag-handle').forEach((handle) => {
      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const item = handle.closest('.tl-item');
        const rows = [...list.querySelectorAll('.tl-item')];
        const from = Number(item.dataset.index);
        let to = from;
        state.dragging = true;
        item.classList.add('dragging');
        try { handle.setPointerCapture(e.pointerId); } catch { /* 합성 이벤트 등 포인터가 없으면 무시 */ }

        const onMove = (ev) => {
          const y = ev.clientY;
          let idx = rows.findIndex((r) => { const b = r.getBoundingClientRect(); return y < b.top + b.height / 2; });
          if (idx === -1) idx = rows.length;
          to = idx > from ? idx - 1 : idx;
          rows.forEach((r, i) => {
            r.classList.toggle('drop-before', i === idx && i !== from && i !== from + 1);
            r.classList.toggle('drop-after', idx === rows.length && i === rows.length - 1 && from !== rows.length - 1);
          });
        };
        const onUp = async () => {
          handle.removeEventListener('pointermove', onMove);
          rows.forEach((r) => r.classList.remove('drop-before', 'drop-after', 'dragging'));
          state.dragging = false;
          if (to !== from) {
            try { await reorderPlaces(tripId, reorderUpdates(places, from, to)); }
            catch (err) { console.error(err); toast('순서를 바꾸지 못했어요', { kind: 'error' }); }
          }
          if (state.pending) { state.pending = false; redraw(); }
        };
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp, { once: true });
        handle.addEventListener('pointercancel', onUp, { once: true });
      });
    });
  }

  function timelineItem(p, index, est) {
    if (isNote(p)) {
      return el('div', { class: `tl-item tl-note${p.id === state.highlightId ? ' active' : ''}`, dataset: { id: p.id, index: String(index) } },
        el('div', { class: 'tl-num tl-num-note' }, icon('edit')),
        el('button', { class: 'tl-body', onClick: () => { highlight(p.id); openSheet({ dayId: p.dayId, place: p, kind: 'note' }); } },
          el('div', { class: 'tl-meta' }, p.time && el('span', { class: 'muted', text: p.time }), el('span', { class: 'tag', text: '메모' })),
          el('div', { class: 'tl-name tl-note-text', text: p.name || '(내용 없음)' }),
          p.memo && el('div', { class: 'muted tl-memo' }, linkedText(p.memo, { firstLineOnly: true }))),
        el('button', { class: 'btn btn-icon drag-handle', 'aria-label': '순서 이동' }, icon('drag')));
    }
    const timeEl = p.time ? el('span', { class: 'muted', text: p.time })
      : est?.estimated ? el('span', { class: 'muted tl-est', title: '앞 장소의 시간·머무는 시간·도보 시간으로 추정', text: `도착 ~${est.time}` }) : null;
    return el('div', { class: `tl-item${p.id === state.highlightId ? ' active' : ''}`, dataset: { id: p.id, index: String(index) } },
      el('div', { class: 'tl-num', text: p.label }),
      el('button', { class: 'tl-body', onClick: () => { map.focus(p.id); highlight(p.id); openSheet({ dayId: p.dayId, place: p }); } },
        el('div', { class: 'tl-meta' },
          timeEl,
          el('span', { class: 'tag', text: CATEGORY_LABELS[p.category] ?? '기타' }),
          p.stayMinutes ? el('span', { class: 'muted', text: `${p.stayMinutes}분` }) : null,
          p.photoCount > 0 ? el('span', { class: 'tag', text: `사진 ${p.photoCount}` }) : null,
          ...state.reservations.filter((r) => r.linkedPlaceId === p.id || (r.linkedPlaceIds ?? []).includes(p.id)).map((r) => el('a', {
            class: 'badge badge-link', href: `#/trip/${tripId}/reservations/${r.id}`, title: r.title, text: '예약 ›',
            onClick: (e) => e.stopPropagation(), // 장소 창 대신 그 예약 카드로
          }))),
        el('div', { class: 'tl-name', text: p.name || '(이름 없음)' }),
        p.memo && el('div', { class: 'muted tl-memo' }, linkedText(p.memo, { firstLineOnly: true }))),
      el('button', { class: 'btn btn-icon drag-handle', 'aria-label': '순서 이동' }, icon('drag')));
  }

  // 검색 결과를 그 날 마지막 장소(없으면 여행의 아무 장소) 근처로 우선 보여준다
  function nearFor(dayId) {
    const own = placesOf(dayId).filter(hasCoords);
    const any = own.length ? own : state.places.filter(hasCoords);
    const p = any[any.length - 1];
    return p ? { lat: p.lat, lng: p.lng } : null;
  }

  function openSheet(args) {
    if (!state.days.length) { state.pendingOpen = args; return; } // 고정 지연 대신 watchDays 가 도착하면 연다
    const { dayId, dayIndex = state.days.findIndex((d) => d.id === dayId), place = null, kind = 'place', sharedText = null } = args;
    if (closeSheet) closeSheet();
    closeSheet = openPlaceSheet({ tripId, dayId, dayIndex, place, kind, days: state.days, near: nearFor(dayId ?? state.selectedDayId), sharedText });
  }

  // 공유 화면에서 넘어왔으면 장소 추가 창을 열고 공유 텍스트를 검색창에 붙여넣는다 (앱 전용)
  const share = takeShareTarget();
  if (share && share.tripId === tripId) {
    if (share.dayId) state.selectedDayId = share.dayId;
    openSheet({ dayId: share.dayId, sharedText: share.text });
  }

  // 라우트가 바뀌면(뒤로가기 등) 열려 있던 시트도 닫는다. 안 그러면 떠난 여행에 장소가 저장될 수 있다.
  return () => { unsubs.forEach((u) => u()); clearInterval(minuteTimer); if (closeSheet) closeSheet(); map.destroy(); };
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
