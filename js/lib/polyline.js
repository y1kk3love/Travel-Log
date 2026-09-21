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

// 좌표가 있는 장소들을 순서대로 이어 구간 목록으로 만든다
export function splitLegs(places) {
  const pts = places.filter(hasCoords);
  const legs = [];
  for (let i = 1; i < pts.length; i++) legs.push({ from: pts[i - 1], to: pts[i], key: legKey(pts[i - 1], pts[i]) });
  return legs;
}
