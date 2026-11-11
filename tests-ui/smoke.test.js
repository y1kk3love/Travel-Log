// 화면 테스트 (npm run test:ui): 실제 화면 코드를 가짜 데이터(harness/)로 띄워 주요 흐름이 깨지지 않았는지 본다.
// 로그인·Firebase·구글 지도 없이 돈다 — 이 컴퓨터 밖으로 나가는 요청은 모두 막는다 (지도 로드 한도도 쓰지 않는다).
// 브라우저는 내려받지 않고 설치된 크롬(없으면 엣지)을 쓴다. CI(ubuntu) 에는 크롬이 들어 있다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

let server, browser, base;
const problems = []; // 화면에서 난 오류 (테스트마다 비운다)

before(async () => {
  server = http.createServer((req, res) => {
    let file = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (file.endsWith('/')) file += 'index.html';
    const full = path.join(ROOT, file);
    if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(full)] ?? 'application/octet-stream' }).end(fs.readFileSync(full));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/harness/`;
  const channels = process.env.PW_CHANNEL ? [process.env.PW_CHANNEL] : ['chrome', 'msedge'];
  let lastError;
  for (const channel of channels) {
    try { browser = await chromium.launch({ channel }); break; } catch (err) { lastError = err; }
  }
  if (!browser) throw lastError;
});
after(async () => { await browser?.close(); await new Promise((r) => server.close(r)); });

// 폰 크기 화면을 연다. 밖으로 나가는 요청(글꼴·지도·날씨)은 막는다
async function open(hash, { width = 390, height = 844 } = {}) {
  problems.length = 0;
  const page = await browser.newPage({ viewport: { width, height } });
  await page.route((url) => url.hostname !== '127.0.0.1', (route) => route.abort());
  page.on('pageerror', (err) => problems.push(String(err)));
  await page.goto(base + hash);
  return page;
}
const noProblems = () => assert.deepEqual(problems, [], '화면에서 오류가 났다');
const texts = (page, selector) => page.locator(selector).allTextContents();

test('홈: 여행 목록이 뜨고, 대표 사진 없는 카드의 안내가 태그와 겹치지 않는다', async () => {
  const page = await open('#/');
  await page.locator('.trip-feature').first().waitFor();
  assert.ok((await texts(page, '.trip-title')).includes('대환장친구들'));
  const hint = await page.locator('.trip-feature .cover-hint').first().boundingBox();
  const meta = await page.locator('.trip-feature .trip-meta').first().boundingBox();
  assert.ok(hint.y + hint.height <= meta.y, '안내 글이 D-day·동행 태그 위에서 끝나야 한다');
  noProblems();
  await page.close();
});

test('일정: 있는 장소를 열면 읽기 화면이 먼저, "편집"을 눌러야 입력 폼. 바꾼 시간이 저장된다', async () => {
  const page = await open('#/trip/T1');
  await page.locator('.tl-item[data-id="P2"] .tl-open').click();
  const sheet = page.locator('.sheet');
  await sheet.waitFor();
  assert.equal(await sheet.getAttribute('role'), 'dialog');
  assert.equal(await sheet.getAttribute('aria-modal'), 'true');
  assert.equal(await page.locator('#app').evaluate((n) => n.inert), true, '창이 열린 동안 뒤 화면은 잠근다');
  assert.equal((await sheet.locator('h2').textContent()), '오사카성');
  assert.ok(await sheet.locator('.place-view-memo').isVisible(), '메모가 첫 화면에 보인다');
  assert.equal(await sheet.locator('#ps-name').isVisible(), false, '입력 폼은 아직 안 보인다');
  await page.locator('.photo-chip').nth(1).waitFor(); // 썸네일 두 장
  await sheet.getByRole('button', { name: '편집' }).click();
  assert.equal(await sheet.locator('h2').textContent(), '장소 편집');
  await sheet.locator('#ps-time').fill('14:30');
  await sheet.getByRole('button', { name: '저장' }).click();
  await page.locator('.sheet-overlay').waitFor({ state: 'detached' });
  assert.match(await page.locator('.tl-item[data-id="P2"] .tl-meta').textContent(), /14:30/);
  assert.equal(await page.locator('#app').evaluate((n) => n.inert), false);
  noProblems();
  await page.close();
});

test('일정: 썸네일을 누르면 원본을 받아 크게 보여 준다', async () => {
  const page = await open('#/trip/T1');
  await page.locator('.tl-item[data-id="P2"] .tl-open').click();
  await page.locator('.photo-chip .photo-open').first().click();
  const img = page.locator('.lightbox img');
  await img.waitFor();
  await page.waitForFunction(() => document.querySelector('.lightbox img')?.naturalWidth > 0);
  assert.equal(await img.evaluate((n) => n.naturalWidth), 1280, '원본(1280px)이 열린다');
  noProblems();
  await page.close();
});

test('보관함: 분류로 걸러 보고 지역별로 묶인다', async () => {
  const page = await open('#/trip/T1');
  await page.locator('.pool-item').first().waitFor();
  assert.deepEqual(await texts(page, '.pool-region'), ['교토부 4', '나라현 1', '효고현 1', '기타 1']);
  await page.locator('.pool-filter .chip', { hasText: '식사' }).click();
  assert.deepEqual(await texts(page, '.pool-item .tl-name'), ['니시키 시장', '스테이크랜드 고베관', '친구가 알려 준 라멘집']);
  await page.locator('.pool-filter .chip', { hasText: '전체' }).click();
  assert.equal(await page.locator('.pool-item').count(), 7);
  noProblems();
  await page.close();
});

test('일정: 순서를 끌어 옮기면 항목이 손가락을 따라오고 놓은 자리로 간다', async () => {
  const page = await open('#/trip/T1', { width: 390, height: 1400 }); // 일정이 한 화면에 다 들어오게 (가장자리 자동 스크롤 없이)
  const handle = page.locator('.tl-item[data-id="P1"] .drag-handle');
  await handle.waitFor();
  await page.waitForTimeout(700); // 처음 떠오르는 움직임이 끝난 뒤
  const box = await handle.boundingBox();
  const target = await page.locator('.tl-item[data-id="P4"]').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 80, { steps: 4 });
  assert.match(await page.locator('.tl-item[data-id="P1"]').evaluate((n) => n.style.transform), /translateY\(/, '끄는 항목이 따라온다');
  await page.mouse.move(box.x + box.width / 2, target.y + 4, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector('.timeline .tl-item .tl-name')?.textContent === '오사카성');
  assert.deepEqual(await texts(page, '.timeline .tl-item .tl-name'), ['오사카성', '저녁은 도톤보리에서 자유롭게', '간사이 국제공항 (KIX)', '호텔 체크인']);
  noProblems();
  await page.close();
});

test('일정: 끌다가 화면 아래 가장자리에 가면 스스로 스크롤한다', async () => {
  const page = await open('#/trip/T1', { width: 390, height: 640 });
  const handle = page.locator('.tl-item[data-id="P1"] .drag-handle');
  await handle.waitFor();
  await page.waitForTimeout(700);
  await handle.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, 630, { steps: 5 }); // 화면 맨 아래 근처에서 멈춘다
  await page.waitForFunction((y) => window.scrollY > y + 40, before);
  await page.mouse.move(box.x + box.width / 2, 300, { steps: 3 }); // 가운데로 돌아오면 멈춘다
  const stopped = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.scrollY), stopped);
  await page.mouse.up();
  noProblems();
  await page.close();
});

test('긴 여행: Day 를 골라도 Day 탭의 가로 스크롤이 처음으로 돌아가지 않고, 고른 탭이 화면 안에 있다', async () => {
  const page = await open('#/trip/T6');
  await page.locator('.day-tab').nth(9).waitFor();
  await page.locator('.day-tab').nth(7).scrollIntoViewIfNeeded();
  await page.locator('.day-tab').nth(7).click();
  await page.locator('.day-title', { hasText: 'Day 8' }).waitFor();
  assert.ok(await page.locator('.day-tabs').evaluate((n) => n.scrollLeft) > 0, '스크롤 자리를 지킨다');
  await page.locator('.day-tab').nth(9).click();
  const tab = await page.locator('.day-tab.active').boundingBox();
  assert.ok(tab.x >= 0 && tab.x + tab.width <= 390, '고른 Day 가 화면 안에 보인다');
  assert.equal(await page.locator('.day-tabs').evaluate((n) => getComputedStyle(n).position), 'sticky');
  noProblems();
  await page.close();
});

test('예약·지출·체크리스트: 폰에서 첫 내용이 화면 위쪽에서 시작한다', async () => {
  const page = await open('#/trip/T1/reservations');
  await page.locator('.reservation').first().waitFor();
  assert.ok((await page.locator('.reservation').first().boundingBox()).y < 300, '첫 예약 카드');
  await page.goto(`${base}#/trip/T1/expenses`);
  await page.locator('.expense-row').first().waitFor();
  const row = await page.locator('.expense-row').first().boundingBox();
  const receipt = await page.locator('.receipt').boundingBox();
  assert.ok(row.y < 600, '첫 지출이 첫 화면 안에 있다');
  assert.ok(row.y < receipt.y, '지출 목록이 정산 영수증보다 위');
  await page.goto(`${base}#/trip/T1/checklist`);
  await page.locator('.check-group').first().waitFor();
  assert.ok((await page.locator('.check-group').first().boundingBox()).y < 300, '첫 체크리스트 그룹');
  noProblems();
  await page.close();
});

