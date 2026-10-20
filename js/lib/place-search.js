// 장소 검색의 판단 (순수 함수, 테스트 대상): 언제 검색할지, 어디서 찾을지, 받은 결과를 어떻게 기억할지.

// 덜 친 한글 자모(ㄱ~ㅎ, ㅏ~ㅣ). "센소ㅈ" 처럼 끝 글자가 자모뿐이면 아직 치는 중이라 검색하지 않는다
const BARE_JAMO = /[ㄱ-ㆎ]$/;

export function isSearchable(q) {
  const s = String(q ?? '').trim();
  return s.length >= 2 && !BARE_JAMO.test(s);
}

// google.maps.Geocoder 결과 → { address, lat, lng, placeId } (위치가 없으면 null)
export function geocodeToPlace(results) {
  const r = Array.isArray(results) ? results[0] : null;
  const loc = r?.geometry?.location;
  if (!loc) return null;
  const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
  const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { address: r.formatted_address ?? '', lat, lng, placeId: r.place_id ?? null };
}

// 장소 창 하나에서 받은 검색 결과를 검색어별로 기억한다 (지웠다 다시 치기·같은 말 다시 검색은 요청하지 않는다)
export function createQueryCache(max = 30) {
  const map = new Map();
  const key = (source, q) => `${source}:${String(q ?? '').trim().replace(/\s+/g, ' ').toLowerCase()}`;
  return {
    get: (source, q) => map.get(key(source, q)),
    set(source, q, value) {
      const k = key(source, q);
      map.delete(k);
      map.set(k, value);
      if (map.size > max) map.delete(map.keys().next().value);
    },
  };
}

// 오늘 구글 자동완성(places)이나 위치 확인(details) 한도를 다 썼으면 OpenStreetMap 으로 찾는다
export function pickSearchSource({ placesHit, detailsHit }) {
  return placesHit || detailsHit ? 'osm' : 'google';
}
