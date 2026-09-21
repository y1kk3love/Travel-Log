// 지도: Google Maps JavaScript API (Dynamic Maps, 하루 로드 한도 300건).
// 한국어 지명은 로더의 language=ko 로 받는다. 구간은 Routes API 도보 경로(3km 이하)로 그리고, 못 받으면 직선.
import { importLibrary } from './gmaps.js';
import { hasCoords, distanceKm } from './lib/geo.js';
import { splitLegs } from './lib/polyline.js';
import { walkingRoute } from './routes.js';
import { escapeHtml } from './ui.js';

const ROUTE_COLOR = '#B4502B';
const ME_COLOR = '#3E5C8A';
const DEFAULT_VIEW = { center: { lat: 36.5, lng: 127.8 }, zoom: 6 };
const MAX_FIT_ZOOM = 15;
const WALK_ROUTE_KM = 3; // 이보다 먼 구간은 (대중교통일 테니) 경로를 묻지 않고 직선으로

export function createMap(container) {
  let map = null;
  let g = null; // google.maps 네임스페이스 (로드 후)
  let destroyed = false;
  const pending = [];
  let markers = new Map();
  let lines = [];
  let selectCb = null;
  let openPopupId = null;
  let infoWindow = null;
  let routeGen = 0;

  const ready = (async () => {
    const [{ Map, InfoWindow }, { Marker }] = await Promise.all([importLibrary('maps'), importLibrary('marker')]);
    if (destroyed) return;
    g = globalThis.google.maps;
    map = new Map(container, {
      center: DEFAULT_VIEW.center, zoom: DEFAULT_VIEW.zoom,
      mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false,
      gestureHandling: 'greedy', zoomControlOptions: { position: g.ControlPosition.RIGHT_TOP },
    });
    g.__Marker = Marker;
    infoWindow = new InfoWindow({ headerDisabled: true });
    infoWindow.addListener('closeclick', () => { openPopupId = null; });
  })().catch((err) => { console.error('Google Maps 로드 실패', err); container.classList.add('map-failed'); throw err; })
    .then(() => { while (pending.length) pending.shift()(); }, () => {});

  const whenReady = (fn) => { if (map) fn(); else pending.push(fn); };

  function pinIcon(label) {
    const wide = label.length > 2;
    return {
      path: g.SymbolPath.CIRCLE, scale: wide ? 17 : 14,
      fillColor: ROUTE_COLOR, fillOpacity: 1, strokeColor: '#FFFDF9', strokeWeight: 3,
    };
  }

  function popupHtml(p) {
    return `<div class="map-popup"><strong>${escapeHtml(p.name)}</strong>${p.time ? `<br><span class="muted">${escapeHtml(p.time)}</span>` : ''}</div>`;
  }

  function openPopup(p, marker) {
    infoWindow.setContent(popupHtml(p));
    infoWindow.open({ map, anchor: marker });
    openPopupId = p.id;
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

  // 구간마다 먼저 직선(점선)을 긋고, 도보 경로가 오면 실선으로 바꾼다
  function drawLegs(groups, gen) {
    for (const group of groups) {
      for (const leg of splitLegs(group)) {
        const straight = [{ lat: leg.from.lat, lng: leg.from.lng }, { lat: leg.to.lat, lng: leg.to.lng }];
        const line = drawLine(straight, { dashed: true });
        if (distanceKm(leg.from, leg.to) > WALK_ROUTE_KM) continue;
        walkingRoute(leg.key, leg.from, leg.to).then((route) => {
          if (gen !== routeGen || !route?.points?.length || !lines.includes(line)) return;
          line.setOptions({ path: route.points.map(([lat, lng]) => ({ lat, lng })), strokeOpacity: 0.9, icons: [] });
        });
      }
    }
  }

  function setRoutes(groups, { fit = true } = {}) {
    whenReady(() => {
      const gen = ++routeGen;
      const keepPopup = openPopupId;
      markers.forEach((m) => m.marker.setMap(null));
      markers = new Map();
      clearLines();
      const bounds = new g.LatLngBounds();
      let count = 0;
      for (const group of groups) {
        for (const p of group.filter(hasCoords)) {
          const marker = new g.__Marker({
            map, position: { lat: p.lat, lng: p.lng }, icon: pinIcon(p.label ?? ''), title: p.name,
            label: { text: p.label ?? '', color: '#FFFDF9', fontSize: '12px', fontWeight: '700', fontFamily: 'inherit' },
          });
          marker.addListener('click', () => { openPopup(p, marker); selectCb && selectCb(p.id); });
          markers.set(p.id, { marker, place: p });
          bounds.extend(marker.getPosition());
          count++;
        }
      }
      drawLegs(groups, gen);
      if (fit && count) {
        map.fitBounds(bounds, 48);
        g.event.addListenerOnce(map, 'idle', () => { if (map.getZoom() > MAX_FIT_ZOOM) map.setZoom(MAX_FIT_ZOOM); });
      }
      if (keepPopup && markers.has(keepPopup)) { const { marker, place } = markers.get(keepPopup); openPopup(place, marker); }
      else openPopupId = null;
    });
  }

  function focus(placeId) {
    whenReady(() => {
      const entry = markers.get(placeId);
      if (!entry) return;
      map.panTo(entry.marker.getPosition());
      openPopup(entry.place, entry.marker);
    });
  }

  // ---- 내 위치 (GPS) ----
  let watchId = null;
  let meMarker = null;

  function drawMe(lat, lng, { center }) {
    whenReady(() => {
      if (!meMarker) {
        meMarker = new g.__Marker({
          map, position: { lat, lng }, clickable: false, zIndex: 1000,
          icon: { path: g.SymbolPath.CIRCLE, scale: 8, fillColor: ME_COLOR, fillOpacity: 1, strokeColor: '#FFFDF9', strokeWeight: 3 },
        });
      } else {
        meMarker.setPosition({ lat, lng });
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
    if (meMarker) { meMarker.setMap(null); meMarker = null; }
  }

  return {
    setRoutes,
    focus,
    locateStart,
    locateStop,
    isLocating: () => watchId != null,
    onSelect: (cb) => { selectCb = cb; },
    invalidate: () => { if (map) g.event.trigger(map, 'resize'); },
    destroy: () => {
      destroyed = true;
      locateStop();
      if (map) { markers.forEach((m) => m.marker.setMap(null)); clearLines(); infoWindow.close(); }
      map = null;
      container.replaceChildren();
    },
    ready,
  };
}
