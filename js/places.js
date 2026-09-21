// 장소 검색: Places API (New) 자동완성 + 상세(위치·주소만). 하루 한도(자동완성 300, 상세 100)를 넘으면 실패하고
// 호출한 쪽이 Nominatim 으로 대체한다.
// 요금 기준: 자동완성 → Essentials, 상세는 location·formattedAddress 만 요청해 Essentials 에 머문다
// (displayName 은 Pro 등급이라 요청하지 않고 자동완성의 mainText 를 이름으로 쓴다).
import { importLibrary } from './gmaps.js';

const BIAS_RADIUS_M = 30000;

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

  // 반환: { name, address, lat, lng }
  async function resolve(item) {
    const place = item.prediction.toPlace();
    await place.fetchFields({ fields: ['location', 'formattedAddress'] });
    token = null; // 상세 조회로 세션이 끝난다
    if (!place.location) throw new Error('no location');
    // 자동완성의 부가 설명이 한국어 주소라 그걸 우선 쓰고, 없을 때만 상세의 formattedAddress 를 쓴다
    return { name: item.name, address: item.address || place.formattedAddress || '', lat: place.location.lat(), lng: place.location.lng() };
  }

  return { suggest, resolve };
}
