// 예약 ↔ 일정(장소) 연결 (순수 함수, 테스트 대상).
// 기준은 linkedPlaceIds(숙소 여러 박이면 여러 개). linkedPlaceId 는 예전 문서·화면 호환용으로 첫 연결과 같게 둔다.

// 예약에 연결된 장소 아이디들 (예전 문서의 linkedPlaceId 도 함께 본다)
export function linkedIds(r) {
  return [...new Set([...(r?.linkedPlaceIds ?? []), ...(r?.linkedPlaceId ? [r.linkedPlaceId] : [])])];
}

// 편집 창에서 고른 연결(select 값)을 반영한 새 목록.
// '' 이면 전부 끊고, 지금 첫 연결을 그대로 두면 여러 박 연결을 지키고, 다른 장소면 그 하나로 바꾼다.
export function chooseLink(current, selected) {
  if (!selected) return [];
  if (current[0] === selected) return current;
  return [selected];
}

// 장소가 지워졌을 때 그 장소를 뺀 연결 목록
export function withoutPlaces(r, placeIds) {
  const gone = new Set(placeIds);
  return linkedIds(r).filter((id) => !gone.has(id));
}

// 예약 문서에 저장할 연결 필드
export function linkFields(ids) {
  return { linkedPlaceIds: ids, linkedPlaceId: ids[0] ?? null };
}
