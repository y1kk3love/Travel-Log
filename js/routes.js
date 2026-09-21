// Routes API 로 실제 도보 경로를 받는다 (Compute Routes Essentials, 하루 한도 100건).
// 같은 구간은 localStorage 에 두고 다시 묻지 않는다. 실패하면 null 을 돌려주고 호출한 쪽이 직선으로 그린다.
import { MAPS_API_KEY } from './firebase-config.js';
import { decodePolyline } from './lib/polyline.js';

const ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const STORE_KEY = 'tl.routes.v1';
const MAX_CACHED = 400;
const inflight = new Map();
let store = null;

function loadStore() {
  if (store) return store;
  try { store = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { store = {}; }
  return store;
}

function saveStore() {
  try {
    const keys = Object.keys(store);
    if (keys.length > MAX_CACHED) for (const k of keys.slice(0, keys.length - MAX_CACHED)) delete store[k];
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch { /* 저장 공간이 없으면 캐시 없이 동작 */ }
}

// 반환: { points: [[lat,lng],...], meters, seconds } 또는 null
export async function walkingRoute(key, from, to) {
  const cache = loadStore();
  if (cache[key]) return cache[key];
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': MAPS_API_KEY,
          'X-Goog-FieldMask': 'routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration',
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
          destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
          travelMode: 'WALK',
          languageCode: 'ko',
          units: 'METRIC',
        }),
      });
      if (!res.ok) throw new Error(`routes ${res.status}`);
      const json = await res.json();
      const route = json.routes?.[0];
      if (!route?.polyline?.encodedPolyline) return null;
      const out = {
        points: decodePolyline(route.polyline.encodedPolyline),
        meters: route.distanceMeters ?? null,
        seconds: route.duration ? Number(String(route.duration).replace('s', '')) : null,
      };
      cache[key] = out;
      saveStore();
      return out;
    } catch (err) {
      console.warn('walkingRoute', err);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
