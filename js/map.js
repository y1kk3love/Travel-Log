// 지도: Google Maps JavaScript API (Dynamic Maps, 하루 로드 한도 320건).
// 한국어 지명은 로더의 language=ko 로 받는다. 구간은 Routes API 도보 경로(3km 이하)로 그리고, 못 받으면 직선.
//
// 요청을 아끼는 규칙
// - 지도 인스턴스는 페이지 안에서 하나만 만들고(= 지도 로드 1건) 화면을 오갈 때 재사용한다.
// - 구간 경로는 출발 장소 문서(routeToNext)에 30일간 저장된 것을 먼저 쓰고, 없을 때만 Routes API 를 부른다.
import { importLibrary } from './gmaps.js';
import { distanceKm, groupOverlapping } from './lib/geo.js';
import { splitLegs } from './lib/polyline.js';
import { walkingRoute, storedRoute } from './walk-routes.js';
import { isKnownNoRoute } from './lib/polyline.js';
import { escapeHtml, toast } from './ui.js';
import { notifyQuota } from './quota.js';
import { MAPS_MAP_ID } from './firebase-config.js';

const ROUTE_COLOR = '#0A6CFF'; // css --accent 와 같은 파랑
const ME_COLOR = '#34C759';
const POOL_COLOR = '#8E8E93'; // 보관함(날짜 미정) 핀
const DEFAULT_VIEW = { center: { lat: 36.5, lng: 127.8 }, zoom: 6 };
const MAX_FIT_ZOOM = 15;
const WALK_ROUTE_KM = 3; // 이보다 먼 구간은 (대중교통일 테니) 경로를 묻지 않고 직선으로

// 페이지 전체에서 공유하는 지도 인스턴스 (탭을 오가도 다시 만들지 않는다)
let shared = null; // { div, map, g, AdvancedMarkerElement, infoWindow }

async function acquireMap(container) {
  if (shared) {
    container.replaceChildren(shared.div);
    shared.g.event.trigger(shared.map, 'resize');
    return shared;
  }
  const [{ Map, InfoWindow }, { AdvancedMarkerElement }] = await Promise.all([importLibrary('maps'), importLibrary('marker')]);
  const g = globalThis.google.maps;
  const div = document.createElement('div');
  div.className = 'map-canvas';
  container.replaceChildren(div);
  // 화면을 어지럽히는 컨트롤은 끈다. Google 로고와 지도 데이터 저작권·약관 표시는 약관상 남겨야 한다.
  const map = new Map(div, {
    center: DEFAULT_VIEW.center, zoom: DEFAULT_VIEW.zoom, tilt: 0, mapId: MAPS_MAP_ID, // 지도 ID 가 있어야 새 방식 핀을 쓸 수 있다
    mapTypeControl: false, streetViewControl: false, fullscreenControl: false, rotateControl: false,
    cameraControl: false, zoomControl: true, keyboardShortcuts: false, clickableIcons: false,
    // 폰: 한 손가락은 페이지 스크롤, 지도는 두 손가락 (지도 위에서 페이지가 안 내려가던 것). 마우스는 그대로
    gestureHandling: globalThis.matchMedia?.('(pointer: coarse)').matches ? 'cooperative' : 'greedy', zoomControlOptions: { position: g.ControlPosition.RIGHT_TOP },
  });
  const infoWindow = new InfoWindow({ headerDisabled: true });
  shared = { div, map, g, AdvancedMarkerElement, infoWindow };
  watchMapErrors(div);
  return shared;
}

// Google 지도는 한도 초과·키 문제일 때 지도 위에 회색 오류 상자(.gm-err-container)를 띄운다. 그걸 보고 안내한다.
function watchMapErrors(div) {
  const check = () => {
    const box = div.querySelector('.gm-err-container');
    if (!box) return false;
    const text = box.textContent || '';
    if (/OverQuota|한도|quota/i.test(text) || !/키|key|referer|referrer|권한/i.test(text)) notifyQuota('map');
    else toast('지도 키 설정에 문제가 있어요. 사이트 주인에게 알려 주세요', { kind: 'error', ms: 8000 });
    return true;
  };
  const observer = new MutationObserver(() => { if (check()) observer.disconnect(); });
  observer.observe(div, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 60000);
}

