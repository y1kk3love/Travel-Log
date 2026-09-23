// Google 인코딩 폴리라인 디코더 + 경로 캐시 키 (순수 함수, 테스트 대상)
import { hasCoords } from './geo.js';

// 반환: [[lat, lng], ...]
export function decodePolyline(encoded) {
  if (typeof encoded !== 'string' || !encoded) return [];
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

const round5 = (n) => Number(n.toFixed(5));

// 같은 두 지점 사이의 경로는 다시 묻지 않도록 캐시 키 (출발→도착 방향 포함)
export function legKey(a, b) {
  return `${round5(a.lat)},${round5(a.lng)}>${round5(b.lat)},${round5(b.lng)}`;
}

// Google 약관상 경로 결과는 30일까지만 보관할 수 있다. 구간(key)이 같고 30일이 안 지났을 때만 저장본을 쓴다.
export const ROUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export function isFreshRoute(route, key, now = Date.now()) {
  return !!route && route.key === key && typeof route.encoded === 'string' && route.encoded.length > 0
    && typeof route.at === 'number' && now - route.at >= 0 && now - route.at < ROUTE_TTL_MS;
}

// 도보 경로가 없다는 답(바다 건너 등)도 같은 구간·30일 동안 저장해 다시 묻지 않는다. 하루 한도가 작아서
// 지도를 다시 그릴 때마다(편집·Day 전환·기기마다) 같은 구간을 또 물으면 한도가 금방 바닥난다.
export function isKnownNoRoute(route, key, now = Date.now()) {
  return !!route && route.key === key && route.none === true
    && typeof route.at === 'number' && now - route.at >= 0 && now - route.at < ROUTE_TTL_MS;
}

// 좌표가 있는 장소들을 순서대로 이어 구간 목록으로 만든다
export function splitLegs(places) {
  const pts = places.filter(hasCoords);
  const legs = [];
  for (let i = 1; i < pts.length; i++) legs.push({ from: pts[i - 1], to: pts[i], key: legKey(pts[i - 1], pts[i]) });
  return legs;
}
