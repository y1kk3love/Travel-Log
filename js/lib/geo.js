const EARTH_RADIUS_KM = 6371;
const WALK_KMH = 4.5;
const WALK_LIMIT_KM = 3;

export function hasCoords(p) {
  return p != null && typeof p.lat === 'number' && typeof p.lng === 'number'
    && Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

export function distanceKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function walkMinutes(km) {
  return Math.max(1, Math.ceil((km / WALK_KMH) * 60));
}

// route: 저장된 구글 도보 경로 { seconds, meters } (있으면 직선 추정 대신 실제 길 기준으로 표시)
export function legLabel(a, b, route = null) {
  if (!hasCoords(a) || !hasCoords(b)) return null;
  if (route && Number.isFinite(route.seconds) && Number.isFinite(route.meters)) {
    return `도보 ${Math.max(1, Math.ceil(route.seconds / 60))}분 · ${(route.meters / 1000).toFixed(1)}km`;
  }
  const km = distanceKm(a, b);
  if (km <= WALK_LIMIT_KM) return `도보 ${walkMinutes(km)}분 · ${km.toFixed(1)}km`;
  return `거리 ${km.toFixed(1)}km`;
}

// 같은 자리(약 10m 안)에 있는 장소들을 한 핀으로 묶는다. 호텔처럼 여러 날 반복되는 장소가 겹쳐 보이지 않게.
// 반환: [{ lat, lng, items: [place, ...] }] (입력 순서 유지)
export function groupOverlapping(places) {
  const groups = new Map();
  for (const p of places) {
    if (!hasCoords(p)) continue;
    const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
    if (!groups.has(key)) groups.set(key, { lat: p.lat, lng: p.lng, items: [] });
    groups.get(key).items.push(p);
  }
  return [...groups.values()];
}
