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

// 예약 하나 → 장소 여러 개. 숙소에 체크아웃이 있으면 체크인 날부터 체크아웃 날까지 Day 마다:
// 첫날 "체크인"(체크인 시각), 중간 "숙박"(시각 없음 → 그 날 끝), 마지막 "체크아웃"(체크아웃 시각). 여행 밖 날짜는 건너뛴다.
// 그 외(또는 체크아웃 없음)는 placeFromReservation 하나.
export function placesFromReservation(r, days) {
  const first = placeFromReservation(r, days);
  const co = String(r?.checkout ?? '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  const ci = String(r?.datetime ?? '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (r?.type !== 'stay' || !co || !ci || co[1] <= ci[1]) return first ? [first] : [];
  const memo = String(r.note ?? '').trim() || (r.code ? `예약번호 ${r.code}` : '');
  const title = String(r.title ?? '').trim();
  return (days ?? [])
    .filter((d) => d.date >= ci[1] && d.date <= co[1])
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => (d.date === ci[1] ? { dayId: d.id, time: ci[2], name: `${title} 체크인`, category: 'stay', memo }
      : d.date === co[1] ? { dayId: d.id, time: co[2], name: `${title} 체크아웃`, category: 'stay', memo }
        : { dayId: d.id, time: null, name: `${title} 숙박`, category: 'stay', memo }));
}
