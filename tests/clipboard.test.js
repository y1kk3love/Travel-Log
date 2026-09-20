import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageFilesFrom } from '../js/lib/clipboard.js';

const fake = (type, name = 'x') => ({ type, name });

test('imageFilesFrom: 이미지 타입만 남긴다', () => {
  const files = [fake('image/png', 'a.png'), fake('text/plain', 'b.txt'), fake('image/jpeg', 'c.jpg'), fake('', 'd')];
  assert.deepEqual(imageFilesFrom(files).map((f) => f.name), ['a.png', 'c.jpg']);
});

test('imageFilesFrom: 비어 있거나 null이면 빈 배열', () => {
  assert.deepEqual(imageFilesFrom(null), []);
  assert.deepEqual(imageFilesFrom([]), []);
});
