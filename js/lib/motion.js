// 애니메이션용 순수 계산 (테스트 대상). 화면 쪽은 js/motion.js.

// 처음엔 빠르고 끝에서 천천히 멈추는 곡선 (토스식 숫자 세기·밀려 들어오기)
export function easeOutCubic(t) {
  const x = Math.min(Math.max(t, 0), 1);
  return 1 - (1 - x) ** 3;
}

export function tween(from, to, t) {
  return from + (to - from) * easeOutCubic(t);
}

// 숫자 여러 개를 이전 값에서 새 값으로 (정수). t=1 이면 정확히 새 값. 이전 값이 없던 칸은 새 값 그대로
export function countFrames(from, to, t) {
  return to.map((v, i) => (Number.isFinite(from[i]) ? Math.round(tween(from[i], v, t)) : v));
}

// 화면(범위)마다 항목을 처음 본 시각을 기억해, 처음 그릴 때는 전부·다시 그릴 때는 새로 생긴 것만 "등장"시킨다.
// Firestore 는 동행이 고칠 때마다(그리고 처음 열 때도 Day·장소·예약이 따로) 목록을 다시 보내 요소가 새로 만들어지므로,
// 처음 본 지 windowMs 안에 다시 그려진 항목은 지난 시간(elapsed)만큼 이어서 움직이게 한다.
// plan() → Map(key → { order: 그 묶음에서 몇 번째로 새로 생겼나, elapsed: 처음 본 뒤 지난 ms })
export function createSeen(windowMs = 700) {
  const scopes = new Map();
  const scopeOf = (scope) => { if (!scopes.has(scope)) scopes.set(scope, new Map()); return scopes.get(scope); };
  return {
    plan(scope, keys, now) {
      const known = scopeOf(scope);
      let order = 0;
      for (const k of keys) if (!known.has(k)) known.set(k, { at: now, order: order++ });
      const out = new Map();
      for (const k of keys) {
        const { at, order: o } = known.get(k);
        if (now - at <= windowMs) out.set(k, { order: o, elapsed: now - at });
      }
      return out;
    },
    // 등장시키지 않고 본 것으로만 (Day 를 옮길 때처럼 다른 움직임을 쓸 때)
    silent(scope, keys) {
      const known = scopeOf(scope);
      for (const k of keys) known.set(k, { at: -Infinity, order: 0 });
    },
    forget(scope) { scopes.delete(scope); },
  };
}

// 방금(ms 안에) 내가 누른 항목인가. 다시 그려진 새 요소에도 체크 애니메이션을 한 번만 주려고.
export function touchedRecently(touched, id, now, ms = 900) {
  const at = touched.get(id);
  return at != null && now - at <= ms;
}

// 차례로 등장할 때의 순번. 긴 목록의 끝이 한참 늦게 나타나지 않게 10번째에서 멈춘다
export function staggerIndex(i, max = 10) {
  return Math.min(i, max);
}

// Day 를 옮긴 방향: 뒤 날로 가면 1(오른쪽에서 들어옴), 앞 날로 가면 -1, 모르거나 같으면 0
export function slideDir(fromIndex, toIndex) {
  if (fromIndex < 0 || toIndex < 0) return 0;
  return Math.sign(toIndex - fromIndex);
}
