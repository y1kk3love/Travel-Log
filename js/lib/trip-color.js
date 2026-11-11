// 대표 사진이 없는 여행 카드의 바탕색 (순수 함수, 테스트 대상).
// 여행마다 늘 같은 색조가 나오게 아이디로 고른다 — 회색 빈칸 대신 여행마다 다른 색으로 구분된다.

export function hashOf(text) {
  let h = 0;
  for (const ch of String(text ?? '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h;
}

// 0~359 색조. 밝기·채도는 CSS 가 밝은 화면·어두운 화면에 맞춰 정한다 (--cover-hue 만 넘긴다)
export function coverHue(tripId) {
  return hashOf(tripId) % 360;
}
