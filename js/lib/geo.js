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

// 직선거리 기준 표시 (실제 길은 일정의 "길찾기"로 본다)
export function legLabel(a, b) {
  if (!hasCoords(a) || !hasCoords(b)) return null;
  const km = distanceKm(a, b);
  if (km <= WALK_LIMIT_KM) return `도보 ${walkMinutes(km)}분 · ${km.toFixed(1)}km`;
  return `거리 ${km.toFixed(1)}km`;
}

// 지도 "내 위치"가 실패했을 때의 안내. 권한 거절(code 1)이면 앱은 폰 설정, 웹은 브라우저 설정으로 보낸다
export function locateErrorMessage(err, { native = false } = {}) {
  if (err?.code === 1) {
    return native ? '위치 권한이 꺼져 있어요. 폰 설정 → 앱 → 여행 로그 → 권한 → 위치에서 허용해 주세요'
      : '위치 권한이 꺼져 있어요. 브라우저 설정에서 허용해 주세요';
  }
  if (err?.message === 'unsupported') return '이 브라우저는 위치를 지원하지 않아요';
  return '위치를 가져오지 못했어요';
}

// 좌표가 있는 장소들을 순서대로 이어 구간 목록으로 만든다 (지도의 점선)
export function splitLegs(places) {
  const pts = places.filter(hasCoords);
  const legs = [];
  for (let i = 1; i < pts.length; i++) legs.push({ from: pts[i - 1], to: pts[i] });
  return legs;
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
