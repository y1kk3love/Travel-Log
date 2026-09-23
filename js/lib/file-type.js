// 예약 서류를 열 때 쓸 형식. 문서에 적힌 형식을 그대로 믿으면 HTML 을 PDF 로 꾸며 앱 안에서 스크립트를 돌릴 수 있으므로,
// PDF 와 스크립트가 없는 이미지 형식만 허용하고 나머지는 JPEG 로 다룬다(이미지로만 보여 주면 스크립트가 돌지 않는다).
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']);

// metaType: 예약 문서 files 배열에 적힌 형식(열기 방식을 정함), storedType: 파일 문서에 적힌 형식
export function safeFileType(metaType, storedType) {
  if (metaType === 'application/pdf') return 'application/pdf';
  if (IMAGE_TYPES.has(metaType) && metaType === storedType) return metaType;
  return 'image/jpeg';
}
