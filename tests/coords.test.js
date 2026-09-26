import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCoordsInput, parseShareText, googleMapsSearchUrl, googleMapsPlaceUrl, googleMapsDirectionsUrl, parseMapsLink, fidToPlaceId, linkPlaceName } from '../js/lib/coords.js';

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

test('parseMapsLink: 긴 구글 지도 링크에서 이름·좌표·장소 ID 를 뽑는다', () => {
  const long = 'https://www.google.com/maps/place/%EC%84%BC%EC%86%8C%EC%A7%80/@35.7147651,139.7966553,17z/data=!3m1!4b1!4m6!3m5!1s0x60188ed0d12f9adf:0x7411cb2b21c1c25b!8m2!3d35.7147651!4d139.7966553!16zL20vMDF6dHI5';
  assert.deepEqual(parseMapsLink(long), { name: '센소지', lat: 35.7147651, lng: 139.7966553, placeId: fidToPlaceId('0x60188ed0d12f9adf:0x7411cb2b21c1c25b') });
  const api = 'https://www.google.com/maps/search/?api=1&query=Senso-ji&query_place_id=ChIJ8T1GpMGOGGARDYGSgpooDWw';
  assert.deepEqual(parseMapsLink(api), { name: 'Senso-ji', lat: null, lng: null, placeId: 'ChIJ8T1GpMGOGGARDYGSgpooDWw' });
  assert.equal(parseMapsLink('https://maps.app.goo.gl/abc'), null); // 짧은 링크는 정보 없음
  assert.equal(parseMapsLink('그냥 검색어'), null);
});

test('fidToPlaceId: 구글 지도 링크의 장소 키(0x…:0x…)를 Places API 장소 ID(ChIJ…)로 바꾼다', () => {
  assert.equal(fidToPlaceId('0x6b12ae37b47f5b37:0x8eaddfcd1b32ca52'), 'ChIJN1t_tDeuEmsRUsoyG83frY4'); // Places API 문서의 예시 장소
  assert.equal(fidToPlaceId('0x3a52660ef39b8afb:0x9507fa7b131c1c36'), 'ChIJ-4qb8w5mUjoRNhwcE3v6B5U'); // 실제 조회로 확인 (첸나이 박물관)
  assert.equal(fidToPlaceId('0x0:0xca9b70cfafe795f1'), null); // 앞쪽이 0 인 키는 장소가 아니다 (리뷰 링크 등)
  assert.equal(fidToPlaceId('그냥 글'), null);
});

test('parseMapsLink: 요즘 구글 지도 앱 공유 링크를 따라간 주소는 좌표 없이 장소 키만 있다 → 장소 ID', () => {
  const gps = 'https://www.google.com/maps/place/Government+Museum+Chennai,+Government+Maternity+Hospital,+Pantheon+Rd,+Egmore,+Chennai,+Tamil+Nadu+600008/data=!4m2!3m1!1s0x3a52660ef39b8afb:0x9507fa7b131c1c36?utm_source=mstt_1&entry=gps&coh=192189';
  assert.deepEqual(parseMapsLink(gps), {
    name: 'Government Museum Chennai, Government Maternity Hospital, Pantheon Rd, Egmore, Chennai, Tamil Nadu 600008',
    lat: null, lng: null, placeId: 'ChIJ-4qb8w5mUjoRNhwcE3v6B5U',
  });
  // 예전 형식: 핀 좌표(!3d/!4d)와 장소 키가 둘 다 있다 (google.co.in 같은 나라 도메인도)
  const tts = 'https://www.google.co.in/maps/place/Anand+Tea+Stall/@26.4989241,80.1953814,12z/data=!4m7!3m6!1s0x399c4741d107835f:0x44f9805b3dd9069b!8m2!3d26.4079081!4d80.315302!16s%2Fg%2F11qb4s4lqp?entry=tts';
  assert.deepEqual(parseMapsLink(tts), { name: 'Anand Tea Stall', lat: 26.4079081, lng: 80.315302, placeId: fidToPlaceId('0x399c4741d107835f:0x44f9805b3dd9069b') });
  // query_place_id 가 있으면 그게 우선
  assert.equal(parseMapsLink('https://www.google.com/maps/search/?api=1&query=X&query_place_id=ChIJabc&data=!1s0x399c4741d107835f:0x44f9805b3dd9069b').placeId, 'ChIJabc');
});

test('linkPlaceName: 링크 속 이름이 "이름, 주소…" 면 이름만 (요즘 공유 링크 형식)', () => {
  assert.equal(linkPlaceName('Government Museum Chennai, Government Maternity Hospital, Pantheon Rd, Egmore'), 'Government Museum Chennai');
  assert.equal(linkPlaceName('Anand Tea Stall'), 'Anand Tea Stall');
  assert.equal(linkPlaceName('센소지'), '센소지');
  assert.equal(linkPlaceName(null), null);
});
