import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeFileType } from '../js/lib/file-type.js';

test('safeFileType: PDF 는 PDF 로 연다', () => {
  assert.equal(safeFileType('application/pdf', 'application/pdf'), 'application/pdf');
});

test('safeFileType: 목록에는 PDF 라고 해 놓고 실제 문서가 HTML 이어도 HTML 로 열지 않는다', () => {
  assert.equal(safeFileType('application/pdf', 'text/html'), 'application/pdf');
});

test('safeFileType: 허용한 이미지 형식은 그대로', () => {
  assert.equal(safeFileType('image/png', 'image/png'), 'image/png');
  assert.equal(safeFileType('image/webp', 'image/webp'), 'image/webp');
  assert.equal(safeFileType('image/jpeg', 'image/jpeg'), 'image/jpeg');
});

test('safeFileType: 스크립트가 들어갈 수 있는 형식은 JPEG 로 바꿔 이미지로만 다룬다', () => {
  assert.equal(safeFileType('text/html', 'text/html'), 'image/jpeg');
  assert.equal(safeFileType('image/svg+xml', 'image/svg+xml'), 'image/jpeg');
  assert.equal(safeFileType('image/png', 'text/html'), 'image/jpeg');
  assert.equal(safeFileType(undefined, undefined), 'image/jpeg');
});
