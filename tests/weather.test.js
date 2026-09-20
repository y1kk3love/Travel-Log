import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weatherLabel, pickDayLocation, forecastWindow } from '../js/lib/weather.js';

test('weatherLabel: WMO 코드를 한글로', () => {
  assert.equal(weatherLabel(0), '맑음');
  assert.equal(weatherLabel(2), '구름 조금');
  assert.equal(weatherLabel(3), '흐림');
  assert.equal(weatherLabel(61), '비');
  assert.equal(weatherLabel(71), '눈');
  assert.equal(weatherLabel(95), '뇌우');
  assert.equal(weatherLabel(999), '날씨');
});

test('pickDayLocation: 그 날 첫 좌표 장소, 없으면 여행 전체 첫 좌표 장소, 그것도 없으면 null', () => {
  const places = [
    { dayId: 'd1', order: 0, lat: null, lng: null },
    { dayId: 'd1', order: 1, lat: 35.0, lng: 135.0 },
    { dayId: 'd2', order: 0, lat: 34.0, lng: 134.0 },
  ];
  assert.deepEqual(pickDayLocation(places, 'd1'), { lat: 35.0, lng: 135.0 });
  assert.deepEqual(pickDayLocation(places, 'd2'), { lat: 34.0, lng: 134.0 });
  assert.deepEqual(pickDayLocation(places, 'd3'), { lat: 35.0, lng: 135.0 });
  assert.equal(pickDayLocation([{ dayId: 'd1', order: 0, lat: null, lng: null }], 'd1'), null);
});

test('forecastWindow: 오늘부터 15일 안에 드는 날짜만 남긴다', () => {
  const days = ['2026-09-20', '2026-09-21', '2026-10-05', '2026-10-06', '2026-10-07'];
  assert.deepEqual(forecastWindow(days, '2026-09-21'), ['2026-09-21', '2026-10-05', '2026-10-06']);
  assert.deepEqual(forecastWindow(['2026-12-01'], '2026-09-21'), []);
});
