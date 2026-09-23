// Firestore 문서 크기 계산 (순수 함수). 공식 문서 "저장 용량 계산" 규칙을 그대로 따른다.
// 문자열: UTF-8 바이트 + 1, 숫자: 8, 불리언·null: 1, 바이트: 길이, 타임스탬프: 8, 배열: 원소 합, 맵: (키 문자열 + 값) 합.
// 문서 = 이름 크기(세그먼트마다 UTF-8 바이트 + 1, 마지막에 16) + 필드마다(이름 + 값) + 32.
export const STORAGE_LIMIT_BYTES = 1024 ** 3; // Spark 무료 한도 1 GiB

const utf8 = (s) => new TextEncoder().encode(String(s)).length;

export function valueSize(v) {
  if (v === null || v === undefined || typeof v === 'boolean') return 1;
  if (typeof v === 'number') return 8;
  if (typeof v === 'string') return utf8(v) + 1;
  if (v instanceof Uint8Array || ArrayBuffer.isView(v)) return v.byteLength;
  if (Array.isArray(v)) return v.reduce((sum, x) => sum + valueSize(x), 0);
  if (typeof v === 'object') {
    if (typeof v.toUint8Array === 'function') return v.toUint8Array().length; // Firestore Bytes
    if (typeof v.toMillis === 'function' || (typeof v.seconds === 'number' && typeof v.nanoseconds === 'number')) return 8; // Timestamp
    if (typeof v.latitude === 'number' && typeof v.longitude === 'number') return 16; // GeoPoint
    return Object.entries(v).reduce((sum, [k, x]) => sum + utf8(k) + 1 + valueSize(x), 0);
  }
  return 8;
}

export function docSize(path, data) {
  const name = String(path).split('/').filter(Boolean).reduce((sum, seg) => sum + utf8(seg) + 1, 0) + 16;
  const fields = Object.entries(data ?? {}).reduce((sum, [k, v]) => sum + utf8(k) + 1 + valueSize(v), 0);
  return name + fields + 32;
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${trim(n / 1024)} KB`;
  if (n < 1024 ** 3) return `${trim(n / 1024 ** 2)} MB`;
  return `${trim(n / 1024 ** 3)} GB`;
}
const trim = (x) => String(Math.round(x * 10) / 10);

export function storagePercent(bytes, limit = STORAGE_LIMIT_BYTES) {
  return Math.round((bytes / limit) * 1000) / 10;
}

// 사진·서류: 바이트가 큰 문서라 내려받지 않고 서버에 개수·size 합계만 물어 어림한다.
// 문서 하나의 "바이트를 뺀 나머지"는 앱이 만드는 모양(아이디 20자, 서류 이름은 30바이트쯤)으로 계산해 둔다.
const ID = 'x'.repeat(20);
const TS = { seconds: 0, nanoseconds: 0 };
const BLOB_TEMPLATES = {
  photos: { placeId: ID, data: new Uint8Array(0), width: 0, height: 0, createdAt: TS, size: 0 },
  files: { reservationId: ID, name: 'x'.repeat(30), type: 'application/pdf', size: 0, data: new Uint8Array(0), createdAt: TS },
};

export function blobDocOverhead(col) {
  return docSize(`trips/${ID}/${col}/${ID}`, BLOB_TEMPLATES[col]);
}

export function aggregateSize(col, { count, bytes }) {
  return bytes + count * blobDocOverhead(col);
}
