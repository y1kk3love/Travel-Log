import { el, toast, confirmDialog, icon, CATEGORY_LABELS, linkedText } from '../ui.js';
import { watchDays, watchPlaces, addDay, deleteDay, reorderPlaces, watchReservations, movePlaceToDay } from '../db.js';
import { formatShort } from '../lib/dates.js';
import { legLabel, hasCoords, distanceKm, locateErrorMessage } from '../lib/geo.js';
import { isNative } from '../native.js';
import { googleMapsDirectionsUrl } from '../lib/coords.js';
import { reorderUpdates } from '../lib/order.js';
import { createMap } from '../map.js';
import { openPlaceSheet } from './place-sheet.js';
import { openActionMenu } from './action-menu.js';
import { takeShareTarget } from './share.js';
import { refreshAlarms } from '../alarms.js';
import { estimateTimes, pickNext } from '../lib/timeline.js';
import { weatherLabel, pickDayLocation, forecastWindow } from '../lib/weather.js';
import { fetchDailyForecast } from '../weather.js';
import { toDateStr } from '../lib/dates.js';
import { linkedIds } from '../lib/reservation-links.js';
import { poolPlaces as pooledOf, poolCategories, groupPool } from '../lib/pool.js';
import { slideDir } from '../lib/motion.js';
import { edgeScroll, dropIndex } from '../lib/gesture.js';
import { enter, slideIn, haptic, skeleton } from '../motion.js';

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
    focusPlaceId: ctx.placeId ?? null, lastFitKey: null, highlightId: null, poolOpen: true, poolCategory: null,
    pendingOpen: null, // Day 목록이 오기 전에 openSheet 가 불리면 여기 담아 두었다가 연다
  };
  let closeSheet = null;

  // 패널은 세 부분으로 나눠 따로 다시 그린다: Day 탭 · 그 날 일정 · 보관함.
  // 통째로 다시 그리면 Day 탭의 가로 스크롤이 처음으로 돌아가고, 보관함을 접거나 1분마다 시각을 고칠 때도 일정 전체가 새로 만들어졌다.
  const panel = el('section', { class: 'planner-panel' });
  const tabsBox = el('div', { class: 'day-tabs', role: 'group', 'aria-label': '날짜' });
  const dayBox = el('div', { class: 'day-box' });
  const poolBox = el('section', { class: 'pool' });
  const mapArea = el('section', { class: 'planner-map' });
  const mapBox = el('div', { class: 'map-box' });
  const toggleDay = el('button', { class: 'btn btn-sm map-toggle active', 'aria-pressed': 'true', onClick: () => setShowAll(false) }, '이 날만');
  const toggleAll = el('button', { class: 'btn btn-sm map-toggle', 'aria-pressed': 'false', onClick: () => setShowAll(true) }, '전체 일정');
  const locateBtn = el('button', { class: 'btn btn-sm map-toggle map-locate', 'aria-label': '내 위치 보기', onClick: () => toggleLocate() }, icon('crosshair'), '내 위치');
  mapArea.append(mapBox, el('div', { class: 'map-controls' }, toggleDay, toggleAll, locateBtn));
  content.append(el('div', { class: 'planner' }, panel, mapArea));
  const loading = skeleton('row', 4); // Day·장소가 오기 전: 반짝이는 뼈대
  panel.append(loading);
  const scope = `planner:${tripId}`; // 이 여행을 처음 열 때 일정이 차례로 떠오르고, 그 뒤로는 새로 생긴 장소만

  const map = createMap(mapBox, { pinScope: `pins:${tripId}` });

  function toggleLocate() {
    if (map.isLocating()) { map.locateStop(); locateBtn.classList.remove('active'); return; }
    const ok = map.locateStart({
      onError: (err) => {
        locateBtn.classList.remove('active');
        toast(locateErrorMessage(err, { native: isNative() }), { kind: 'error', ms: 6000 });
      },
    });
    if (ok) locateBtn.classList.add('active');
  }
  map.onSelect((placeId) => highlight(placeId));
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
    toggleDay.setAttribute('aria-pressed', String(!value));
    toggleAll.setAttribute('aria-pressed', String(value));
    drawMap();
  }

  function selectDay(dayId) {
    // 뒤 날로 가면 오른쪽에서, 앞 날로 가면 왼쪽에서 일정이 밀려 들어온다
    state.slideDir = slideDir(state.days.findIndex((d) => d.id === state.selectedDayId), state.days.findIndex((d) => d.id === dayId));
    state.selectedDayId = dayId;
    drawTabs();
    drawDay();
    drawMap();
  }

  function placesOf(dayId) {
    return state.places.filter((p) => p.dayId === dayId);
  }
  // 보관함: 날짜를 정하지 않은 장소, 그리고 지워진 Day 를 가리키는 장소 (어디에도 안 보이지 않게)
  const poolPlaces = () => pooledOf(state.places, new Set(state.days.map((d) => d.id)));

  function redraw() {
    if (state.dragging) { state.pending = true; return; }
    if (loading.isConnected) { loading.remove(); panel.append(tabsBox, dayBox, poolBox); }
    drawTabs();
    drawDay();
    drawPool();
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

  // ---- Day 탭: 다시 그려도 가로 스크롤 자리를 지키고, 고른 Day 가 화면 밖이면 보이는 데까지만 옮긴다 ----
  function drawTabs() {
    const left = tabsBox.scrollLeft;
    const today = toDateStr(new Date());
    tabsBox.replaceChildren(
      ...state.days.map((d, i) => el('button', {
        // 지나간 날은 여권 도장처럼 작은 체크 도장
        class: `day-tab${d.id === state.selectedDayId ? ' active' : ''}${d.date < today ? ' stamped' : ''}`, onClick: () => selectDay(d.id),
        'aria-pressed': String(d.id === state.selectedDayId),
      }, el('strong', { text: `Day ${i + 1}` }), el('span', { text: formatShort(d.date) }))),
      el('button', {
        class: 'day-tab day-tab-add', 'aria-label': '날짜 추가',
        onClick: () => addDay(tripId).catch((err) => { console.error(err); toast('날짜를 추가하지 못했어요', { kind: 'error' }); }),
      }, icon('plus')));
    tabsBox.scrollLeft = left;
    const active = tabsBox.querySelector('.day-tab.active');
    if (!active) return;
    const box = tabsBox.getBoundingClientRect();
    const tab = active.getBoundingClientRect();
    const pad = 16;
    if (tab.left < box.left + pad) tabsBox.scrollLeft -= box.left + pad - tab.left;
    else if (tab.right > box.right - pad) tabsBox.scrollLeft += tab.right - (box.right - pad);
  }

  // ---- 그 날 일정: 머리(날짜·날씨·더 보기), 오늘 배너, 일정 목록, 추가 버튼 ----
  let todayView = null; // 오늘 Day 를 그렸을 때: 1분마다 배너·"다음" 표시만 고칠 수 있게 { places, times, slot, list }
  function drawDay() {
    const dayIndex = state.days.findIndex((d) => d.id === state.selectedDayId);
    const day = state.days[dayIndex];
    todayView = null;
    if (!day) { dayBox.replaceChildren(el('p', { class: 'muted', text: '날짜가 없어요' })); return; }
    const places = placesOf(day.id);

    const weatherEl = el('span', { class: 'muted day-weather' });
    loadWeather(day, weatherEl);
    const placeCount = places.filter((p) => !isNote(p)).length;
    const head = el('div', { class: 'day-head' },
      el('span', { class: 'day-title' }, `Day ${dayIndex + 1} · ${formatShort(day.date)}`, weatherEl),
      el('div', { class: 'day-head-right' },
        el('span', { class: 'muted', text: `장소 ${placeCount}곳` }),
        // 날짜 삭제처럼 되돌릴 수 없는 동작은 늘 보이지 않게 "더 보기" 메뉴 안에 둔다
        el('button', {
          class: 'btn btn-icon day-more', 'aria-label': `Day ${dayIndex + 1} 메뉴`, 'aria-haspopup': 'dialog',
          onClick: (e) => openActionMenu({
            title: `Day ${dayIndex + 1} · ${formatShort(day.date)}`, anchor: e.currentTarget,
            items: [{
              icon: 'trash', label: state.days.length <= 1 ? '이 날 삭제 (마지막 날은 지울 수 없어요)' : '이 날 삭제', danger: true, disabled: state.days.length <= 1,
              onClick: async () => {
                const notes = places.length - placeCount;
                const what = notes ? `장소 ${placeCount}곳·메모 ${notes}개` : `장소 ${placeCount}곳`;
                if (!(await confirmDialog(`Day ${dayIndex + 1}과 그 날의 ${what}를 삭제할까요?`))) return;
                try { await deleteDay(tripId, day.id); toast('날짜를 삭제했어요'); }
                catch (err) { console.error(err); toast('삭제하지 못했어요', { kind: 'error' }); }
              },
            }],
          }),
        }, icon('more'))));

    const list = el('div', { class: 'timeline' });
    const labeled = numbered(places);
    const times = estimateTimes(places);
    const bannerSlot = el('div', { class: 'today-slot' });
    let prevPlace = null; // 이동 구간은 장소끼리만 (메모는 건너뜀)
    labeled.forEach((p, i) => {
      if (!isNote(p)) {
        if (prevPlace) {
          const label = legLabel(prevPlace, p); // 직선거리 추정. 실제 길은 옆의 "길찾기"
          // 두 장소 모두 위치가 있으면 Google 지도 길찾기(3km 이하 도보, 그 밖은 대중교통)를 연다
          const dir = hasCoords(prevPlace) && hasCoords(p) ? el('a', {
            class: 'btn tl-leg-btn', target: '_blank', rel: 'noopener', title: `${prevPlace.name} → ${p.name} 길찾기`,
            href: googleMapsDirectionsUrl({ from: prevPlace, to: p, mode: distanceKm(prevPlace, p) <= 3 ? 'walking' : 'transit' }),
          }, icon('navigation'), '길찾기') : null;
          list.append(el('div', { class: 'tl-leg' }, el('span', { class: 'tl-leg-line' }), el('span', { class: 'muted', text: label ?? '' }), dir));
        }
        prevPlace = p;
      }
      list.append(timelineItem(p, i, times[i]));
    });
    if (!places.length) list.append(el('p', { class: 'muted tl-empty', text: '아직 장소가 없어요. 아래에서 추가해 보세요.' }));
    dayBox.replaceChildren(head, bannerSlot, list,
      el('div', { class: 'tl-actions' },
        el('button', { class: 'btn btn-tint', onClick: () => openSheet({ dayId: day.id, dayIndex }) }, icon('plus'), '장소 추가'),
        el('button', { class: 'btn btn-tint', onClick: () => openSheet({ dayId: day.id, dayIndex, kind: 'note' }) }, icon('edit'), '메모 추가')));
    // 오늘 모드: 오늘 Day 면 지금 시각 기준으로 다음 목적지를 위에 띄우고 항목에 표시한다
    if (day.date === toDateStr(new Date())) { todayView = { places, times, slot: bannerSlot, list }; drawToday(); }
    const dir = state.slideDir ?? 0;
    state.slideDir = 0;
    enter(scope, [...list.querySelectorAll('.tl-item')].map((n) => ({ el: n, key: n.dataset.id })), { animate: !dir });
    if (dir) { slideIn(list, dir); tabsBox.querySelector('.day-tab.active')?.classList.add('pop'); }
    enableDrag(list, places);
  }

  // 오늘 배너와 "다음"·"지금" 표시만 고친다 (1분마다 부른다 — 일정 목록은 그대로 두어 포커스·스크롤이 흔들리지 않는다)
  function drawToday() {
    if (!todayView) return;
    const { places, times, slot, list } = todayView;
    const next = pickNext(places, times, nowHHMM());
    slot.replaceChildren(todayBanner(places, times, next));
    list.querySelectorAll('.badge-next').forEach((b) => b.remove());
    list.querySelectorAll('.tl-item').forEach((item) => {
      const i = Number(item.dataset.index);
      item.classList.toggle('tl-next', i === next.nextIndex);
      item.classList.toggle('tl-now', i === next.currentIndex && i !== next.nextIndex);
      if (i === next.nextIndex) item.querySelector('.tl-meta')?.prepend(el('span', { class: 'badge badge-next', text: '다음' }));
    });
  }

  // ---- 가고 싶은 곳 보관함: 날짜 미정 장소. 지도에는 회색 핀으로 같이 보이고, 여기서 바로 Day 에 넣을 수 있다 ----
  // 곳이 많아지면 찾기 어려우므로 분류로 걸러 보고, 지역(교토부·나라현…)별로 묶는다 (lib/pool.js)
  function poolItem(p) {
    const move = el('select', { class: 'input pool-move', 'aria-label': `${p.name} 넣을 날짜` },
      el('option', { value: '', text: 'Day에 넣기…' }),
      ...state.days.map((d, i) => el('option', { value: d.id, text: `Day ${i + 1} · ${formatShort(d.date)}` })));
    move.addEventListener('change', async () => {
      if (!move.value) return;
      try { await movePlaceToDay(tripId, p.id, move.value); toast(`'${p.name}'을(를) 일정에 넣었어요`); }
      catch (err) { console.error(err); toast('옮기지 못했어요', { kind: 'error' }); move.value = ''; }
    });
    return el('div', { class: 'pool-item', dataset: { id: p.id } },
      el('button', { class: 'tl-body', onClick: () => { map.focus(p.id); openSheet({ dayId: null, place: p }); } },
        el('div', { class: 'tl-meta' }, el('span', { class: 'tag', text: CATEGORY_LABELS[p.category] ?? '기타' }), !hasCoords(p) && !isNote(p) && el('span', { class: 'muted', text: '위치 없음' })),
        el('div', { class: 'tl-name', text: p.name || '(이름 없음)' }),
        p.memo && el('div', { class: 'muted tl-memo' }, linkedText(p.memo, { firstLineOnly: true }))),
      move);
  }

  function drawPool() {
    const pool = poolPlaces();
    const head = el('button', {
      class: 'pool-head', 'aria-expanded': String(state.poolOpen),
      onClick: () => { state.poolOpen = !state.poolOpen; drawPool(); },
    }, el('strong', { text: `가고 싶은 곳 ${pool.length}` }), el('span', { class: 'muted', text: state.poolOpen ? '접기' : '펼치기' }));
    if (!state.poolOpen) { poolBox.replaceChildren(head); return; }
    const categories = poolCategories(pool);
    if (state.poolCategory && !categories.some((c) => c.category === state.poolCategory)) state.poolCategory = null; // 그 분류의 마지막 곳이 일정으로 갔다
    const chip = (label, value) => el('button', {
      type: 'button', class: `chip${state.poolCategory === value ? ' active' : ''}`, 'aria-pressed': String(state.poolCategory === value),
      onClick: () => { state.poolCategory = value; drawPool(); },
    }, label);
    // 분류가 둘 이상일 때만 걸러 보기 칩을 둔다
    const filter = categories.length > 1 ? el('div', { class: 'chips pool-filter', role: 'group', 'aria-label': '분류로 걸러 보기' },
      chip(`전체 ${pool.length}`, null),
      ...categories.map((c) => chip(`${CATEGORY_LABELS[c.category] ?? '기타'} ${c.count}`, c.category))) : null;
    const groups = groupPool(pool, { category: state.poolCategory });
    const list = el('div', { class: 'pool-list' }, ...groups.flatMap((g) => [
      g.region ? el('h3', { class: 'pool-region', text: `${g.region} ${g.places.length}` }) : null,
      ...g.places.map(poolItem),
    ]));
    poolBox.replaceChildren(...[head,
      filter,
      pool.length ? list : el('p', { class: 'muted tl-empty', text: '가고 싶은데 날짜를 아직 못 정한 곳을 담아 두세요. 지도에 회색 핀으로 보여요.' }),
      el('button', { class: 'btn btn-tint pool-add', onClick: () => openSheet({ dayId: null }) }, icon('plus'), '보관함에 담기')].filter(Boolean));
  }

  // 오늘 모드 배너: 다음 목적지, 남은 시간, 현재 위치에서 길찾기
  function todayBanner(places, times, next) {
    if (next.nextIndex == null) {
      return el('div', { class: `today-banner${next.done ? ' done' : ''}` },
        el('strong', { text: next.done ? '오늘 일정을 모두 마쳤어요' : '오늘 일정이에요' }),
        el('span', { class: 'muted', text: next.done ? '수고했어요' : '장소에 시간을 적으면 다음 목적지를 알려드려요' }));
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
      }, icon('navigation'), '여기서 길찾기') : null);
  }

  // 오늘 Day 를 보고 있으면 1분마다 배너·다음 표시를 갱신한다. 자정을 넘겨 "오늘"이 바뀌었으면 그 날 일정을 다시 그린다
  const minuteTimer = setInterval(() => {
    if (state.dragging) return;
    const day = state.days.find((d) => d.id === state.selectedDayId);
    const isToday = !!day && day.date === toDateStr(new Date());
    if (isToday !== !!todayView) { drawTabs(); drawDay(); } else drawToday();
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

  // 스크롤하는 곳: 넓은 화면은 패널 자체, 폰은 페이지
  function scrollerOf() {
    const y = getComputedStyle(panel).overflowY;
    return (y === 'auto' || y === 'scroll') && panel.scrollHeight > panel.clientHeight ? panel : (document.scrollingElement ?? document.documentElement);
  }

  function enableDrag(list, places) {
    // 옮긴 항목의 손잡이에 포커스를 되돌린다 (키보드로 여러 칸 연달아 옮길 수 있게)
    if (state.refocusId) {
      const again = list.querySelector(`.tl-item[data-id="${state.refocusId}"] .drag-handle`);
      state.refocusId = null;
      if (again) requestAnimationFrame(() => again.focus({ preventScroll: false }));
    }
    list.querySelectorAll('.drag-handle').forEach((handle) => {
      // 끌기 대신 위아래 화살표로도 순서를 바꾼다 (키보드·화면 낭독기)
      handle.addEventListener('keydown', async (e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const from = Number(handle.closest('.tl-item').dataset.index);
        const to = e.key === 'ArrowUp' ? from - 1 : from + 1;
        if (to < 0 || to >= places.length) return;
        state.refocusId = places[from].id;
        try { await reorderPlaces(tripId, reorderUpdates(places, from, to)); }
        catch (err) { console.error(err); toast('순서를 바꾸지 못했어요', { kind: 'error' }); }
      });
      // 끌기: 항목이 손가락을 따라오고, 놓일 자리는 파란 선으로. 화면 위·아래 가장자리에 가까이 가면 스스로 스크롤한다
      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const item = handle.closest('.tl-item');
        const rows = [...list.querySelectorAll('.tl-item')];
        const from = Number(item.dataset.index);
        const scroller = scrollerOf();
        const listTop = () => list.getBoundingClientRect().top;
        // 줄들의 가운데(목록 위에서 잰 y). 끄는 동안 다른 줄은 움직이지 않으므로 처음 한 번만 잰다
        const top0 = listTop();
        const mids = rows.map((r) => { const b = r.getBoundingClientRect(); return b.top - top0 + b.height / 2; });
        const startY = e.clientY;
        const startScroll = scroller.scrollTop;
        let lastY = startY;
        let to = from;
        let frame = 0;
        state.dragging = true;
        item.classList.add('dragging');
        item.style.transition = 'none';
        haptic('light');
        try { handle.setPointerCapture(e.pointerId); } catch { /* 합성 이벤트 등 포인터가 없으면 무시 */ }

        const update = () => {
          item.style.transform = `translateY(${lastY - startY + (scroller.scrollTop - startScroll)}px) scale(1.02)`;
          const idx = dropIndex(mids, lastY - listTop());
          to = idx > from ? idx - 1 : idx;
          rows.forEach((r, i) => {
            r.classList.toggle('drop-before', i === idx && i !== from && i !== from + 1);
            r.classList.toggle('drop-after', idx === rows.length && i === rows.length - 1 && from !== rows.length - 1);
          });
        };
        const tick = () => {
          // 보이는 영역: 위는 붙어 있는 Day 탭 아래부터, 아래는 패널(넓은 화면)·화면(폰) 끝까지.
          // 일정이 Day 탭 밑으로 가려져 있을 때만 위로 스크롤한다 (가려진 게 없는데 지도 쪽으로 올라가지 않게)
          const tabsBottom = tabsBox.getBoundingClientRect().bottom;
          const top = listTop() < tabsBottom ? tabsBottom : -Infinity;
          const bottom = scroller === panel ? panel.getBoundingClientRect().bottom : window.innerHeight;
          const speed = edgeScroll(lastY, top, bottom);
          if (speed) { scroller.scrollTop += speed; update(); }
          frame = requestAnimationFrame(tick);
        };
        const onMove = (ev) => { lastY = ev.clientY; update(); };
        const onUp = async () => {
          cancelAnimationFrame(frame);
          handle.removeEventListener('pointermove', onMove);
          rows.forEach((r) => r.classList.remove('drop-before', 'drop-after', 'dragging'));
          item.style.transition = ''; item.style.transform = '';
          state.dragging = false;
          if (to !== from) {
            haptic('medium');
            try { await reorderPlaces(tripId, reorderUpdates(places, from, to)); }
            catch (err) { console.error(err); toast('순서를 바꾸지 못했어요', { kind: 'error' }); }
          }
          if (state.pending) { state.pending = false; redraw(); }
        };
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp, { once: true });
        handle.addEventListener('pointercancel', onUp, { once: true });
        frame = requestAnimationFrame(tick);
      });
    });
  }

  function timelineItem(p, index, est) {
    if (isNote(p)) {
      return el('div', { class: `tl-item tl-note${p.id === state.highlightId ? ' active' : ''}`, dataset: { id: p.id, index: String(index) } },
        el('div', { class: 'tl-num tl-num-note' }, icon('edit')),
        el('div', { class: 'tl-body' },
          // 항목 전체를 누르는 투명 버튼 + 그 위의 링크 (버튼 안에 링크를 넣으면 잘못된 중첩이라 화면 낭독기·키보드가 헷갈린다)
          el('button', { type: 'button', class: 'tl-open', 'aria-label': `메모 ${p.name || '(내용 없음)'} 열기`, onClick: () => { highlight(p.id); openSheet({ dayId: p.dayId, place: p, kind: 'note' }); } }),
          el('div', { class: 'tl-meta' }, p.time && el('span', { class: 'muted', text: p.time }), el('span', { class: 'tag', text: '메모' })),
          el('div', { class: 'tl-name tl-note-text', text: p.name || '(내용 없음)' }),
          p.memo && el('div', { class: 'muted tl-memo' }, linkedText(p.memo, { firstLineOnly: true }))),
        el('button', { class: 'btn btn-icon drag-handle', 'aria-label': `${p.name || '메모'} 순서 옮기기, 위아래 화살표` }, icon('drag')));
    }
    const timeEl = p.time ? el('span', { class: 'muted', text: p.time })
      : est?.estimated ? el('span', { class: 'muted tl-est', title: '앞 장소의 시간·머무는 시간·도보 시간으로 추정', text: `도착 ~${est.time}` }) : null;
    return el('div', { class: `tl-item${p.id === state.highlightId ? ' active' : ''}`, dataset: { id: p.id, index: String(index) } },
      el('div', { class: 'tl-num', text: p.label }),
      el('div', { class: 'tl-body' },
        el('button', { type: 'button', class: 'tl-open', 'aria-label': `${p.name || '(이름 없음)'} 열기`, onClick: () => { map.focus(p.id); highlight(p.id); openSheet({ dayId: p.dayId, place: p }); } }),
        el('div', { class: 'tl-meta' },
          timeEl,
          el('span', { class: 'tag', text: CATEGORY_LABELS[p.category] ?? '기타' }),
          p.stayMinutes ? el('span', { class: 'muted', text: `${p.stayMinutes}분` }) : null,
          p.photoCount > 0 ? el('span', { class: 'tag', text: `사진 ${p.photoCount}` }) : null,
          ...state.reservations.filter((r) => linkedIds(r).includes(p.id)).map((r) => el('a', {
            class: 'badge badge-link', href: `#/trip/${tripId}/reservations/${r.id}`, title: r.title, text: '예약 ›',
          }))),
        el('div', { class: 'tl-name', text: p.name || '(이름 없음)' }),
        p.memo && el('div', { class: 'muted tl-memo' }, linkedText(p.memo, { firstLineOnly: true }))),
      el('button', { class: 'btn btn-icon drag-handle', 'aria-label': `${p.name || '장소'} 순서 옮기기, 위아래 화살표` }, icon('drag')));
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