test('체크리스트: "각자" 항목은 내 체크만 바뀌고 몇 명이 했는지 보인다', async () => {
  const page = await open('#/trip/T1/checklist');
  const row = page.locator('.check-row', { hasText: '여권 유효기간 확인' });
  await row.waitFor();
  assert.equal(await row.locator('.check-personal').textContent(), '각자 2/7');
  assert.equal(await row.locator('input[type=checkbox]').isChecked(), false, '남이 체크해도 내 것은 그대로');
  await row.locator('input[type=checkbox]').check();
  await page.locator('.check-row', { hasText: '여권 유효기간 확인' }).locator('.check-personal', { hasText: '각자 3/7' }).waitFor();
  assert.equal(await page.locator('.check-row', { hasText: '여권 유효기간 확인' }).locator('input[type=checkbox]').isChecked(), true);
  noProblems();
  await page.close();
});

test('넓은 화면: 지출은 두 단이고 정산 영수증은 종이 폭을 넘지 않는다', async () => {
  const page = await open('#/trip/T1/expenses', { width: 1280, height: 800 });
  await page.locator('.receipt').waitFor();
  const receipt = await page.locator('.receipt').boundingBox();
  const list = await page.locator('.expense-list').boundingBox();
  assert.ok(receipt.width <= 440, `영수증 폭 ${receipt.width}`);
  assert.ok(list.x + list.width <= receipt.x, '목록은 왼쪽, 영수증은 오른쪽');
  noProblems();
  await page.close();
});

