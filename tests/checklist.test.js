import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDoneFor, allCheckedAfter, personalProgress, checkedMembers, isPersonalByDefault } from '../js/lib/checklist.js';

const members = ['a@x.com', 'b@x.com', 'c@x.com'];

test('isDoneFor: 함께 챙기는 항목은 done, 각자 항목은 내가 체크했는지', () => {
  assert.equal(isDoneFor({ done: true }, 'a@x.com'), true);
  assert.equal(isDoneFor({ personal: true, done: false, doneBy: ['b@x.com'] }, 'a@x.com'), false);
  assert.equal(isDoneFor({ personal: true, done: false, doneBy: ['B@x.com'] }, 'b@x.com'), true);
  assert.equal(isDoneFor({ personal: true, done: true }, 'a@x.com'), false); // doneBy 가 없으면 아무도 안 한 것
});

test('allCheckedAfter: 내가 체크·해제한 뒤 동행 모두가 체크했는지 (문서의 done)', () => {
  const item = { personal: true, doneBy: ['a@x.com', 'b@x.com'] };
  assert.equal(allCheckedAfter(item, members, 'c@x.com', true), true);
  assert.equal(allCheckedAfter(item, members, 'a@x.com', false), false);
  assert.equal(allCheckedAfter({ personal: true, doneBy: ['gone@x.com'] }, members, 'a@x.com', true), false); // 나간 동행은 세지 않는다
  assert.equal(allCheckedAfter(item, [], 'a@x.com', true), false);
});

test('personalProgress: 지금 동행 가운데 몇 명이 했나, 함께 챙기는 항목은 null', () => {
  assert.deepEqual(personalProgress({ personal: true, doneBy: ['a@x.com', 'gone@x.com'] }, members), { done: 1, total: 3 });
  assert.equal(personalProgress({ done: true }, members), null);
  assert.deepEqual(checkedMembers({ doneBy: ['c@x.com'] }, members), ['c@x.com']);
});

test('isPersonalByDefault: 여권·짐처럼 사람마다 챙길 것만', () => {
  assert.equal(isPersonalByDefault('여권 유효기간 확인'), true);
  assert.equal(isPersonalByDefault('숙소 예약'), false);
});
