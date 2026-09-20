import { hasCoords, distanceKm, walkMinutes } from './geo.js';

export function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// 시간이 비어 있는 장소의 도착 시각을 추정한다: 이전 장소 시각 + 머무는 시간 + 도보 시간.
// 메모 항목(category 'note')은 건너뛰고, 앞에 시각이 있는 장소가 없으면 추정하지 않는다.
// 반환: [{ id, time, estimated }]
export function estimateTimes(places) {
  let prev = null; // { time, stay, place }
  return places.map((p) => {
    if (p.category === 'note') return { id: p.id, time: p.time ?? null, estimated: false };
    if (p.time) { prev = { time: p.time, place: p }; return { id: p.id, time: p.time, estimated: false }; }
    if (!prev) return { id: p.id, time: null, estimated: false };
    const km = hasCoords(prev.place) && hasCoords(p) ? distanceKm(prev.place, p) : 0;
    const walk = km > 0.01 ? walkMinutes(km) : 0; // 같은 자리면 이동 시간 0
    const time = addMinutes(prev.time, (prev.place.stayMinutes ?? 0) + walk);
    prev = { time, place: p };
    return { id: p.id, time, estimated: true };
  });
}
