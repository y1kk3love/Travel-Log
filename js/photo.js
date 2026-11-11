import { fitWithin, nextQuality } from './lib/image.js';

const MAX_SIDE = 1280;
// Firestore 문서 한도가 1MiB. 다른 필드 여유를 두고 사진 바이트는 이 이하로 맞춘다.
const MAX_BYTES = 700 * 1024;

// 파일을 긴 변 maxSide px JPEG로 줄인다. EXIF 회전을 반영하고, 크기가 클수록 품질을 낮춘다.
// 반환: { bytes: Uint8Array, width, height }
export async function compressImage(file, { maxSide = MAX_SIDE, maxBytes = MAX_BYTES } = {}) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('unsupported-image');
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = nextQuality(null);
  let blob = null;
  while (quality != null) {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= maxBytes) break;
    quality = nextQuality(quality);
  }
  if (!blob) throw new Error('encode-failed');
  if (blob.size > maxBytes) throw new Error('too-large');
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
}

// 장소 창의 작은 미리보기용 썸네일 (긴 변 240px, 십몇 KB). 원본 JPEG 바이트에서 만든다.
// 반환: { bytes, width, height }. 문서 한도(규칙 60 KiB)를 넘으면 품질을 낮춘다
const THUMB_SIDE = 240;
const THUMB_MAX_BYTES = 48 * 1024;
export function makeThumb(bytes) {
  return compressImage(new Blob([bytes], { type: 'image/jpeg' }), { maxSide: THUMB_SIDE, maxBytes: THUMB_MAX_BYTES });
}

// Firestore에서 읽은 바이트를 <img>에 쓸 수 있는 object URL로 바꾼다. 다 쓰면 URL.revokeObjectURL로 해제.
export function bytesToObjectUrl(uint8) {
  return URL.createObjectURL(new Blob([uint8], { type: 'image/jpeg' }));
}
