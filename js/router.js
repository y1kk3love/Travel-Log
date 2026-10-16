import { morphLeave, morphArrival, clearMorph, morphToken } from './morph.js';

const TABS = ['planner', 'checklist', 'reservations', 'expenses'];

export function parseHash(hash) {
  const parts = String(hash || '').replace(/^#/, '').split('/').filter(Boolean);
  if (parts[0] === 'share') return { name: 'share' };
  if (parts[0] === 'admin') return { name: 'admin' }; // 관리자(사이트 주인) 전용: 모든 여행
  if (parts[0] === 'trip' && parts[1]) {
    const tab = TABS.includes(parts[2]) ? parts[2] : 'planner';
    const route = { name: 'trip', tripId: parts[1], tab };
    if (tab === 'planner' && parts[2] === 'planner' && parts[3]) route.placeId = parts[3];
    if (tab === 'reservations' && parts[3]) route.reservationId = parts[3]; // 일정의 "예약" 배지 → 그 예약 카드로
    return route;
  }
  return { name: 'trips' };
}

export function navigate(path) {
  window.location.hash = path.startsWith('#') ? path : `#${path}`;
}

// 화면 깊이: 홈 0, 여행·공유 1. 깊어지면 forward(오른쪽에서 밀려 들어옴), 얕아지면 back, 같은 깊이(탭 이동)는 same(살짝 페이드)
const depth = (route) => (route?.name === 'trips' ? 0 : 1);
export function navDirection(prev, next) {
  if (!prev || !next) return 'same';
  const a = depth(prev), b = depth(next);
  return a === b ? 'same' : (b > a ? 'forward' : 'back');
}

export function startRouter(views, container) {
  let cleanup = null;
  let current = null;
  const swap = (route) => {
    if (cleanup) cleanup();
    cleanup = null;
    while (container.firstChild) container.removeChild(container.firstChild);
    window.scrollTo(0, 0);
    cleanup = views[route.name].render(container, route) || null;
  };
  const run = () => {
    const route = parseHash(window.location.hash);
    const prev = current;
    const dir = navDirection(prev, route);
    current = route;
    // 지원하는 브라우저(크롬·안드로이드 웹뷰)에서만 화면 전환 애니메이션. 첫 화면과 미지원 브라우저는 즉시 교체
    if (prev && typeof document.startViewTransition === 'function') {
      document.documentElement.dataset.nav = dir;
      morphLeave(prev, route); // 여행 → 홈: 큰 제목이 카드 제목으로 이어져 돌아간다
      const token = morphToken(); // 이 전환이 준 이름만 끝에 지운다 (도중에 또 이동하면 다음 전환의 이름은 남긴다)
      // 누른 카드의 제목과 여행 화면의 큰 제목이 한 쌍으로 이어지게, 짝이 그려질 때까지 잠깐 기다린다 (js/morph.js)
      const t = document.startViewTransition(async () => { swap(route); await morphArrival(route); });
      // 화면이 안 보이면 전환은 건너뛰고(ready 가 거절된다) 내용만 바뀐다 — 그건 오류가 아니다
      t.ready?.catch(() => {});
      const done = () => clearMorph(token);
      (t.finished ?? Promise.resolve()).then(done, done);
    } else {
      swap(route);
    }
  };
  window.addEventListener('hashchange', run);
  run();
  return () => {
    window.removeEventListener('hashchange', run);
    if (cleanup) cleanup();
  };
}
