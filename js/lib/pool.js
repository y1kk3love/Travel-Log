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

// ---- 보관함 걸러 보기·묶기 (곳이 많아지면 찾기 어렵다) ----

// 주소에서 큰 지역 이름 하나를 고른다: 일본 "교토부·나라현·도쿄도", 한국 "서울특별시·강원특별자치도·경상북도" 등.
// 구글 한국어 주소("일본 교토부 교토시 …")와 OpenStreetMap 주소("…, 교토시, 교토부, 일본") 둘 다에서 같은 이름이 나온다.
// 못 찾으면 null (좌표만 붙여넣은 곳, 링크로 넣은 곳)
// 이름이 두 글자 이상인 것만 ("지도", "북부" 같은 낱말을 지역으로 읽지 않게)
const REGION_RE = /^[가-힣]{2,8}(?:특별자치도|특별자치시|특별시|광역시|도|부|현)$/;
const NOT_ADDRESS = /^(구글 지도 링크|붙여넣은 좌표)/; // 앱이 주소 자리에 적어 둔 안내 글
export function regionOf(address) {
  const text = String(address ?? '');
  if (NOT_ADDRESS.test(text)) return null;
  const tokens = text.split(/[\s,·]+/).filter(Boolean);
  return tokens.find((t) => REGION_RE.test(t)) ?? null;
}

// 보관함에 있는 분류와 곳 수 (많은 순). 걸러 보기 칩에 쓴다
export function poolCategories(places) {
  const counts = new Map();
  for (const p of places) counts.set(p.category ?? 'etc', (counts.get(p.category ?? 'etc') ?? 0) + 1);
  return [...counts].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
}

// 분류로 거른 뒤 지역별로 묶는다. 지역이 하나뿐이면 묶지 않는다(이름 없는 묶음 하나).
// 반환: [{ region: '교토부' | null, places: [...] }] — 곳이 많은 지역부터, 지역을 모르는 곳은 맨 끝 '기타'
export function groupPool(places, { category = null } = {}) {
  const shown = category ? places.filter((p) => (p.category ?? 'etc') === category) : places;
  const groups = new Map();
  for (const p of shown) {
    const region = regionOf(p.address);
    if (!groups.has(region)) groups.set(region, []);
    groups.get(region).push(p);
  }
  if (groups.size <= 1) return shown.length ? [{ region: null, places: shown }] : [];
  return [...groups].map(([region, list]) => ({ region: region ?? '기타', places: list, known: region != null }))
    .sort((a, b) => (b.known - a.known) || (b.places.length - a.places.length))
    .map(({ region, places: list }) => ({ region, places: list }));
}

// Firestore 배치는 한 번에 500개까지라 그 아래로 나눈다
export function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
