import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCoordsInput, googleMapsSearchUrl } from '../js/lib/coords.js';

test('"위도, 경도" 텍스트', () => {
  assert.deepEqual(parseCoordsInput('34.9671, 135.7727'), { lat: 34.9671, lng: 135.7727 });
  assert.deepEqual(parseCoordsInput(' 34.9671 135.7727 '), { lat: 34.9671, lng: 135.7727 });
  assert.deepEqual(parseCoordsInput('-33.8688, 151.2093'), { lat: -33.8688, lng: 151.2093 });
});

test('Google 지도 장소 링크: !3d/!4d 값이 @ 값보다 우선한다 (핀 좌표)', () => {
  const url = 'https://www.google.com/maps/place/%E4%BC%8F%E8%A6%8B%E7%A8%B2%E8%8D%B7%E5%A4%A7%E7%A4%BE/@34.9700,135.7800,15z/data=!3m1!4b1!4m6!3m5!1s0x6001:0x1!8m2!3d34.9671!4d135.7727!16s';
  assert.deepEqual(parseCoordsInput(url), { lat: 34.9671, lng: 135.7727 });
});

test('Google 지도 링크: @위도,경도,줌 형태', () => {
  assert.deepEqual(parseCoordsInput('https://www.google.com/maps/@35.0050,135.7649,17z'), { lat: 35.005, lng: 135.7649 });
});

test('Google 지도 링크: q= 또는 query= 파라미터', () => {
  assert.deepEqual(parseCoordsInput('https://maps.google.com/?q=34.9671,135.7727'), { lat: 34.9671, lng: 135.7727 });
  assert.deepEqual(parseCoordsInput('https://www.google.com/maps/search/?api=1&query=34.9671%2C135.7727'), { lat: 34.9671, lng: 135.7727 });
});

test('좌표가 아니면 null (일반 검색어, 범위 밖, 짧은 공유 링크)', () => {
  assert.equal(parseCoordsInput('니시키 시장'), null);
  assert.equal(parseCoordsInput('123.4, 456.7'), null);
  assert.equal(parseCoordsInput('https://maps.app.goo.gl/AbCdEf123'), null);
  assert.equal(parseCoordsInput(''), null);
});

test('googleMapsSearchUrl은 검색어를 인코딩한 Google 지도 검색 주소를 만든다', () => {
  assert.equal(googleMapsSearchUrl('니시키 시장'), 'https://www.google.com/maps/search/?api=1&query=%EB%8B%88%EC%8B%9C%ED%82%A4%20%EC%8B%9C%EC%9E%A5');
  assert.equal(googleMapsSearchUrl(''), 'https://www.google.com/maps');
});
