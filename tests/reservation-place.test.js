import test from 'node:test';
import assert from 'node:assert/strict';
import { placeFromReservation } from '../js/lib/reservation-place.js';

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
