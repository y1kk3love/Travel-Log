import test from 'node:test';
import assert from 'node:assert/strict';
import { placeFromReservation, placesFromReservation } from '../js/lib/reservation-place.js';

const days = [{ id: 'd1', date: '2026-04-17' }, { id: 'd2', date: '2026-04-18' }];

test('placeFromReservation: 일시의 날짜에 맞는 Day 에 종류별 분류로 장소를 만든다', () => {
  const r = { type: 'flight', title: '제주항공 7C1403', datetime: '2026-04-17T09:30', code: 'ABC123', flightNumber: '7C1403', note: '' };
  assert.deepEqual(placeFromReservation(r, days), { dayId: 'd1', time: '09:30', name: '제주항공 7C1403', category: 'move', memo: '편명 7C1403 · 예약번호 ABC123' });
  const stay = { type: 'stay', title: 'S-페리아 호텔', datetime: '2026-04-18T15:00', code: '', note: '조식 포함' };
  assert.deepEqual(placeFromReservation(stay, days), { dayId: 'd2', time: '15:00', name: 'S-페리아 호텔', category: 'stay', memo: '조식 포함' });
  assert.equal(placeFromReservation({ type: 'food', title: '스시', datetime: '2026-04-18T19:00' }, days).category, 'food');
  assert.equal(placeFromReservation({ type: 'etc', title: '티켓', datetime: '2026-04-18T19:00' }, days).category, 'etc');
});

test('placeFromReservation: 일시가 없거나 그 날짜의 Day 가 없으면 null', () => {
  assert.equal(placeFromReservation({ type: 'flight', title: 'x', datetime: null }, days), null);
  assert.equal(placeFromReservation({ type: 'flight', title: 'x', datetime: '2026-05-01T09:00' }, days), null);
});

test('placesFromReservation: 숙소는 체크인~체크아웃 기간의 Day 마다 하나씩 (체크인·숙박·체크아웃)', () => {
  const days4 = [{ id: 'd1', date: '2026-04-17' }, { id: 'd2', date: '2026-04-18' }, { id: 'd3', date: '2026-04-19' }, { id: 'd4', date: '2026-04-20' }];
  const stay = { type: 'stay', title: 'S-페리아 호텔', datetime: '2026-04-17T15:00', checkout: '2026-04-20T11:00', code: 'R1', note: '' };
  assert.deepEqual(placesFromReservation(stay, days4), [
    { dayId: 'd1', time: '15:00', name: 'S-페리아 호텔 체크인', category: 'stay', memo: '예약번호 R1' },
    { dayId: 'd2', time: null, name: 'S-페리아 호텔 숙박', category: 'stay', memo: '예약번호 R1' },
    { dayId: 'd3', time: null, name: 'S-페리아 호텔 숙박', category: 'stay', memo: '예약번호 R1' },
    { dayId: 'd4', time: '11:00', name: 'S-페리아 호텔 체크아웃', category: 'stay', memo: '예약번호 R1' },
  ]);
  // 여행 밖으로 나가는 날은 건너뛴다 (마지막 Day 가 4.18 이면 체크아웃은 없음)
  assert.equal(placesFromReservation(stay, days4.slice(0, 2)).length, 2);
  // 체크아웃이 없거나 숙소가 아니면 하나
  assert.equal(placesFromReservation({ ...stay, checkout: null }, days4).length, 1);
  assert.equal(placesFromReservation({ type: 'flight', title: 'x', datetime: '2026-04-17T09:00' }, days4).length, 1);
  assert.deepEqual(placesFromReservation({ type: 'flight', title: 'x', datetime: null }, days4), []);
});
