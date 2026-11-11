// 편집 저장: 연 뒤로 내가 바꾼 필드만 고른다 (순수 함수, 테스트 대상).
// 창을 연 시점의 값을 통째로 다시 쓰면, 그 사이 동행이 고친 다른 필드(메모 등)를 옛 값으로 덮어쓴다.

const same = (a, b) => {
  if (a === b) return true;
  if (a == null && b == null) return true; // 없는 것과 null 은 같다 (예전 문서엔 필드가 없기도 하다)
  if (a == null || b == null) return false;
  if (typeof a !== 'object' && typeof b !== 'object') return false;
  return JSON.stringify(a) === JSON.stringify(b);
};

// base: 창을 열 때의 문서, next: 저장하려는 값. 반환: next 중 base 와 다른 필드만
export function changedFields(base, next) {
  const out = {};
  for (const [key, value] of Object.entries(next ?? {})) {
    if (!same(base?.[key], value)) out[key] = value;
  }
  return out;
}

export function hasChanges(changes) {
  return Object.keys(changes ?? {}).length > 0;
}
