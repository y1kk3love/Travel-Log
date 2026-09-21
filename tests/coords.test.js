import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCoordsInput, parseShareText, googleMapsSearchUrl, googleMapsPlaceUrl, googleMapsDirectionsUrl } from '../js/lib/coords.js';

test('"위도, 경도" 텍스트', () => {
  assert.deepEqual(parseCoordsInput('34.9671, 135.7727'), { lat: 34.9671, lng: 135.7727 });
  assert.deepEqual(parseCoordsInput(' 34.9671 135.7727 '), { lat: 34.9671, lng: 135.7727 });
  assert.deepEqual(parseCoordsInput('-33.8688, 151.2093'), { lat: -33.8688, lng: 151.2093 });
});

test('Google 지도 장소 링크: !3d/!4d 값이 @ 값보다 우선한다 (핀 좌표)', () => {
  const url = 'https://www.google.com/maps/place/%E4%BC%8F%E8%A6%8B%E7%A8%B2%E8%8D%B7%E5%A4%A7%E7%A4%BE/@34.9700,135.7800,15z/data=!3m1!4b1!4m6!3m5!1s0x6001:0x1!8m2!3d34.9671!4d135.7727!16s';
  assert.deepEqual(parseCoordsInput(url), { lat: 34.9671, lng: 135.7727 });
});

test('Google 지도 링크: @위도,경도,줌 형태', () => {
  assert.deepEqual(parseCoordsInput('https://www.google.com/maps/@35.0050,135.7649,17z'), { lat: 35.005, lng: 135.7649 });
});

test('Google 지도 링크: q= 또는 query= 파라미터', () => {
  assert.deepEqual(parseCoordsInput('https://maps.google.com/?q=34.9671,135.7727'), { lat: 34.9671, lng: 135.7727 });
  assert.deepEqual(parseCoordsInput('https://www.google.com/maps/search/?api=1&query=34.9671%2C135.7727'), { lat: 34.9671, lng: 135.7727 });
});

test('좌표가 아니면 null (일반 검색어, 범위 밖, 짧은 공유 링크)', () => {
  assert.equal(parseCoordsInput('니시키 시장'), null);
  assert.equal(parseCoordsInput('123.4, 456.7'), null);
  assert.equal(parseCoordsInput('https://maps.app.goo.gl/AbCdEf123'), null);
  assert.equal(parseCoordsInput(''), null);
});

test('googleMapsSearchUrl은 검색어를 인코딩한 Google 지도 검색 주소를 만든다', () => {
  assert.equal(googleMapsSearchUrl('니시키 시장'), 'https://www.google.com/maps/search/?api=1&query=%EB%8B%88%EC%8B%9C%ED%82%A4%20%EC%8B%9C%EC%9E%A5');
  assert.equal(googleMapsSearchUrl(''), 'https://www.google.com/maps');
});

test('parseShareText: 앱 공유 텍스트(이름 · 주소 + 짧은 링크)에서 이름을 뽑는다', () => {
  assert.deepEqual(parseShareText('센소지 · 〒111-0032 東京都台東区浅草２丁目３−１\nhttps://maps.app.goo.gl/AbCdEf123'),
    { link: 'https://maps.app.goo.gl/AbCdEf123', name: '센소지' });
  assert.deepEqual(parseShareText('니시키 시장\n일본 교토부 교토시\nhttps://goo.gl/maps/xyz'),
    { link: 'https://goo.gl/maps/xyz', name: '니시키 시장' });
});

test('parseShareText: 링크만 있으면 name 은 null, 짧은 링크가 없으면 null', () => {
  assert.deepEqual(parseShareText('https://maps.app.goo.gl/AbCdEf123'), { link: 'https://maps.app.goo.gl/AbCdEf123', name: null });
  assert.equal(parseShareText('니시키 시장'), null);
  assert.equal(parseShareText('https://www.google.com/maps/@35.0050,135.7649,17z'), null);
});

test('googleMapsPlaceUrl: 장소 ID > 좌표 > 이름 검색 순으로 주소를 만든다', () => {
  assert.equal(googleMapsPlaceUrl({ placeId: 'ChIJabc', name: '센소지', lat: 1, lng: 2 }),
    'https://www.google.com/maps/search/?api=1&query=%EC%84%BC%EC%86%8C%EC%A7%80&query_place_id=ChIJabc');
  assert.equal(googleMapsPlaceUrl({ name: '센소지', lat: 35.7148, lng: 139.7967 }), 'https://www.google.com/maps/search/?api=1&query=35.7148,139.7967');
  assert.equal(googleMapsPlaceUrl({ name: '센소지' }), googleMapsSearchUrl('센소지'));
  assert.equal(googleMapsPlaceUrl({}), 'https://www.google.com/maps');
});

test('googleMapsDirectionsUrl: 출발·도착 좌표와 장소 ID, 이동 수단을 담는다', () => {
  const url = googleMapsDirectionsUrl({ from: { lat: 35.71, lng: 139.79, placeId: 'A' }, to: { lat: 35.72, lng: 139.8, placeId: 'B' }, mode: 'walking' });
  assert.equal(url, 'https://www.google.com/maps/dir/?api=1&destination=35.72%2C139.8&travelmode=walking&destination_place_id=B&origin=35.71%2C139.79&origin_place_id=A');
});

test('googleMapsDirectionsUrl: 출발지를 비우면 현재 위치 출발 (origin 없음), 기본은 대중교통', () => {
  const url = googleMapsDirectionsUrl({ to: { lat: 35.72, lng: 139.8 } });
  assert.equal(url, 'https://www.google.com/maps/dir/?api=1&destination=35.72%2C139.8&travelmode=transit');
});
