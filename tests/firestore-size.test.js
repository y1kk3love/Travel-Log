import test from 'node:test';
import assert from 'node:assert/strict';
import { docSize, valueSize, formatBytes, STORAGE_LIMIT_BYTES, storagePercent, blobDocOverhead, aggregateSize } from '../js/lib/firestore-size.js';

test('valueSize: Firestore 문서 크기 계산식 (문자열 UTF-8+1, 숫자 8, 불리언·null 1, 바이트 길이, 배열·맵 합)', () => {
  assert.equal(valueSize('Jeff'), 5);
  assert.equal(valueSize('한글'), 7); // 3바이트 × 2 + 1
  assert.equal(valueSize(21), 8);
  assert.equal(valueSize(true), 1);
  assert.equal(valueSize(null), 1);
  assert.equal(valueSize(new Uint8Array(950 * 1024)), 950 * 1024);
  assert.equal(valueSize({ toUint8Array: () => new Uint8Array(10) }), 10); // Firestore Bytes
  assert.equal(valueSize({ seconds: 1, nanoseconds: 0, toMillis: () => 1000 }), 8); // Timestamp
  assert.equal(valueSize(['a', 'b']), 4);
  assert.equal(valueSize({ name: 'Jeff', age: 21 }), 5 + 5 + 4 + 8);
});

test('docSize: 경로(세그먼트마다 +1, 끝에 16) + 필드 이름·값 + 32', () => {
  // users/jeff: (5+1)+(4+1)+16 = 27, 필드 name(5)+"Jeff"(5), age(4)+21(8) → 27+22+32 = 81
  assert.equal(docSize('users/jeff', { name: 'Jeff', age: 21 }), 81);
  assert.equal(docSize('trips/t1/photos/p1', { data: new Uint8Array(1000) }), (6 + 3 + 7 + 3 + 16) + (5 + 1000) + 32);
});

test('formatBytes / storagePercent: 1 GiB 한도 기준', () => {
  assert.equal(STORAGE_LIMIT_BYTES, 1024 ** 3);
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(138 * 1024 * 1024), '138 MB');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(storagePercent(1024 ** 3 / 8), 12.5);
});

test('사진·서류는 내려받지 않고 어림: 서버가 준 개수·size 합계 + 문서마다 바이트 뺀 나머지', () => {
  const id = 'x'.repeat(20);
  const photo = (n) => ({ placeId: id, data: new Uint8Array(n), width: 1600, height: 1200, createdAt: { seconds: 1, nanoseconds: 0 }, size: n });
  const path = `trips/${id}/photos/${id}`;
  // 실제 사진 문서 크기 = 바이트 + 문서 하나의 나머지 (아이디가 20자인 앱 문서 기준)
  assert.equal(docSize(path, photo(1000)), 1000 + blobDocOverhead('photos'));
  assert.equal(docSize(path, photo(700 * 1024)), 700 * 1024 + blobDocOverhead('photos'));
  assert.equal(aggregateSize('photos', { count: 3, bytes: 3000 }), 3000 + 3 * blobDocOverhead('photos'));
  assert.equal(aggregateSize('files', { count: 0, bytes: 0 }), 0);
  assert.ok(blobDocOverhead('files') > blobDocOverhead('photos') - 50); // 서류는 파일 이름·형식이 더 붙는다
});
