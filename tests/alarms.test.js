import test from 'node:test';
import assert from 'node:assert/strict';
import { planAlarms, alarmId } from '../js/lib/alarms.js';
import { legKey } from '../js/lib/polyline.js';

const now = new Date('2026-09-21T09:00:00+09:00');
const trip = { id: 't1', title: '도쿄', startDate: '2026-09-20', endDate: '2026-09-23' };
const days = [{ id: 'd1', date: '2026-09-21', order: 0 }, { id: 'd2', date: '2026-09-22', order: 1 }, { id: 'd0', date: '2026-09-20', order: -1 }];
const places = [
  { id: 'p1', dayId: 'd1', name: '우에노', time: '08:30', lat: 35.7141, lng: 139.7774, order: 0 },          // 지남
  { id: 'p2', dayId: 'd1', name: '센소지', time: '10:00', lat: 35.7148, lng: 139.7967, order: 1 },          // 도보 ~24분 → 09:26
  { id: 'p3', dayId: 'd1', name: '메모', category: 'note', time: '11:00', order: 2 },                        // 제외
  { id: 'p4', dayId: 'd2', name: '스카이트리', time: '13:00', lat: 35.7101, lng: 139.8107, order: 0 },      // 내일 첫 장소 → 12:50
  { id: 'p5', dayId: 'd0', name: '어제', time: '10:00', lat: 35.7, lng: 139.7, order: 0 },                  // 어제 → 제외
];

test('planAlarms: 오늘·내일, 시각 있는 장소만, 출발 = 도착 − 도보 − 10분, 지난 것 제외', () => {
  const out = planAlarms({ trips: [trip], placesByTrip: { t1: places }, daysByTrip: { t1: days } }, now);
  assert.deepEqual(out.map((a) => [a.placeId, new Date(a.at).toISOString()]), [
    ['p2', new Date('2026-09-21T09:26:00+09:00').toISOString()],
    ['p4', new Date('2026-09-22T12:50:00+09:00').toISOString()],
  ]);
  assert.equal(out[0].title, '곧 출발: 센소지');
  assert.match(out[0].body, /10:00 도착 예정 · 도보 \d+분/);
  assert.equal(out[1].body, '13:00 예정');
  assert.equal(out[0].tripId, 't1');
});

test('planAlarms: 저장된 구글 도보 시간이 있으면 그걸 쓰고, 20개를 넘지 않는다', () => {
  const p1 = { ...places[0], time: '09:30' }; // 아직 안 지남
  const p2 = { ...places[1], time: '10:00' };
  p1.routeToNext = { key: legKey(p1, p2), encoded: 'x', seconds: 15 * 60, meters: 1000, at: now.getTime() };
  const out = planAlarms({ trips: [trip], placesByTrip: { t1: [p1, p2] }, daysByTrip: { t1: days } }, now);
  assert.equal(new Date(out.find((a) => a.placeId === 'p2').at).toISOString(), new Date('2026-09-21T09:35:00+09:00').toISOString());
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, dayId: 'd2', name: `m${i}`, time: `${String(8 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`, lat: 35.7, lng: 139.8, order: i }));
  assert.equal(planAlarms({ trips: [trip], placesByTrip: { t1: many }, daysByTrip: { t1: days } }, now).length, 20);
});

test('alarmId: 같은 placeId 는 같은 양의 정수, 다른 id 는 다르다', () => {
  assert.equal(alarmId('abc'), alarmId('abc'));
  assert.notEqual(alarmId('abc'), alarmId('abd'));
  assert.ok(Number.isInteger(alarmId('abc')) && alarmId('abc') > 0 && alarmId('abc') < 2 ** 31);
});
