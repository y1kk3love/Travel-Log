import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPooled, poolPlaces, chunk } from '../js/lib/pool.js';

test('isPooled: 날짜가 없는 장소는 보관함', () => {
  assert.equal(isPooled({ dayId: null }, new Set(['D1'])), true);
  assert.equal(isPooled({ dayId: 'D1' }, new Set(['D1'])), false);
});

test('isPooled: 지워진 Day 를 가리키는 장소도 보관함에 보인다 (Day 를 지우는 사이 동행이 넣은 장소가 사라지지 않게)', () => {
  assert.equal(isPooled({ dayId: 'GONE' }, new Set(['D1', 'D2'])), true);
});

test('isPooled: Day 목록을 아직 못 받았으면 날짜 있는 장소를 보관함으로 옮겨 보이지 않는다', () => {
  assert.equal(isPooled({ dayId: 'D1' }, null), false);
  assert.equal(isPooled({ dayId: 'D1' }, new Set()), false);
});

test('chunk: 배치 한도(500) 아래로 나눈다', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 450), []);
  assert.equal(chunk(Array.from({ length: 1001 }, (_, i) => i), 450).length, 3);
});

test('poolPlaces: 날짜 미정 장소와 지워진 Day 의 장소·메모 (날짜 미정 메모는 원래 없고, 있는 Day 의 메모는 그 Day 에)', () => {
  const dayIds = new Set(['D1']);
  const places = [
    { id: 'a', dayId: null, category: 'sight' },
    { id: 'b', dayId: 'D1', category: 'sight' },
    { id: 'c', dayId: 'GONE', category: 'food' },
    { id: 'm1', dayId: 'D1', category: 'note' },
    { id: 'm2', dayId: 'GONE', category: 'note' },
  ];
  assert.deepEqual(poolPlaces(places, dayIds).map((p) => p.id), ['a', 'c', 'm2']);
});

test('regionOf: 구글 한국어 주소와 OpenStreetMap 주소에서 같은 큰 지역 이름을 고른다', async () => {
  const { regionOf } = await import('../js/lib/pool.js');
  assert.equal(regionOf('일본 교토부 교토시 히가시야마구 기요미즈 1 Chome−294'), '교토부');
  assert.equal(regionOf('일본 교토부 宇治市우지 蓮華116'), '교토부');
  assert.equal(regionOf('기요미즈데라, 히가시야마구, 교토시, 교토부, 605-0862, 일본'), '교토부');
  assert.equal(regionOf('일본 나라현 나라시 조시초 406-1'), '나라현');
  assert.equal(regionOf('일본 효고현 고베시 주오구 Hatobachō, 2−2'), '효고현');
  assert.equal(regionOf('일본 도쿄도 다이토구 아사쿠사 1 Chome−7−1'), '도쿄도');
  assert.equal(regionOf('대한민국 강원특별자치도 강릉시 창해로 17'), '강원특별자치도');
  assert.equal(regionOf('대한민국 서울특별시 종로구 사직로 161'), '서울특별시');
});

test('regionOf: 지역을 알 수 없으면 null (좌표·링크로 넣은 곳)', async () => {
  const { regionOf } = await import('../js/lib/pool.js');
  assert.equal(regionOf(null), null);
  assert.equal(regionOf('붙여넣은 좌표 34.98580, 135.75880'), null);
  assert.equal(regionOf('구글 지도 링크 · 이치란'), null);
});

test('poolCategories: 보관함에 있는 분류만, 많은 순으로', async () => {
  const { poolCategories } = await import('../js/lib/pool.js');
  const places = [{ category: 'food' }, { category: 'sight' }, { category: 'sight' }, { category: 'cafe' }, {}];
  assert.deepEqual(poolCategories(places), [
    { category: 'sight', count: 2 }, { category: 'food', count: 1 }, { category: 'cafe', count: 1 }, { category: 'etc', count: 1 },
  ]);
});

test('groupPool: 분류로 거르고 지역별로 묶는다 (곳이 많은 지역부터, 모르는 곳은 맨 끝 기타)', async () => {
  const { groupPool } = await import('../js/lib/pool.js');
  const places = [
    { id: 'a', category: 'sight', address: '일본 나라현 나라시' },
    { id: 'b', category: 'sight', address: '일본 교토부 교토시' },
    { id: 'c', category: 'food', address: '일본 교토부 교토시 나카교구' },
    { id: 'd', category: 'sight', address: null },
  ];
  const all = groupPool(places);
  assert.deepEqual(all.map((g) => [g.region, g.places.map((p) => p.id)]), [['교토부', ['b', 'c']], ['나라현', ['a']], ['기타', ['d']]]);
  const food = groupPool(places, { category: 'food' });
  assert.deepEqual(food, [{ region: null, places: [places[2]] }]); // 지역이 하나면 묶음 이름 없이
  assert.deepEqual(groupPool(places, { category: 'cafe' }), []);
});
