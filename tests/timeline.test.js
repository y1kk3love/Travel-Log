import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateTimes, addMinutes, pickNext } from '../js/lib/timeline.js';
import { legKey } from '../js/lib/polyline.js';

test('addMinutes: HH:MM에 분을 더한다 (자정 넘김 유지)', () => {
  assert.equal(addMinutes('09:30', 45), '10:15');
  assert.equal(addMinutes('23:50', 20), '00:10');
});

test('estimateTimes: 시간이 없는 장소는 이전 장소 시간 + 머무는 시간 + 도보 시간으로 추정한다', () => {
  const places = [
    { id: 'a', time: '09:00', stayMinutes: 60, lat: 35, lng: 135 },
    { id: 'b', time: null, stayMinutes: 30, lat: 35.009, lng: 135 }, // 1.0km → 도보 14분
    { id: 'c', time: null, stayMinutes: null, lat: 35.009, lng: 135 },
  ];
  assert.deepEqual(estimateTimes(places), [
    { id: 'a', time: '09:00', estimated: false },
    { id: 'b', time: '10:14', estimated: true },
    { id: 'c', time: '10:44', estimated: true },
  ]);
});

test('estimateTimes: 좌표가 없으면 이동 시간 0으로, 머무는 시간이 없으면 0으로 본다', () => {
  const places = [
    { id: 'a', time: '12:00', stayMinutes: null, lat: null, lng: null },
    { id: 'b', time: null, stayMinutes: null, lat: null, lng: null },
  ];
  assert.deepEqual(estimateTimes(places), [
    { id: 'a', time: '12:00', estimated: false },
    { id: 'b', time: '12:00', estimated: true },
  ]);
});

test('estimateTimes: 앞에 시간 있는 장소가 없으면 추정하지 않는다', () => {
  const places = [{ id: 'a', time: null, stayMinutes: 30, lat: 35, lng: 135 }, { id: 'b', time: '13:00', stayMinutes: null, lat: 35, lng: 135 }];
  assert.deepEqual(estimateTimes(places), [
    { id: 'a', time: null, estimated: false },
    { id: 'b', time: '13:00', estimated: false },
  ]);
});

test('estimateTimes: 메모 항목은 시간 흐름에 끼어들지 않는다', () => {
  const places = [
    { id: 'a', time: '09:00', stayMinutes: 30, lat: 35, lng: 135 },
    { id: 'n', category: 'note', time: null, stayMinutes: null, lat: null, lng: null },
    { id: 'b', time: null, stayMinutes: null, lat: 35, lng: 135 },
  ];
  assert.deepEqual(estimateTimes(places), [
    { id: 'a', time: '09:00', estimated: false },
    { id: 'n', time: null, estimated: false },
    { id: 'b', time: '09:30', estimated: true },
  ]);
});

test('estimateTimes: 저장된 구글 도보 시간(routeToNext)이 있으면 직선 추정 대신 그 시간을 쓴다', () => {
  const now = Date.now();
  const a = { id: 'a', time: '09:00', stayMinutes: 60, lat: 35, lng: 135 };
  const b = { id: 'b', time: null, stayMinutes: null, lat: 35.009, lng: 135 }; // 직선 기준 14분
  a.routeToNext = { key: legKey(a, b), encoded: 'abc', seconds: 21 * 60 + 10, meters: 1400, at: now - 1000 }; // 구글 21분 10초 → 22분
  assert.deepEqual(estimateTimes([a, b], now), [
    { id: 'a', time: '09:00', estimated: false },
    { id: 'b', time: '10:22', estimated: true },
  ]);
  // 구간이 바뀌었으면(키 불일치) 직선 추정으로 돌아간다
  a.routeToNext = { ...a.routeToNext, key: 'x>y' };
  assert.equal(estimateTimes([a, b], now)[1].time, '10:14');
});

test('pickNext: 지금 시각을 기준으로 현재 장소와 다음 장소를 고른다', () => {
  const places = [
    { id: 'a', time: '09:00', stayMinutes: 60, lat: 35, lng: 135 }, // b 는 10:00 으로 추정됨
    { id: 'n', category: 'note', time: '10:00' },
    { id: 'b', time: null, stayMinutes: 30, lat: 35, lng: 135 },
    { id: 'c', time: '13:00', lat: 35, lng: 135 },
  ];
  const times = estimateTimes(places);
  assert.deepEqual(pickNext(places, times, '08:00'), { currentIndex: null, nextIndex: 0, done: false });
  assert.deepEqual(pickNext(places, times, '09:10'), { currentIndex: 0, nextIndex: 2, done: false }); // 메모(10:00)는 건너뜀
  assert.deepEqual(pickNext(places, times, '12:00'), { currentIndex: 2, nextIndex: 3, done: false });
  assert.deepEqual(pickNext(places, times, '14:00'), { currentIndex: 3, nextIndex: null, done: true });
});

test('pickNext: 시각이 하나도 없으면 done 이 아니고 다음도 없다', () => {
  const places = [{ id: 'a', time: null, lat: 35, lng: 135 }];
  assert.deepEqual(pickNext(places, estimateTimes(places), '12:00'), { currentIndex: null, nextIndex: null, done: false });
});
