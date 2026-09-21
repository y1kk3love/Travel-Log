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
