import test from 'node:test';
import assert from 'node:assert/strict';
import { linkify, extractLinks, shortLabel } from '../js/lib/text.js';

test('linkify: 글 속 URL 을 링크 조각으로 나눈다 (끝의 마침표는 제외)', () => {
  assert.deepEqual(linkify('예약은 https://example.com/book?id=1. 그리고 www.naver.com 참고'), [
    { type: 'text', value: '예약은 ' },
    { type: 'link', value: 'https://example.com/book?id=1', label: 'example.com/book?id=1' },
    { type: 'text', value: '. 그리고 ' },
    { type: 'link', value: 'https://www.naver.com', label: 'naver.com' },
    { type: 'text', value: ' 참고' },
  ]);
});

test('linkify: URL 이 없으면 글자 하나, 빈 문자열은 빈 배열', () => {
  assert.deepEqual(linkify('그냥 메모'), [{ type: 'text', value: '그냥 메모' }]);
  assert.deepEqual(linkify(''), []);
  assert.deepEqual(linkify(null), []);
});

test('extractLinks / shortLabel', () => {
  assert.deepEqual(extractLinks('a https://a.com b https://b.com/x'), ['https://a.com', 'https://b.com/x']);
  assert.equal(shortLabel('https://www.google.com/maps/place/very/long/path/that/keeps/going/on/and/on'), 'google.com/maps/place/very/long/path/…');
});
