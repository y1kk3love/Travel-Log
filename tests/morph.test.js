import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// 공유 요소 전환: 한 번에 한 쌍에만 이름을 주고, 짝이 그려지면 기다림을 풀고, 끝나면 지운다
const fresh = () => import(`../js/morph.js?t=${Math.random()}`);
const node = () => ({ style: { viewTransitionName: '' } });
let h1;

beforeEach(() => {
  h1 = node();
  globalThis.document = { startViewTransition() {}, querySelector: (sel) => (sel === '.trip-header h1' ? h1 : null) };
});
afterEach(() => { delete globalThis.document; });

test('홈 카드 → 여행 화면: 카드 제목과 큰 제목이 같은 이름, 큰 제목이 그려지면 기다림이 풀린다', async () => {
  const m = await fresh();
  const card = node();
  m.morphFromCard(card, 'T1');
  assert.equal(card.style.viewTransitionName, 'trip-title');
  const waiting = m.morphArrival({ name: 'trip', tripId: 'T1' }, 1000);
  let done = false;
  waiting.then(() => { done = true; });
  m.morphArrive(node(), 'T2', 'trip'); // 다른 여행이면 이름을 주지 않는다
  await Promise.resolve();
  assert.equal(done, false);
  const title = node();
  m.morphArrive(title, 'T1', 'trip');
  await waiting;
  assert.equal(title.style.viewTransitionName, 'trip-title');
  m.clearMorph(); // 전환이 끝나면 지운다 (다음 전환에 이름이 남으면 같은 이름이 둘이 되어 통째로 건너뛴다)
  assert.equal(card.style.viewTransitionName, '');
  assert.equal(title.style.viewTransitionName, '');
});

test('여행 화면 → 홈(뒤로가기): 큰 제목에 이름, 예상과 다른 화면으로 가면 이름을 지우고 기다리지 않는다', async () => {
  const m = await fresh();
  m.morphArrive(node(), 'T1', 'trips'); // 홈에 이 여행 카드가 그려진 적이 있다
  m.morphLeave({ name: 'trip', tripId: 'T1' }, { name: 'trips' });
  assert.equal(h1.style.viewTransitionName, 'trip-title');
  await m.morphArrival({ name: 'admin' }, 1000); // 관리자 화면으로 갔다면 바로 진행
  assert.equal(h1.style.viewTransitionName, '');
  m.morphLeave({ name: 'trip', tripId: 'T1' }, { name: 'trip', tripId: 'T1', tab: 'checklist' }); // 탭 이동은 대상 아님
  assert.equal(h1.style.viewTransitionName, '');
});

test('홈 목록에 없는 여행(관리자가 연 남의 여행)에서 홈으로 가면 이름을 주지 않고 기다리지도 않는다', async () => {
  const m = await fresh();
  m.morphArrive(node(), 'T1', 'trips');
  m.morphLeave({ name: 'trip', tripId: 'X9' }, { name: 'trips' });
  assert.equal(h1.style.viewTransitionName, '');
  const t0 = Date.now();
  await m.morphArrival({ name: 'trips' }, 1000);
  assert.ok(Date.now() - t0 < 100, '짝이 없는데 기다림');
});

test('전환 중에 또 이동하면, 건너뛴 앞 전환이 끝나며 지우는 것이 다음 전환의 이름을 건드리지 않는다', async () => {
  const m = await fresh();
  m.morphArrive(node(), 'T1', 'trips');
  m.morphFromCard(node(), 'T1');
  const first = m.morphToken(); // 카드 → 여행 전환
  m.morphLeave({ name: 'trip', tripId: 'T1' }, { name: 'trips' }); // 그 전환 도중 뒤로가기
  const second = m.morphToken();
  m.clearMorph(first); // 앞 전환이 건너뛰어지며 finished
  assert.equal(h1.style.viewTransitionName, 'trip-title');
  m.clearMorph(second);
  assert.equal(h1.style.viewTransitionName, '');
});

test('짝이 늦게까지 안 그려지면 정해진 시간만 기다린다 (전환이 멈춘 채로 있지 않게)', async () => {
  const m = await fresh();
  m.morphFromCard(node(), 'T1');
  const t0 = Date.now();
  await m.morphArrival({ name: 'trip', tripId: 'T1' }, 30);
  assert.ok(Date.now() - t0 >= 25);
});

test('View Transitions 가 없는 브라우저에서는 아무것도 하지 않는다', async () => {
  globalThis.document = { querySelector: () => h1 };
  const m = await fresh();
  const card = node();
  m.morphFromCard(card, 'T1');
  assert.equal(card.style.viewTransitionName, '');
  await m.morphArrival({ name: 'trip', tripId: 'T1' }, 1000); // 기다리지 않는다
});
