import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFlightNumber, airlineName, flightradarUrl } from '../js/lib/flight.js';

test('parseFlightNumber: 공백·소문자·붙여쓰기를 모두 받아 IATA 편명으로 정리한다', () => {
  assert.deepEqual(parseFlightNumber('LJ213'), { airline: 'LJ', number: '213', iata: 'LJ213' });
  assert.deepEqual(parseFlightNumber(' lj 213 '), { airline: 'LJ', number: '213', iata: 'LJ213' });
  assert.deepEqual(parseFlightNumber('7C1104'), { airline: '7C', number: '1104', iata: '7C1104' });
  assert.deepEqual(parseFlightNumber('KE-0017'), { airline: 'KE', number: '17', iata: 'KE17' });
});

test('parseFlightNumber: 편명이 아니면 null', () => {
  assert.equal(parseFlightNumber(''), null);
  assert.equal(parseFlightNumber('진에어'), null);
  assert.equal(parseFlightNumber('ABC'), null);
  assert.equal(parseFlightNumber('LJ'), null);
  assert.equal(parseFlightNumber('LJ12345'), null);
});

test('airlineName: 아는 코드는 한글 이름, 모르는 코드는 null', () => {
  assert.equal(airlineName('LJ'), '진에어');
  assert.equal(airlineName('KE'), '대한항공');
  assert.equal(airlineName('7C'), '제주항공');
  assert.equal(airlineName('NH'), '전일본공수(ANA)');
  assert.equal(airlineName('ZZ'), null);
});

test('flightradarUrl', () => {
  assert.equal(flightradarUrl('LJ213'), 'https://www.flightradar24.com/data/flights/lj213');
});
