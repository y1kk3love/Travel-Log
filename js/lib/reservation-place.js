// 예약 → 일정 장소 (순수 함수). 예약의 일시 날짜에 해당하는 Day 에 넣을 장소 필드를 만든다. 일시가 없거나 그 날짜의 Day 가 없으면 null.
const CATEGORY_BY_TYPE = { flight: 'move', stay: 'stay', food: 'food', etc: 'etc' };

export function placeFromReservation(r, days) {
  const m = String(r?.datetime ?? '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (!m) return null;
  const day = (days ?? []).find((d) => d.date === m[1]);
  if (!day) return null;
  const memo = r.type === 'flight'
    ? [r.flightNumber ? `편명 ${r.flightNumber}` : null, r.code ? `예약번호 ${r.code}` : null, r.note?.trim() || null].filter(Boolean).join(' · ')
    : String(r.note ?? '').trim();
  return { dayId: day.id, time: m[2], name: String(r.title ?? '').trim(), category: CATEGORY_BY_TYPE[r.type] ?? 'etc', memo };
}
