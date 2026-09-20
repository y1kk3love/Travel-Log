// 지도: MapLibre GL + OpenFreeMap 벡터 타일 (키·카드 불필요).
// 벡터 타일이라 지명을 글자로 받으므로 "한국어 → 영어 → 현지어" 순으로 표기한다.
import * as maplibregl from 'https://cdn.jsdelivr.net/npm/maplibre-gl@6.10.0/dist/maplibre-gl.mjs';
import { hasCoords } from './lib/geo.js';
import { escapeHtml } from './ui.js';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const ROUTE_COLOR = '#B4502B';
const DEFAULT_VIEW = { center: [127.8, 36.5], zoom: 5.5 };
const LABEL_EXPR = ['coalesce', ['get', 'name:ko'], ['get', 'name:en'], ['get', 'name']];

export function createMap(container) {
  const map = new maplibregl.Map({
    container, style: STYLE_URL, center: DEFAULT_VIEW.center, zoom: DEFAULT_VIEW.zoom,
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

  // 스타일이 (다시) 로드될 때마다 라벨 언어를 한국어 우선으로 바꾸고 경로 레이어를 준비한다
  let ready = false;
  const pendingRoutes = [];
  map.on('style.load', () => {
    for (const layer of map.getStyle().layers) {
      if (layer.layout && layer.layout['text-field']) map.setLayoutProperty(layer.id, 'text-field', LABEL_EXPR);
    }
    if (!map.getSource('routes')) {
      map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'routes-line', type: 'line', source: 'routes',
        paint: { 'line-color': ROUTE_COLOR, 'line-width': 3, 'line-opacity': 0.9, 'line-dasharray': [2, 1.6] },
        layout: { 'line-join': 'round', 'line-cap': 'round' } });
    }
    ready = true;
    while (pendingRoutes.length) pendingRoutes.shift()();
  });

  let markers = new Map();
  let selectCb = null;
  let openPopupId = null;

  function makePin(label) {
    const el = document.createElement('div');
    el.className = 'pin';
    el.textContent = label;
    return el;
  }

  function setRoutes(groups, { fit = true } = {}) {
    if (!ready) { pendingRoutes.push(() => setRoutes(groups, { fit })); return; }
    const keepPopup = openPopupId;
    markers.forEach((m) => m.remove());
    markers = new Map();
    const all = [];
    const features = [];
    for (const group of groups) {
      const pts = group.filter(hasCoords);
      pts.forEach((p) => {
        const popup = new maplibregl.Popup({ offset: 18, closeButton: false })
          .setHTML(`<strong>${escapeHtml(p.name)}</strong>${p.time ? `<br><span class="muted">${escapeHtml(p.time)}</span>` : ''}`);
        popup.on('open', () => { openPopupId = p.id; });
        popup.on('close', () => { if (openPopupId === p.id) openPopupId = null; });
        const el = makePin(p.label);
        el.addEventListener('click', () => selectCb && selectCb(p.id));
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map);
        markers.set(p.id, marker);
        all.push([p.lng, p.lat]);
      });
      if (pts.length > 1) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: pts.map((p) => [p.lng, p.lat]) } });
    }
    map.getSource('routes').setData({ type: 'FeatureCollection', features });
    if (fit && all.length) {
      const bounds = all.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(all[0], all[0]));
      map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 500 });
    }
    if (keepPopup && markers.has(keepPopup)) markers.get(keepPopup).togglePopup();
  }

  function focus(placeId) {
    const marker = markers.get(placeId);
    if (!marker) return;
    map.easeTo({ center: marker.getLngLat(), duration: 400 });
    if (!marker.getPopup().isOpen()) marker.togglePopup();
  }

  // ---- 내 위치 (GPS) ----
  let watchId = null;
  let meMarker = null;

  function drawMe(lat, lng, { center }) {
    if (!meMarker) {
      const el = document.createElement('div');
      el.className = 'me-dot';
      meMarker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
    } else {
      meMarker.setLngLat([lng, lat]);
    }
    if (center) map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15), duration: 600 });
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
    if (meMarker) { meMarker.remove(); meMarker = null; }
  }

  return {
    setRoutes,
    focus,
    locateStart,
    locateStop,
    isLocating: () => watchId != null,
    onSelect: (cb) => { selectCb = cb; },
    invalidate: () => map.resize(),
    destroy: () => { locateStop(); map.remove(); },
  };
}
