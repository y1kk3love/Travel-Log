const TABS = ['planner', 'checklist', 'reservations', 'expenses'];

export function parseHash(hash) {
  const parts = String(hash || '').replace(/^#/, '').split('/').filter(Boolean);
  if (parts[0] === 'share') return { name: 'share' };
  if (parts[0] === 'trip' && parts[1]) {
    const tab = TABS.includes(parts[2]) ? parts[2] : 'planner';
    const route = { name: 'trip', tripId: parts[1], tab };
    if (tab === 'planner' && parts[2] === 'planner' && parts[3]) route.placeId = parts[3];
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
    const dir = navDirection(current, route);
    const first = current === null;
    current = route;
    // 지원하는 브라우저(크롬·안드로이드 웹뷰)에서만 화면 전환 애니메이션. 첫 화면과 미지원 브라우저는 즉시 교체
    if (!first && typeof document.startViewTransition === 'function') {
      document.documentElement.dataset.nav = dir;
      document.startViewTransition(() => swap(route));
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
