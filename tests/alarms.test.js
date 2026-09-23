import test from 'node:test';
import assert from 'node:assert/strict';
import { planAlarms, alarmId, tripsForAlarms } from '../js/lib/alarms.js';
import { legKey } from '../js/lib/polyline.js';

// planAlarms 는 기기 시간대의 로컬 시각으로 계산한다. 기대값도 로컬로 만들어 CI(UTC)에서도 같아야 한다.
const local = (y, m, d, hh, mm) => new Date(y, m - 1, d, hh, mm).getTime();
const now = new Date(local(2026, 9, 21, 9, 0));
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
  assert.deepEqual(out.map((a) => [a.placeId, a.at]), [
    ['p2', local(2026, 9, 21, 9, 26)],
    ['p4', local(2026, 9, 22, 12, 50)],
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
  assert.equal(out.find((a) => a.placeId === 'p2').at, local(2026, 9, 21, 9, 35));
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, dayId: 'd2', name: `m${i}`, time: `${String(8 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`, lat: 35.7, lng: 139.8, order: i }));
  assert.equal(planAlarms({ trips: [trip], placesByTrip: { t1: many }, daysByTrip: { t1: days } }, now).length, 20);
});

test('alarmId: 같은 placeId 는 같은 양의 정수, 다른 id 는 다르다', () => {
  assert.equal(alarmId('abc'), alarmId('abc'));
  assert.notEqual(alarmId('abc'), alarmId('abd'));
  assert.ok(Number.isInteger(alarmId('abc')) && alarmId('abc') > 0 && alarmId('abc') < 2 ** 31);
});

test('planAlarms: 시각을 못 정한 장소는 건너뛰고, 다음 장소의 도보 시간은 마지막으로 시각이 있던 장소부터 잰다 (estimateTimes 와 같은 규칙)', () => {
  // p0 은 시각도 없고 앞 장소도 없어 시각을 못 정함 → 알림 없음. p2 의 도보는 p0 이 아니라 p1 기준.
  const p0 = { id: 'p0', dayId: 'd2', name: '시각 없음', lat: 35.60, lng: 139.70, order: 0 };
  const p1 = { id: 'p1', dayId: 'd2', name: '첫 시각', time: '10:00', lat: 35.7148, lng: 139.7967, order: 1 };
  const p2 = { id: 'p2', dayId: 'd2', name: '다음', time: '10:30', lat: 35.7141, lng: 139.7774, order: 2 }; // p1 에서 도보 ~24분
  const out = planAlarms({ trips: [trip], placesByTrip: { t1: [p0, p1, p2] }, daysByTrip: { t1: days } }, now);
  assert.deepEqual(out.map((a) => a.placeId), ['p1', 'p2']);
  assert.equal(out[0].body, '10:00 예정'); // p0 을 출발지로 치면 15km 도보가 붙어 버린다
  assert.match(out[1].body, /도보 2\d분/);
});

test('tripsForAlarms: 오늘·내일에 걸친 여행만 (지난 여행·먼 여행은 장소를 읽지 않는다)', () => {
  const now = new Date(2026, 8, 23, 9, 0); // 2026-09-23 로컬
  const trips = [
    { id: 'past', startDate: '2026-04-17', endDate: '2026-04-20' },
    { id: 'now', startDate: '2026-09-21', endDate: '2026-09-25' },
    { id: 'tomorrow', startDate: '2026-09-24', endDate: '2026-09-26' },
    { id: 'lastday-today', startDate: '2026-09-20', endDate: '2026-09-23' },
    { id: 'later', startDate: '2026-09-25', endDate: '2026-09-28' },
    { id: 'future', startDate: '2027-02-13', endDate: '2027-02-16' },
  ];
  assert.deepEqual(tripsForAlarms(trips, now).map((t) => t.id), ['now', 'tomorrow', 'lastday-today']);
});

test('tripsForAlarms: 날짜가 없는 여행은 건너뛴다', () => {
  assert.deepEqual(tripsForAlarms([{ id: 'x' }, { id: 'y', startDate: '2026-09-23' }], new Date(2026, 8, 23)), []);
});
