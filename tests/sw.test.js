import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { precacheList } from '../scripts/sw-precache.js';

const sw = () => fs.readFileSync('sw.js', 'utf8').replace(/\r\n/g, '\n');

test('서비스 워커가 설치 때 앱 파일(모든 JS 모듈)을 미리 받아 둔다 (한 번 연 뒤 오프라인이어도 열리게)', () => {
  const listed = JSON.parse(sw().match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
  assert.deepEqual(listed, precacheList(), 'sw.js 의 PRECACHE 가 실제 파일과 다르다 — npm run sw:precache 로 갱신');
  assert.ok(listed.includes('js/app.js') && listed.includes('js/views/planner.js') && listed.includes('css/main.css'));
});

test('같은 출처 요청은 서버에 바뀌었는지 묻고(no-cache), 느리면 캐시로 넘어간다', () => {
  const s = sw();
  assert.match(s, /cache: 'no-cache'/); // 배포 직후 HTTP 캐시(10분)에 남은 옛 파일과 새 파일이 섞이지 않게
  assert.match(s, /NETWORK_WAIT_MS/);
});

test('주소의 쿼리(공유로 받은 글 등)는 캐시 키에 넣지 않는다', () => {
  assert.match(sw(), /cacheKey/);
});
