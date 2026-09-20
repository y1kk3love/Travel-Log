// 파일 목록(FileList, 배열, DataTransfer.files)에서 이미지만 골라낸다.
export function imageFilesFrom(files) {
  if (!files) return [];
  return Array.from(files).filter((f) => f && typeof f.type === 'string' && f.type.startsWith('image/'));
}
