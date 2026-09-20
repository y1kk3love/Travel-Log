// 붙여넣은 텍스트(Google 지도 링크, "위도, 경도")에서 좌표를 뽑는다. 검색어면 null.
const NUM = '(-?\\d{1,3}(?:\\.\\d+)?)';
const PATTERNS = [
  new RegExp(`!3d${NUM}!4d${NUM}`),                 // 장소 링크의 핀 좌표 (가장 정확)
  new RegExp(`[?&](?:q|query|ll|center)=${NUM}(?:,|%2C)${NUM}`, 'i'), // q=, query=, ll=
  new RegExp(`@${NUM},${NUM}`),                     // 지도 중심 @위도,경도
  new RegExp(`^\\s*${NUM}\\s*[,\\s]\\s*${NUM}\\s*$`), // "34.9671, 135.7727"
];

function valid(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function parseCoordsInput(text) {
  const s = String(text ?? '').trim();
  if (!s) return null;
  for (const re of PATTERNS) {
    const m = s.match(re);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (valid(lat, lng)) return { lat, lng };
  }
  return null;
}

export function googleMapsSearchUrl(query) {
  const q = String(query ?? '').trim();
  if (!q) return 'https://www.google.com/maps';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
