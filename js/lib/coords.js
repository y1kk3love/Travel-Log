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

// Google 지도 앱 '공유'로 복사되는 짧은 링크(maps.app.goo.gl 등)에는 좌표가 없다.
// 대신 함께 복사되는 "이름 · 주소" 텍스트에서 이름을 뽑아 검색어로 쓴다.
// 반환: { link, name } (name 은 없으면 null). 짧은 링크가 없으면 null.
const SHORT_LINK = /https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/maps|maps\.google\.com\/maps\?[^\s]*shorturl)[^\s]*/i;
const ANY_URL = /https?:\/\/[^\s]+/g;

export function parseShareText(text) {
  const s = String(text ?? '').trim();
  const m = s.match(SHORT_LINK);
  if (!m) return null;
  const rest = s.replace(ANY_URL, ' ').replace(/[ \t]+/g, ' ').trim();
  const firstLine = rest.split(/\n/).map((l) => l.trim()).find(Boolean) ?? '';
  const name = firstLine.split(/\s·\s|\s\|\s/)[0].replace(/[,\s]+$/, '').trim();
  return { link: m[0], name: name || null };
}

// 이미 정해진 장소는 Google 지도의 그 장소 상세 페이지로 바로 연다.
// 구글 장소 ID 가 있으면 그 장소, 좌표만 있으면 그 지점, 둘 다 없으면 이름 검색.
export function googleMapsPlaceUrl({ placeId = null, name = '', lat = null, lng = null } = {}) {
  const q = String(name ?? '').trim();
  if (placeId) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || 'place')}&query_place_id=${encodeURIComponent(placeId)}`;
  if (Number.isFinite(lat) && Number.isFinite(lng)) return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  return googleMapsSearchUrl(q);
}

// Google 지도 길찾기 링크. from 을 비우면 현재 위치에서 출발한다.
// mode: 'walking' | 'transit' | 'driving'. 폰에서는 Google 지도 앱이 바로 열린다.
export function googleMapsDirectionsUrl({ from = null, to, mode = 'transit' }) {
  const point = (p) => `${p.lat},${p.lng}`;
  const params = new URLSearchParams({ api: '1', destination: point(to), travelmode: mode });
  if (to.placeId) params.set('destination_place_id', to.placeId);
  if (from && Number.isFinite(from.lat) && Number.isFinite(from.lng)) {
    params.set('origin', point(from));
    if (from.placeId) params.set('origin_place_id', from.placeId);
  }
  return `https://www.google.com/maps/dir/?${params}`;
}

export function googleMapsSearchUrl(query) {
  const q = String(query ?? '').trim();
  if (!q) return 'https://www.google.com/maps';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
