import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFlightNumber, airlineName, flightradarUrl, parseRoute, airportCode, flightDuration, airportSuggestions, flightTitle, airportInfo } from '../js/lib/flight.js';

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

test('parseRoute: 제목의 "출발 → 도착" 을 읽는다 (화살표·하이픈, 뒤에 붙은 항공사·편명은 버림)', () => {
  assert.deepEqual(parseRoute('인천 → 후쿠오카 · 제주항공 7C1403'), { from: '인천', to: '후쿠오카' });
  assert.deepEqual(parseRoute('후쿠오카 -> 인천'), { from: '후쿠오카', to: '인천' });
  assert.deepEqual(parseRoute('ICN→NRT 대한항공 KE703'), { from: 'ICN', to: 'NRT' });
  assert.equal(parseRoute('제주항공 7C1403'), null);
  assert.equal(parseRoute(''), null);
});

test('airportCode: 도시·공항 이름이나 코드에서 IATA 코드', () => {
  assert.equal(airportCode('인천'), 'ICN');
  assert.equal(airportCode('후쿠오카'), 'FUK');
  assert.equal(airportCode('간사이'), 'KIX');
  assert.equal(airportCode('오사카'), 'KIX');
  assert.equal(airportCode('nrt'), 'NRT');
  assert.equal(airportCode('모르는도시'), null);
});

test('flightDuration: 출발·도착 일시로 비행 시간 문구, 하나라도 없으면 null', () => {
  assert.equal(flightDuration('2026-04-17T09:30', '2026-04-17T11:00'), '1시간 30분');
  assert.equal(flightDuration('2026-04-17T23:30', '2026-04-18T01:00'), '1시간 30분');
  assert.equal(flightDuration('2026-04-17T09:30', '2026-04-17T12:30'), '3시간');
  assert.equal(flightDuration('2026-04-17T09:30', null), null);
  assert.equal(flightDuration('2026-04-17T09:30', '2026-04-17T09:00'), null); // 도착이 더 이르면 무시
});

test('airportSuggestions: 자동완성용 도시·코드 목록 (코드 순 정렬, 중복 코드는 도시 이름을 묶음)', () => {
  const list = airportSuggestions();
  assert.ok(list.length > 40);
  const icn = list.find((a) => a.code === 'ICN');
  assert.equal(icn.label, '인천 (ICN)');
  const kix = list.find((a) => a.code === 'KIX');
  assert.match(kix.label, /오사카|간사이/);
  assert.match(kix.label, /\(KIX\)$/);
});

test('flightTitle: 공항·항공사·편명으로 제목을 만든다', () => {
  assert.equal(flightTitle({ from: '인천', to: '오사카', airline: '진에어', iata: 'LJ313' }), '인천 → 오사카 · 진에어 LJ313');
  assert.equal(flightTitle({ from: '인천', to: '오사카', airline: null, iata: 'XX123' }), '인천 → 오사카 · XX123');
  assert.equal(flightTitle({ from: '', to: '', airline: '진에어', iata: 'LJ313' }), '진에어 LJ313');
  assert.equal(flightTitle({ from: '인천', to: '', airline: null, iata: null }), '인천 →');
});

test('airportInfo: 코드·좌표·도시. 표에 있는 공항은 전부 좌표가 있다', () => {
  const icn = airportInfo('인천');
  assert.equal(icn.code, 'ICN');
  assert.ok(Math.abs(icn.lat - 37.46) < 0.05 && Math.abs(icn.lng - 126.44) < 0.05);
  assert.equal(airportInfo('KIX').city, '오사카');
  assert.equal(airportInfo('모르는곳'), null);
  for (const a of airportSuggestions()) { const i = airportInfo(a.code); assert.ok(i && Number.isFinite(i.lat) && Number.isFinite(i.lng), `${a.code} 좌표 없음`); }
});
