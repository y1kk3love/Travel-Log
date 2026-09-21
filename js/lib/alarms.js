// 다음 목적지 알림 계산 (순수 함수). 오늘·내일 Day 의 시각 있는 장소마다 "출발 시각"을 만든다.
import { estimateTimes, walkMinutesBetween } from './timeline.js';
import { toDateStr, addDays } from './dates.js';

const LEAD_MIN = 10;
const MAX_ALARMS = 20;

export function alarmId(placeId) {
  let h = 2166136261;
  for (const ch of String(placeId)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return (h % 2147483646) + 1;
}

function atLocal(dateStr, hhmm) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

export function planAlarms({ trips, placesByTrip, daysByTrip }, now = new Date()) {
  const today = toDateStr(now);
  const tomorrow = addDays(today, 1);
  const out = [];
  for (const trip of trips) {
    const days = (daysByTrip[trip.id] ?? []).filter((d) => d.date === today || d.date === tomorrow);
    for (const day of days) {
      const places = (placesByTrip[trip.id] ?? []).filter((p) => p.dayId === day.id).sort((a, b) => a.order - b.order);
      const times = estimateTimes(places, now.getTime());
      let prev = null;
      places.forEach((p, i) => {
        if (p.category === 'note') return;
        const t = times[i]?.time;
        if (!t) return; // 시각을 못 정한 장소는 출발지로도 치지 않는다 (estimateTimes 와 같은 규칙)
        const walk = walkMinutesBetween(prev, p, now.getTime());
        const at = atLocal(day.date, t) - (walk + LEAD_MIN) * 60000;
        if (at > now.getTime()) {
          out.push({
            id: alarmId(p.id), tripId: trip.id, placeId: p.id, at,
            title: `곧 출발: ${p.name || '(이름 없음)'}`,
            body: prev && walk > 0 ? `${t} 도착 예정 · 도보 ${walk}분` : `${t} 예정`,
          });
        }
        prev = p;
      });
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, MAX_ALARMS);
}
