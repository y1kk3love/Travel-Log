import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inviteMessage, shareInvite, SITE_URL, APP_URL } from '../js/lib/invite.js';

test('inviteMessage: 여행 초대 — 여행 이름·날짜, 로그인할 계정, 그 여행으로 가는 웹 주소, 앱 받는 곳', () => {
  const trip = { id: 'T1', title: '대환장친구들', startDate: '2027-02-13', endDate: '2027-02-16' };
  const { title, text } = inviteMessage({ email: 'friend1@gmail.com', trip });
  assert.equal(title, '여행 로그 초대');
  assert.equal(text, [
    "[여행 로그] '대환장친구들' 여행(2027.02.13 – 02.16 · 3박 4일)에 초대했어요.",
    'friend1@gmail.com 구글 계정으로 로그인하면 일정·예약·지출을 함께 보고 고칠 수 있어요.',
    '',
    `웹: ${SITE_URL}#/trip/T1`,
    `안드로이드 앱: ${APP_URL}`,
  ].join('\n'));
});

test('inviteMessage: 사이트 초대(여행 없음) — 사이트 첫 화면으로', () => {
  const { text } = inviteMessage({ email: 'new@gmail.com' });
  assert.equal(text, [
    '[여행 로그] 여행 플래너 "여행 로그"에 초대했어요.',
    'new@gmail.com 구글 계정으로 로그인해 주세요.',
    '',
    `웹: ${SITE_URL}`,
    `안드로이드 앱: ${APP_URL}`,
  ].join('\n'));
  assert.equal(SITE_URL, 'https://y1kk3love.github.io/Travel-Log/');
  assert.equal(APP_URL, 'https://github.com/y1kk3love/Travel-Log/releases/latest');
});

test('shareInvite: 앱이면 안드로이드 공유 창, 아니면 브라우저 공유 창, 둘 다 없으면 복사', async () => {
  const msg = { title: 't', text: 'x' };
  const calls = [];
  const native = async (m) => { calls.push(['native', m]); return true; };
  const webShare = async (m) => { calls.push(['web', m]); };
  const copy = async (s) => { calls.push(['copy', s]); };
  assert.equal(await shareInvite(msg, { native, webShare, copy }), 'native');
  assert.deepEqual(calls, [['native', msg]]);

  calls.length = 0;
  assert.equal(await shareInvite(msg, { native: async () => false, webShare, copy }), 'shared');
  assert.deepEqual(calls, [['web', { title: 't', text: 'x' }]]);

  calls.length = 0;
  assert.equal(await shareInvite(msg, { native: async () => false, webShare: null, copy }), 'copied');
  assert.deepEqual(calls, [['copy', 'x']]);
});

test('shareInvite: 공유 창을 닫으면(취소) 복사하지 않고, 공유가 실패하면 복사로, 복사도 안 되면 failed', async () => {
  const msg = { title: 't', text: 'x' };
  const abort = Object.assign(new Error('cancel'), { name: 'AbortError' });
  let copied = 0;
  const copy = async () => { copied += 1; };
  assert.equal(await shareInvite(msg, { native: async () => false, webShare: async () => { throw abort; }, copy }), 'cancelled');
  assert.equal(copied, 0);
  assert.equal(await shareInvite(msg, { native: async () => false, webShare: async () => { throw new Error('NotAllowed'); }, copy }), 'copied');
  assert.equal(copied, 1);
  assert.equal(await shareInvite(msg, { native: async () => false, webShare: null, copy: async () => { throw new Error('denied'); } }), 'failed');
});
