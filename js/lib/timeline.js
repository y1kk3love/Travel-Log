import { hasCoords, distanceKm, walkMinutes } from './geo.js';
import { legKey, isFreshRoute } from './polyline.js';

// 앞 장소에 저장된 구글 도보 경로가 이 구간(from→to)의 것이고 30일 안이면 돌려준다
export function routeBetween(from, to, now = Date.now()) {
  if (!hasCoords(from) || !hasCoords(to)) return null;
  const r = from.routeToNext;
  return isFreshRoute(r, legKey(from, to), now) ? r : null;
}

// 두 장소 사이 도보 분: 저장된 구글 경로(routeToNext)가 있으면 그것, 없으면 직선거리 추정, 같은 자리(10m 안)면 0. 좌표가 없으면 0.
export function walkMinutesBetween(from, to, now = Date.now()) {
  if (!from || !to || !hasCoords(from) || !hasCoords(to)) return 0;
  const route = routeBetween(from, to, now);
  if (route && Number.isFinite(route.seconds)) return Math.ceil(route.seconds / 60);
  const km = distanceKm(from, to);
  return km > 0.01 ? walkMinutes(km) : 0;
}

export function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// 시간이 비어 있는 장소의 도착 시각을 추정한다: 이전 장소 시각 + 머무는 시간 + 도보 시간.
// 메모 항목(category 'note')은 건너뛰고, 앞에 시각이 있는 장소가 없으면 추정하지 않는다.
// 반환: [{ id, time, estimated }]
// 도보 시간은 저장된 구글 경로(routeToNext)가 있으면 그것을, 없으면 직선거리 추정을 쓴다.
export function estimateTimes(places, now = Date.now()) {
  let prev = null; // { time, stay, place }
  return places.map((p) => {
    if (p.category === 'note') return { id: p.id, time: p.time ?? null, estimated: false };
    if (p.time) { prev = { time: p.time, place: p }; return { id: p.id, time: p.time, estimated: false }; }
    if (!prev) return { id: p.id, time: null, estimated: false };
    const walk = walkMinutesBetween(prev.place, p, now);
    const time = addMinutes(prev.time, (prev.place.stayMinutes ?? 0) + walk);
    prev = { time, place: p };
    return { id: p.id, time, estimated: true };
  });
}

// 오늘 모드: 지금 시각 기준으로 "지금 있는 곳"과 "다음 갈 곳"을 고른다.
// times 는 estimateTimes() 결과(같은 순서). 시각이 있는(입력 또는 추정) 장소만 후보. 메모는 제외.
// 반환: { currentIndex, nextIndex, done } (done: 오늘 일정이 모두 지남)
export function pickNext(places, times, nowHHMM) {
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const now = toMin(nowHHMM);
  let currentIndex = null;
  let nextIndex = null;
  places.forEach((p, i) => {
    if (p.category === 'note' || !times[i]?.time) return;
    const t = toMin(times[i].time);
    if (t <= now) currentIndex = i;
    else if (nextIndex == null) nextIndex = i;
  });
  const anyTimed = places.some((p, i) => p.category !== 'note' && times[i]?.time);
  return { currentIndex, nextIndex, done: anyTimed && nextIndex == null };
}
