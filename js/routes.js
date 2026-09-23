// Routes API 로 실제 도보 경로를 받는다 (Compute Routes Essentials, 하루 한도 32건: 가장 비싼 등급의 월 무료 1,000건 ÷ 31일).
// 받은 경로는 호출한 쪽(planner)이 출발 장소 문서의 routeToNext 에 저장해 모든 기기·동행이 다시 묻지 않게 한다.
// "경로 없음"도 { key, none: true, at } 로 돌려주고 저장해 다시 묻지 않는다. 실패하면 null 이고 호출한 쪽이 직선으로 그린다.
import { MAPS_API_KEY } from './firebase-config.js';
import { decodePolyline, isFreshRoute } from './lib/polyline.js';
import { notifyQuota } from './quota.js';

const ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const inflight = new Map();
const memory = new Map(); // 이번 세션 안에서 같은 구간을 두 번 묻지 않는다 (경로 없음·한도 초과·요청 오류도 기억)

// 반환: { key, encoded, points: [[lat,lng],...], meters, seconds, at } | { key, none: true, at } | null
export async function walkingRoute(key, from, to) {
  if (memory.has(key)) return memory.get(key);
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
      if (res.status === 429) { notifyQuota('routes'); memory.set(key, null); return null; }
      if (!res.ok) { memory.set(key, null); throw new Error(`routes ${res.status}`); } // 같은 오류로 또 묻지 않게 (네트워크 오류는 다시 시도)
      const json = await res.json();
      const route = json.routes?.[0];
      const encoded = route?.polyline?.encodedPolyline;
      if (!encoded) { const none = { key, none: true, at: Date.now() }; memory.set(key, none); return none; }
      const out = {
        key, encoded, points: decodePolyline(encoded),
        meters: route.distanceMeters ?? null,
        seconds: route.duration ? Number(String(route.duration).replace('s', '')) : null,
        at: Date.now(),
      };
      memory.set(key, out);
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

// 장소 문서에 저장된 경로를 그릴 수 있는 형태로 (없거나 오래됐거나 구간이 바뀌었으면 null)
export function storedRoute(place, key, now = Date.now()) {
  const r = place?.routeToNext;
  if (!isFreshRoute(r, key, now)) return null;
  const points = decodePolyline(r.encoded);
  return points.length ? { ...r, points } : null;
}

export { isFreshRoute };
