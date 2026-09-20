import { hasCoords } from './lib/geo.js';
import { escapeHtml } from './ui.js';

// Carto 무료 타일은 이제 API 키를 요구해서(타일에 "API KEY REQUIRED" 워터마크) OSM 표준 타일을 쓴다.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '© OpenStreetMap contributors';
const ROUTE_COLOR = '#B4502B';
const DEFAULT_VIEW = { center: [36.5, 127.8], zoom: 6 };

export function createMap(container) {
  const map = L.map(container, { zoomControl: true }).setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);
  L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
  const layer = L.layerGroup().addTo(map);
  let markers = new Map();
  let selectCb = null;
  let openPopupId = null;

  function setRoutes(groups, { fit = true } = {}) {
    const keepPopup = openPopupId; // 다시 그린 뒤에도 열려 있던 말풍선을 유지한다
    layer.clearLayers();
    markers = new Map();
    const all = [];
    for (const group of groups) {
      const pts = group.filter(hasCoords);
      pts.forEach((p) => {
        const marker = L.marker([p.lat, p.lng], {
          icon: L.divIcon({ className: 'pin-wrap', html: `<div class="pin">${escapeHtml(p.label)}</div>`, iconSize: [32, 32], iconAnchor: [16, 16] }),
        });
        marker.bindPopup(`<strong>${escapeHtml(p.name)}</strong>${p.time ? `<br><span class="muted">${escapeHtml(p.time)}</span>` : ''}`);
        marker.on('click', () => selectCb && selectCb(p.id));
        marker.on('popupopen', () => { openPopupId = p.id; });
        marker.on('popupclose', () => { if (openPopupId === p.id) openPopupId = null; });
        marker.addTo(layer);
        markers.set(p.id, marker);
        all.push([p.lat, p.lng]);
      });
      if (pts.length > 1) {
        L.polyline(pts.map((p) => [p.lat, p.lng]), { color: ROUTE_COLOR, weight: 3, dashArray: '8 7', opacity: 0.9 }).addTo(layer);
      }
    }
    if (fit && all.length) map.fitBounds(L.latLngBounds(all), { padding: [48, 48], maxZoom: 15 });
    if (keepPopup && markers.has(keepPopup)) markers.get(keepPopup).openPopup();
  }

  function focus(placeId) {
    const marker = markers.get(placeId);
    if (!marker) return;
    map.panTo(marker.getLatLng());
    marker.openPopup();
  }

  // ---- 내 위치 (GPS) ----
  // 경로 레이어와 별도 레이어에 그려서 setRoutes가 지워도 남는다.
  const meLayer = L.layerGroup().addTo(map);
  let watchId = null;
  let meDot = null;
  let meRing = null;

  function drawMe(lat, lng, accuracy, { center }) {
    if (!meDot) {
      meRing = L.circle([lat, lng], { radius: accuracy, color: '#3E5C8A', weight: 1, fillColor: '#3E5C8A', fillOpacity: 0.12 }).addTo(meLayer);
      meDot = L.circleMarker([lat, lng], { radius: 8, color: '#FFFDF9', weight: 3, fillColor: '#3E5C8A', fillOpacity: 1 }).addTo(meLayer);
      meDot.bindPopup('내 위치');
    } else {
      meRing.setLatLng([lat, lng]).setRadius(accuracy);
      meDot.setLatLng([lat, lng]);
    }
    if (center) map.setView([lat, lng], Math.max(map.getZoom(), 15));
  }

  function locateStart({ onError } = {}) {
    if (!('geolocation' in navigator)) { onError?.(new Error('unsupported')); return false; }
    if (watchId != null) return true;
    let first = true;
    watchId = navigator.geolocation.watchPosition(
      (pos) => { drawMe(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, { center: first }); first = false; },
      (err) => { locateStop(); onError?.(err); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return true;
  }

  function locateStop() {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    meLayer.clearLayers();
    meDot = null; meRing = null;
  }

  return {
    setRoutes,
    focus,
    locateStart,
    locateStop,
    isLocating: () => watchId != null,
    onSelect: (cb) => { selectCb = cb; },
    invalidate: () => map.invalidateSize(),
    destroy: () => { locateStop(); map.remove(); },
  };
}
