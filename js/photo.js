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

// Firestore에서 읽은 바이트를 <img>에 쓸 수 있는 object URL로 바꾼다. 다 쓰면 URL.revokeObjectURL로 해제.
export function bytesToObjectUrl(uint8) {
  return URL.createObjectURL(new Blob([uint8], { type: 'image/jpeg' }));
}
