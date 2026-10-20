// 지도: Google Maps JavaScript API (Dynamic Maps, 하루 로드 한도 320건).
// 한국어 지명은 로더의 language=ko 로 받는다. 장소 사이는 점선 직선으로 잇는다. 실제 길은 일정의 "길찾기"(구글 지도 앱·웹, 요금 없음)로 본다.
//
// 요청을 아끼는 규칙
// - 지도 인스턴스는 페이지 안에서 하나만 만들고(= 지도 로드 1건) 화면을 오갈 때 재사용한다.
import { importLibrary } from './gmaps.js';
import { groupOverlapping, splitLegs } from './lib/geo.js';
import { escapeHtml, toast } from './ui.js';
import { notifyQuota } from './quota.js';
import { MAPS_MAP_ID } from './firebase-config.js';
import { planEnter, markEnter } from './motion.js';

const ROUTE_COLOR = '#0A6CFF'; // css --accent 와 같은 파랑
const ME_COLOR = '#34C759';
const POOL_COLOR = '#8E8E93'; // 보관함(날짜 미정) 핀
const DEFAULT_VIEW = { center: { lat: 36.5, lng: 127.8 }, zoom: 6 };
const MAX_FIT_ZOOM = 15;

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
    colorScheme: g.ColorScheme?.FOLLOW_SYSTEM, // 다크 모드 폰에서는 어두운 지도 (처음 만들 때만 정할 수 있다)
    mapTypeControl: false, streetViewControl: false, fullscreenControl: false, rotateControl: false,
    cameraControl: false, zoomControl: true, keyboardShortcuts: false, clickableIcons: false,
    // 폰에서도 한 손가락으로 지도를 움직인다. cooperative(두 손가락)는 한 손가락이면 지도 대신 페이지가 움직이고, 두 손가락도
    // 첫 손가락이 먼저 움직이면 페이지가 같이 스크롤됐다. 폰의 지도는 230px 이라 페이지는 지도 밖을 끌어 스크롤한다
    gestureHandling: 'greedy', zoomControlOptions: { position: g.ControlPosition.RIGHT_TOP },
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

// pinScope: 이미 떨어진 핀을 기억하는 범위 (여행마다). 그 여행을 처음 열 때와 새 핀만 떨어진다
export function createMap(container, { pinScope = 'pins' } = {}) {
  let map = null;
  let g = null;
  let AdvancedMarkerElement = null;
  let infoWindow = null;
  let destroyed = false;
  const pending = [];
  let markers = new Map();
  let lines = [];
  let selectCb = null;
  let openPopupId = null;
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

  // 실제 길이 아니라는 뜻으로 점선 (실선이면 걸어갈 길처럼 보인다)
  function drawLine(from, to) {
    lines.push(new g.Polyline({
      map, path: [{ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }], strokeColor: ROUTE_COLOR, strokeOpacity: 0, strokeWeight: 4,
      icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, strokeWeight: 3, scale: 3 }, offset: '0', repeat: '14px' }],
    }));
  }

  function drawLegs(groups) {
    for (const group of groups) {
      for (const leg of splitLegs(group)) drawLine(leg.from, leg.to);
    }
  }

  // extras: 일정에 없는 장소(보관함) — 번호 없는 회색 핀, 경로에는 안 들어간다
  function setRoutes(groups, { fit = true, extras = [] } = {}) {
    whenReady(() => {
      const keepPopup = openPopupId;
      markers.forEach((m) => { m.marker.map = null; });
      markers = new Map();
      clearLines();
      const bounds = new g.LatLngBounds();
      // 새로 보이는 핀(처음 열 때·Day 를 바꿀 때·장소를 더할 때)만 번호 순서대로 톡톡 떨어진다. 시간만 고친 다시 그리기는 그대로
      const pools = groupOverlapping(extras);
      const spots = groupOverlapping(groups.flat());
      const pinKey = (items) => items.map((x) => x.id).join(',');
      const plan = planEnter(pinScope, [...pools, ...spots].map((x) => pinKey(x.items)));
      const drop = (content, items) => {
        const p = plan.get(pinKey(items));
        if (p) markEnter(content, 'drop', p);
        return content;
      };
      for (const p of pools) {
        const position = { lat: p.lat, lng: p.lng };
        const marker = new AdvancedMarkerElement({
          map, position, title: p.items.map((x) => x.name).join(', '), zIndex: 1, gmpClickable: true,
          content: drop(pinEl({ color: POOL_COLOR, diameter: 20, border: 2 }), p.items),
        });
        const entry = { marker, position, items: p.items.map((x) => ({ ...x, label: '보관' })) };
        onPinClick(marker, () => { openPopup(entry); selectCb && selectCb(p.items[0].id); });
        for (const x of p.items) markers.set(x.id, entry);
        bounds.extend(position);
      }
      // 같은 자리의 장소(여러 날 묵는 호텔 등)는 핀 하나에 "3·6" 처럼 번호를 모아 쓴다
      for (const spot of spots) {
        const label = spot.items.map((p) => p.label).filter(Boolean).join('·');
        const position = { lat: spot.lat, lng: spot.lng };
        const marker = new AdvancedMarkerElement({
          map, position, title: spot.items.map((p) => p.name).join(', '), gmpClickable: true, content: drop(numberPin(label), spot.items),
        });
        const entry = { marker, position, items: spot.items };
        onPinClick(marker, () => { openPopup(entry); selectCb && selectCb(spot.items[0].id); });
        for (const p of spot.items) markers.set(p.id, entry);
        bounds.extend(position);
      }
      drawLegs(groups);
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
      }
      map = null;
      if (shared && shared.div.parentNode === container) shared.div.remove();
    },
    ready,
  };
}
