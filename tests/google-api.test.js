import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// 구글 지도 요금이 드는 호출이 슬그머니 늘지 않게. 도보 길은 일정의 "길찾기"(구글 지도 앱·웹, 요금 없음)로 본다.
const jsFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? jsFiles(p) : e.name.endsWith('.js') ? [p] : [];
});

test('앱은 구글 Routes API(도보 경로)를 부르지 않는다', () => {
  for (const file of jsFiles('js')) {
    assert.ok(!fs.readFileSync(file, 'utf8').includes('routes.googleapis.com'), `${file} 가 Routes API 를 부른다`);
  }
});