export function createMap(container) {
  let map = null;
  let g = null;
  let AdvancedMarkerElement = null;
  let infoWindow = null;
  let destroyed = false;
  const pending = [];
  let markers = new Map();
  let lines = [];
  let selectCb = null;
  let routeCb = null;
  let openPopupId = null;
  let routeGen = 0;
  let closeListener = null;

  const ready = acquireMap(container)
    .then((s) => {
      if (destroyed) return;
      ({ map, g, AdvancedMarkerElement, infoWindow } = s);
      infoWindow.close();
      closeListener = infoWindow.addListener('closeclick', () => { openPopupId = null; });
      while (pending.length) pending.shift()();
    })
    .catch((err) => { console.error('Google Maps 로드 실패', err); container.classList.add('map-failed'); });

  const whenReady = (fn) => { if (map) fn(); else pending.push(fn); };

  // 핀: 폐지 예정인 google.maps.Marker 대신 AdvancedMarkerElement 에 넣을 동그라미 요소 (예전 원형 기호와 같은 모양)
  // 새 방식 핀은 요소의 아래 가운데가 좌표에 오므로, 원의 가운데가 좌표에 오게 반만큼 내린다 (.map-pin CSS)
  function pinEl({ label = '', color = ROUTE_COLOR, diameter, border = 3 }) {
    const d = document.createElement('div');
    d.className = 'map-pin';
    d.style.cssText = `--pin:${color}; width:${diameter}px; height:${diameter}px; border-width:${border}px; font-size:${label.length > 4 ? 10 : 12}px`;
    d.textContent = label;
    return d;
  }
  function numberPin(label) {
    const radius = label.length <= 2 ? 14 : label.length <= 4 ? 18 : 22;
    return pinEl({ label, diameter: radius * 2 + 3 }); // 예전 원형 기호(반지름+테두리)와 같은 크기
  }
  const onPinClick = (marker, fn) => marker.addListener('gmp-click', fn);

  // 한 핀에 묶인 장소들을 모두 보여주고, 방금 고른 장소를 굵게
  function popupHtml(items, highlightId) {
    const rows = items.map((p) => {
      const meta = p.time ? ` <span class="muted">${escapeHtml(p.time)}</span>` : '';
      const line = `${p.label ? `<span class="map-popup-num">${escapeHtml(p.label)}</span> ` : ''}${escapeHtml(p.name)}${meta}`;
      return `<div class="map-popup-row${p.id === highlightId ? ' active' : ''}">${line}</div>`;
    });
    return `<div class="map-popup">${rows.join('')}</div>`;
  }

  function openPopup(entry, highlightId = entry.items[0]?.id) {
    infoWindow.setContent(popupHtml(entry.items, highlightId));
    infoWindow.open({ map, anchor: entry.marker });
    openPopupId = highlightId;
  }

  function clearLines() {
    lines.forEach((l) => l.setMap(null));
    lines = [];
  }

  function drawLine(path, { dashed }) {
    const line = new g.Polyline({
      map, path, strokeColor: ROUTE_COLOR, strokeOpacity: dashed ? 0 : 0.9, strokeWeight: 4,
      icons: dashed ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, strokeWeight: 3, scale: 3 }, offset: '0', repeat: '14px' }] : [],
    });
    lines.push(line);
    return line;
  }

  const toPath = (points) => points.map(([lat, lng]) => ({ lat, lng }));

  // 구간마다: 저장된 경로가 있으면 바로 실선, 없으면 점선을 긋고 Routes API 결과가 오면 실선으로 바꾼다
  function drawLegs(groups, gen) {
    for (const group of groups) {
      for (const leg of splitLegs(group)) {
        const stored = storedRoute(leg.from, leg.key);
        if (stored) { drawLine(toPath(stored.points), { dashed: false }); continue; }
        const line = drawLine([{ lat: leg.from.lat, lng: leg.from.lng }, { lat: leg.to.lat, lng: leg.to.lng }], { dashed: true });
        if (distanceKm(leg.from, leg.to) > WALK_ROUTE_KM) continue;
        if (isKnownNoRoute(leg.from.routeToNext, leg.key)) continue; // 도보 경로가 없다고 저장된 구간은 다시 묻지 않는다
        walkingRoute(leg.key, leg.from, leg.to).then((route) => {
          if (route?.none) { routeCb?.(leg.from.id, { key: route.key, none: true, at: route.at }); return; }
          if (!route?.points?.length) return;
          if (gen === routeGen && lines.includes(line)) line.setOptions({ path: toPath(route.points), strokeOpacity: 0.9, icons: [] });
          routeCb?.(leg.from.id, { key: route.key, encoded: route.encoded, meters: route.meters, seconds: route.seconds, at: route.at });
        });
      }
    }
  }

  // extras: 일정에 없는 장소(보관함) — 번호 없는 회색 핀, 경로에는 안 들어간다
  function setRoutes(groups, { fit = true, extras = [] } = {}) {
    whenReady(() => {
      const gen = ++routeGen;
      const keepPopup = openPopupId;
      markers.forEach((m) => { m.marker.map = null; });
      markers = new Map();
      clearLines();
      const bounds = new g.LatLngBounds();
      for (const p of groupOverlapping(extras)) {
        const position = { lat: p.lat, lng: p.lng };
        const marker = new AdvancedMarkerElement({
          map, position, title: p.items.map((x) => x.name).join(', '), zIndex: 1, gmpClickable: true,
          content: pinEl({ color: POOL_COLOR, diameter: 20, border: 2 }),
        });
        const entry = { marker, position, items: p.items.map((x) => ({ ...x, label: '보관' })) };
        onPinClick(marker, () => { openPopup(entry); selectCb && selectCb(p.items[0].id); });
        for (const x of p.items) markers.set(x.id, entry);
        bounds.extend(position);
      }
      // 같은 자리의 장소(여러 날 묵는 호텔 등)는 핀 하나에 "3·6" 처럼 번호를 모아 쓴다
      const spots = groupOverlapping(groups.flat());
      for (const spot of spots) {
        const label = spot.items.map((p) => p.label).filter(Boolean).join('·');
        const position = { lat: spot.lat, lng: spot.lng };
        const marker = new AdvancedMarkerElement({
          map, position, title: spot.items.map((p) => p.name).join(', '), gmpClickable: true, content: numberPin(label),
        });
        const entry = { marker, position, items: spot.items };
        onPinClick(marker, () => { openPopup(entry); selectCb && selectCb(spot.items[0].id); });
        for (const p of spot.items) markers.set(p.id, entry);
        bounds.extend(position);
      }
      drawLegs(groups, gen);
      if (fit && (spots.length || extras.length)) {
        map.fitBounds(bounds, 48);
        g.event.addListenerOnce(map, 'idle', () => { if (map.getZoom() > MAX_FIT_ZOOM) map.setZoom(MAX_FIT_ZOOM); });
      }
      if (keepPopup && markers.has(keepPopup)) openPopup(markers.get(keepPopup), keepPopup);
      else openPopupId = null;
    });
  }

  function focus(placeId) {
    whenReady(() => {
      const entry = markers.get(placeId);
      if (!entry) return;
      map.panTo(entry.position);
      openPopup(entry, placeId);
    });
  }

  // ---- 내 위치 (GPS) ----
  let watchId = null;
  let meMarker = null;

  function drawMe(lat, lng, { center }) {
    whenReady(() => {
      if (!meMarker) {
        meMarker = new AdvancedMarkerElement({
          map, position: { lat, lng }, zIndex: 1000, title: '내 위치',
          content: pinEl({ color: ME_COLOR, diameter: 19, border: 3 }),
        });
      } else {
        meMarker.position = { lat, lng };
      }
      if (center) { map.panTo({ lat, lng }); if (map.getZoom() < 15) map.setZoom(15); }
    });
  }

  function locateStart({ onError } = {}) {
    if (!('geolocation' in navigator)) { onError?.(new Error('unsupported')); return false; }
    if (watchId != null) return true;
    let first = true;
    watchId = navigator.geolocation.watchPosition(
      (pos) => { drawMe(pos.coords.latitude, pos.coords.longitude, { center: first }); first = false; },
      (err) => { locateStop(); onError?.(err); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return true;
  }

  function locateStop() {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    if (meMarker) { meMarker.map = null; meMarker = null; }
  }

  return {
    setRoutes,
    focus,
    locateStart,
    locateStop,
    isLocating: () => watchId != null,
    onSelect: (cb) => { selectCb = cb; },
    // Routes API 에서 새로 받은 구간 경로를 알려준다 (출발 장소 id, 저장용 route). 호출한 쪽이 문서에 저장한다.
    onRoute: (cb) => { routeCb = cb; },
    invalidate: () => { if (map) g.event.trigger(map, 'resize'); },
    // 공유 지도는 없애지 않고 마커·선만 걷어낸 뒤 화면에서 떼어 둔다 (다음에 다시 붙여 쓴다)
    destroy: () => {
      destroyed = true;
      locateStop();
      if (map) {
        markers.forEach((m) => { m.marker.map = null; });
        markers = new Map();
        clearLines();
        infoWindow.close();
        closeListener?.remove();
        routeGen++;
      }
      map = null;
      if (shared && shared.div.parentNode === container) shared.div.remove();
    },
    ready,
  };
}
