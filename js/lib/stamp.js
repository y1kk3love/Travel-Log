// 여권 도장 글자 (순수 함수): 제목의 첫 도시("후쿠오카 · 벳푸" → 후쿠오카)와 시작 연월(2025.01)
export function stampLabel(trip) {
  const first = String(trip?.title ?? '').split(/\s*[·,|]\s*/)[0].trim().split(/\s+/)[0];
  const [y, m] = String(trip?.startDate ?? '').split('-');
  return { city: first || '여행', date: y && m ? `${y}.${m}` : '' };
}
