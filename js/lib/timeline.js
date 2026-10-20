import { hasCoords, distanceKm, walkMinutes } from './geo.js';

// 두 장소 사이 도보 분: 직선거리 추정, 같은 자리(10m 안)면 0. 좌표가 없으면 0.
// 예전 앱이 장소에 저장한 구글 도보 경로(routeToNext)는 쓰지 않는다 (구간마다 기준이 달라지지 않게).
export function walkMinutesBetween(from, to) {
  if (!from || !to || !hasCoords(from) || !hasCoords(to)) return 0;
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
// 도보 시간은 직선거리 추정 (walkMinutesBetween).
export function estimateTimes(places) {
  let prev = null; // { time, stay, place }
  return places.map((p) => {
    if (p.category === 'note') return { id: p.id, time: p.time ?? null, estimated: false };
    if (p.time) { prev = { time: p.time, place: p }; return { id: p.id, time: p.time, estimated: false }; }
    if (!prev) return { id: p.id, time: null, estimated: false };
    const walk = walkMinutesBetween(prev.place, p);
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
