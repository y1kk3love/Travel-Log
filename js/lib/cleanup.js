// 나중에 마저 지울 것 목록 (순수 함수, 테스트 대상).
// 장소·Day·예약을 지울 때 딸린 사진·서류는 "어떤 게 있는지" 먼저 읽어야 지울 수 있다. 오프라인이거나 망이 느려
// 기기 캐시로 읽으면, 이 기기에서 한 번도 안 연 사진은 목록에 없어 지워지지 않고 저장 공간만 차지한다.
// 그래서 캐시로 읽고 지운 경우에는 여기에 적어 두었다가, 연결되면 서버에서 다시 찾아 마저 지운다 (js/db.js sweepCleanups).
// 항목: { tripId, col: 'photos' | 'thumbs' | 'files', field: 'placeId' | 'reservationId', value }

const MAX = 200; // 끝없이 쌓이지 않게 (오래된 것부터 버린다)
const keyOf = (e) => `${e.tripId}/${e.col}/${e.field}/${e.value}`;
const valid = (e) => !!e && ['tripId', 'col', 'field', 'value'].every((k) => typeof e[k] === 'string' && e[k]);

export function addCleanup(list, entry) {
  if (!valid(entry)) return list;
  const rest = list.filter((e) => keyOf(e) !== keyOf(entry));
  return [...rest, { tripId: entry.tripId, col: entry.col, field: entry.field, value: entry.value }].slice(-MAX);
}

export function removeCleanup(list, entry) {
  return list.filter((e) => keyOf(e) !== keyOf(entry));
}

// 저장해 둔 글자(JSON)를 목록으로. 깨졌거나 모양이 다르면 빈 목록
export function parseCleanups(text) {
  try {
    const list = JSON.parse(text ?? '[]');
    return Array.isArray(list) ? list.filter(valid) : [];
  } catch { return []; }
}