test('시작 실패: 모듈 하나가 옛 파일이라 앱이 시작하지 못하면 한 번 스스로 다시 열어 정상으로 돌아온다', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route((url) => url.hostname !== '127.0.0.1', (route) => route.abort());
  // 배포 직후처럼: 첫 번째로 받는 router.js 는 app.js 가 찾는 이름이 없는 "옛 파일"
  let served = 0;
  await page.route('**/js/router.js', (route) => {
    served += 1;
    if (served === 1) route.fulfill({ contentType: 'text/javascript; charset=utf-8', body: 'export const old = true;' });
    else route.continue();
  });
  await page.goto(`${base}#/`);
  await page.locator('.trip-feature').first().waitFor(); // 스스로 다시 연 뒤 홈이 뜬다
  assert.ok(served >= 2, '다시 받아 왔다');
  assert.equal(await page.evaluate(() => window.__tlBooted), true);
  await page.close();
});

test('시작 실패: 다시 열어도 안 되면 계속 돌지 않고 "다시 열기" 안내를 보여 준다', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route((url) => url.hostname !== '127.0.0.1', (route) => route.abort());
  let served = 0;
  await page.route('**/js/router.js', (route) => { served += 1; route.fulfill({ contentType: 'text/javascript; charset=utf-8', body: 'export const old = true;' }); });
  await page.goto(`${base}#/`);
  await page.getByRole('button', { name: '다시 열기' }).waitFor();
  await page.waitForTimeout(1800);
  assert.equal(served, 2, '한 번만 스스로 다시 열었다');
  await page.close();
});
