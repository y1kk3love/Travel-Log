// 보관함(날짜 미정)·배치 나누기 (순수 함수, 테스트 대상)

// 보관함에 보일 장소인가: 날짜가 없거나, 가리키는 Day 가 지워졌다.
// Day 를 지우는 사이 동행이 그 날에 넣은 장소는 어느 Day 에도 안 보였다 → 보관함에서 다시 날짜를 고를 수 있게.
// dayIds 는 지금 Day 아이디 모음. 아직 못 받았으면(null·빈 모음) 날짜 있는 장소를 보관함으로 보내지 않는다.
export function isPooled(place, dayIds) {
  if (place?.dayId == null) return true;
  if (!dayIds || dayIds.size === 0) return false;
  return !dayIds.has(place.dayId);
}

// 보관함 목록: 날짜 미정 장소와, 지워진 Day 를 가리키는 장소·메모. 있는 Day 의 메모는 그 Day 에 보이고,
// 날짜 없는 메모는 만들지 않으므로 메모는 Day 가 지워졌을 때만 여기로 온다.
export function poolPlaces(places, dayIds) {
  return places.filter((p) => isPooled(p, dayIds) && (p.category !== 'note' || p.dayId != null));
}

// Firestore 배치는 한 번에 500개까지라 그 아래로 나눈다
export function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
