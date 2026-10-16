// 끌기·밀기·알림 쌓기의 순수 계산 (테스트 대상). 값은 iOS·Vaul(시트)·Sonner(알림)를 따른다.

// 경계 밖으로 끌면 고무줄처럼: 처음엔 따라오다 점점 무거워지고 limit 를 넘지 않는다 (iOS 식 (1 − 1/(x·c/d + 1))·d)
export function rubberBand(offset, limit = 80, c = 0.55) {
  if (!offset) return 0;
  const x = Math.abs(offset);
  return Math.sign(offset) * (1 - 1 / ((x * c) / limit + 1)) * limit;
}

// 최근 windowMs 안의 움직임으로 속도(px/ms). samples: [{ t, y }] 시간순 (y 대신 다른 축 값이어도 된다)
// at: 손을 뗀 시각. 마지막 움직임 뒤로 windowMs 넘게 멈춰 있다 놓았으면 튕긴 게 아니라 0
export function velocity(samples, windowMs = 100, at = null) {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  if (at != null && at - last.t > windowMs) return 0;
  const first = samples.find((s) => last.t - s.t <= windowMs) ?? samples[0];
  const dt = last.t - first.t;
  return dt > 0 ? (last.y - first.y) / dt : 0;
}

// 시트를 놓았을 때 닫을까: 높이의 ratio 넘게 끌었거나 아래로 빠르게 튕겼을 때 (Vaul: 25%, 0.4px/ms). 탭 수준 흔들림은 무시
export function shouldDismiss({ distance, velocity: v, size, ratio = 0.25, minVelocity = 0.4 }) {
  if (distance <= 0) return false;
  return distance >= size * ratio || (v >= minVelocity && distance > 8);
}

// 알림을 밀어 닫을까: 좌우·아래로 45px 넘게 또는 빠르게(0.11px/ms) 밀었을 때 (Sonner). 반환: 'left' | 'right' | 'down' | null
export function swipeOut({ dx, dy, vx = 0, vy = 0 }) {
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (Math.abs(dx) <= 4) return null;
    return Math.abs(dx) >= 45 || Math.abs(vx) >= 0.11 ? (dx < 0 ? 'left' : 'right') : null;
  }
  return dy > 0 && (dy >= 45 || vy >= 0.11) ? 'down' : null;
}

// 허용하지 않는 방향으로 밀면 저항 (아무리 끌어도 20px 남짓)
export function resist(d) {
  return d / (1.5 + Math.abs(d) / 20);
}

// 알림 쌓기: 최신(0번)이 맨 앞, 뒤로 두 개가 peek 만큼 비치며 작아지고 max 번째부터 숨는다.
// 펼치면(마우스를 올리면) 각 높이대로 gap 을 두고 위로 늘어선다. heights 는 최신부터. y 는 아래 기준으로 위(음수)로
export function stackLayout(heights, { expanded = false, gap = 8, peek = 12, max = 3 } = {}) {
  let offset = 0;
  return heights.map((h, i) => {
    const opacity = i < max ? 1 : 0;
    if (expanded) {
      const y = 0 - offset;
      offset += h + gap;
      return { y, scale: 1, opacity };
    }
    return { y: 0 - i * peek, scale: Math.round((1 - i * 0.05) * 100) / 100, opacity };
  });
}

// 멈췄다 이어 가는 타이머 (알림: 마우스를 올리거나 앱이 백그라운드면 멈춘다). now 는 호출하는 쪽이 넘긴다
export function createCountdown(ms, onDone, { setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let remaining = ms, startedAt = 0, id = null, running = false, finished = false;
  const fire = () => { running = false; finished = true; onDone(); };
  return {
    start(now) { if (finished) return; startedAt = now; running = true; id = setTimer(fire, remaining); },
    pause(now) {
      if (!running) return;
      clearTimer(id);
      remaining = Math.max(0, remaining - (now - startedAt));
      running = false;
    },
    resume(now) { if (!running && !finished) this.start(now); },
    stop() { if (running) clearTimer(id); running = false; finished = true; },
  };
}

// 아래 시트가 열려 있으면 알림을 시트의 버튼 줄(footTop: 화면 위에서 잰 y) 위로 띄울 아래 여백(px). 그대로 둬도 되면 null
export function liftAbove(footTop, viewportHeight, { base = 28, gap = 12 } = {}) {
  if (footTop == null || footTop >= viewportHeight) return null;
  const bottom = Math.round(viewportHeight - footTop + gap);
  return bottom > base + gap ? bottom : null;
}
