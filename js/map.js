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

  function setRoutes(groups, { fit = true } = {}) {
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
        marker.addTo(layer);
        markers.set(p.id, marker);
        all.push([p.lat, p.lng]);
      });
      if (pts.length > 1) {
        L.polyline(pts.map((p) => [p.lat, p.lng]), { color: ROUTE_COLOR, weight: 3, dashArray: '8 7', opacity: 0.9 }).addTo(layer);
      }
    }
    if (fit && all.length) map.fitBounds(L.latLngBounds(all), { padding: [48, 48], maxZoom: 15 });
  }

  function focus(placeId) {
    const marker = markers.get(placeId);
    if (!marker) return;
    map.panTo(marker.getLatLng());
    marker.openPopup();
  }

  return {
    setRoutes,
    focus,
    onSelect: (cb) => { selectCb = cb; },
    invalidate: () => map.invalidateSize(),
    destroy: () => map.remove(),
  };
}
