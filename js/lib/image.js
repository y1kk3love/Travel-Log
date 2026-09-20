// 사진 축소 계산 (순수 함수). 실제 픽셀 처리는 js/photo.js가 한다.
const START_QUALITY = 0.85;
const MIN_QUALITY = 0.4;
const STEP = 0.1;

export function fitWithin(width, height, maxSide) {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// JPEG 품질을 단계적으로 낮출 때 다음 값. 더 내릴 수 없으면 null.
export function nextQuality(current) {
  if (current == null) return START_QUALITY;
  if (current <= MIN_QUALITY) return null;
  return Math.max(MIN_QUALITY, Math.round((current - STEP) * 100) / 100);
}
