import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSearchable, geocodeToPlace, createQueryCache, pickSearchSource } from '../js/lib/place-search.js';

test('isSearchable: 두 글자 이상이고, 마지막 글자가 덜 친 자모(ㄱ·ㅏ 등)가 아니면 검색한다', () => {
  assert.equal(isSearchable('센소'), true);
  assert.equal(isSearchable('센솢'), true);        // 받침까지 붙은 완성 글자는 검색 (다음 글자일 수도 있지만 구분할 수 없다)
  assert.equal(isSearchable('tokyo tower '), true);
  assert.equal(isSearchable('센'), false);          // 한 글자
  assert.equal(isSearchable('  a  '), false);
  assert.equal(isSearchable('센소ㅈ'), false);      // 자음만 친 상태
  assert.equal(isSearchable('스카이ㅌ'), false);
  assert.equal(isSearchable('도쿄 ㅏ'), false);     // 모음만
  assert.equal(isSearchable(''), false);
  assert.equal(isSearchable(null), false);
});

test('geocodeToPlace: Geocoder 결과의 첫 항목에서 위치·주소·장소 ID 를 꺼낸다', () => {
  const results = [{
    formatted_address: '일본 〒111-0032 도쿄도 다이토구 아사쿠사 2-3-1',
    place_id: 'ChIJ8T1GpMGOGGARDYGSgpooDWw',
    geometry: { location: { lat: () => 35.7147651, lng: () => 139.7966553 } },
  }];
  assert.deepEqual(geocodeToPlace(results), {
    address: '일본 〒111-0032 도쿄도 다이토구 아사쿠사 2-3-1', lat: 35.7147651, lng: 139.7966553, placeId: 'ChIJ8T1GpMGOGGARDYGSgpooDWw',
  });
});

test('geocodeToPlace: 결과가 없거나 위치가 없으면 null', () => {
  assert.equal(geocodeToPlace([]), null);
  assert.equal(geocodeToPlace(null), null);
  assert.equal(geocodeToPlace([{ formatted_address: '어딘가', place_id: 'x' }]), null);
  assert.equal(geocodeToPlace([{ geometry: { location: { lat: () => NaN, lng: () => 1 } } }]), null);
});

test('createQueryCache: 앞뒤 공백·여러 칸 공백·대소문자가 달라도 같은 검색어로 본다', () => {
  const cache = createQueryCache();
  cache.set('google', ' Tokyo  Tower ', ['a']);
  assert.deepEqual(cache.get('google', 'tokyo tower'), ['a']);
  assert.equal(cache.get('osm', 'tokyo tower'), undefined); // 출처가 다르면 따로
  assert.equal(cache.get('google', 'tokyo'), undefined);
});

test('createQueryCache: 가득 차면 가장 오래된 검색어부터 버린다', () => {
  const cache = createQueryCache(2);
  cache.set('google', 'a1', [1]);
  cache.set('google', 'a2', [2]);
  cache.set('google', 'a3', [3]);
  assert.equal(cache.get('google', 'a1'), undefined);
  assert.deepEqual(cache.get('google', 'a3'), [3]);
});

test('pickSearchSource: 오늘 구글 검색이나 위치 확인 한도를 다 썼으면 OpenStreetMap', () => {
  assert.equal(pickSearchSource({ placesHit: false, detailsHit: false }), 'google');
  assert.equal(pickSearchSource({ placesHit: true, detailsHit: false }), 'osm');  // 자동완성이 막힘
  assert.equal(pickSearchSource({ placesHit: false, detailsHit: true }), 'osm');  // 골라도 위치를 못 받음
});
