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

export function legLabel(a, b) {
  if (!hasCoords(a) || !hasCoords(b)) return null;
  const km = distanceKm(a, b);
  if (km <= WALK_LIMIT_KM) return `도보 ${walkMinutes(km)}분 · ${km.toFixed(1)}km`;
  return `거리 ${km.toFixed(1)}km`;
}
