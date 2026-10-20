// 장소 검색: Places API (New) 자동완성 + 고른 장소의 위치·주소는 Geocoding(장소 ID). 하루 한도(자동완성 320, 위치 확인 320)를
// 넘으면 실패하고 호출한 쪽이 OpenStreetMap 으로 대체한다.
// 위치를 Places 상세가 아니라 Geocoding 으로 받는 까닭: 상세는 요청 필드에 따라 비싼 등급(월 무료 1,000건)이 있어 키가 악용될 때를
// 대비해 하루 32건으로 묶어야 했다. Geocoding 은 등급이 하나(월 무료 10,000건)라 320건까지 열어도 청구가 생기지 않는다.
// 대신 자동완성 세션이 상세로 끝나지 않아 자동완성은 요청마다 과금된다 (상세로 끝나도 12건까지는 요청마다라 거의 같다).
// 이름은 자동완성의 mainText 를 쓴다.
import { importLibrary } from './gmaps.js';
import { geocodeToPlace } from './lib/place-search.js';

const BIAS_RADIUS_M = 30000;

let geocoder = null;
async function placeById(placeId) {
  if (!geocoder) {
    const { Geocoder } = await importLibrary('geocoding');
    geocoder ??= new Geocoder();
  }
  const { results } = await geocoder.geocode({ placeId });
  const place = geocodeToPlace(results);
  if (!place) throw new Error('no location');
  return place;
}

export function createPlaceSearch() {
  let token = null;

  // 반환: [{ name, address, prediction }]
  async function suggest(q, { near = null } = {}) {
    const { AutocompleteSessionToken, AutocompleteSuggestion } = await importLibrary('places');
    token ??= new AutocompleteSessionToken();
    const request = { input: q, sessionToken: token, language: 'ko' };
    if (near) request.locationBias = { center: { lat: near.lat, lng: near.lng }, radius: BIAS_RADIUS_M };
    const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
    return suggestions.filter((s) => s.placePrediction).map((s) => {
      const p = s.placePrediction;
      return { name: p.mainText?.text ?? p.text?.text ?? '', address: p.secondaryText?.text ?? '', prediction: p };
    });
  }

  // 반환: { name, address, lat, lng, placeId }
  async function resolve(item) {
    const place = await placeById(item.prediction.placeId);
    token = null; // 장소를 골랐으니 다음 검색은 새 세션
    // 자동완성의 부가 설명이 한국어 주소라 그걸 우선 쓰고, 없을 때만 Geocoding 의 주소를 쓴다
    return { name: item.name, address: item.address || place.address, lat: place.lat, lng: place.lng, placeId: place.placeId ?? item.prediction.placeId };
  }

  // 장소 ID 로 바로 위치·주소를 받는다 (구글 지도 공유 링크의 장소 키에서 만든 ID). 위치 확인 1건.
  // 반환: { address, lat, lng, placeId }
  async function byId(placeId) {
    const place = await placeById(placeId);
    return { ...place, placeId: place.placeId ?? placeId };
  }

  return { suggest, resolve, byId };
}
