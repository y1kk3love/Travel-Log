// 공유 요소 전환 (View Transitions): 누른 여행 카드의 제목 ↔ 여행 화면의 큰 제목이 이어져 움직인다.
// 같은 이름이 한 화면에 둘이면 전환이 통째로 건너뛰어지므로, 한 번에 한 쌍(나가는 쪽·들어오는 쪽)에만 이름을 주고
// 전환이 끝나면 지운다. 들어오는 쪽은 Firestore 캐시가 비동기로 와서 늦게 그려지므로, 전환 콜백에서 잠깐(최대 250ms) 기다린다.
import { reduceMotion } from './motion.js';

const NAME = 'trip-title';
let pending = null; // { tripId, to: 'trip' | 'trips' }
let named = [];
let arrive = null;
let gen = 0; // 이름을 새로 줄 때마다 늘어난다: 전환은 자기가 준 이름만 지운다
const onHome = new Set(); // 홈에 카드가 그려진 여행 (관리자가 연 남의 여행은 홈에 없어 짝이 오지 않는다)

const can = () => typeof document !== 'undefined' && typeof document.startViewTransition === 'function' && !reduceMotion();
const give = (el) => { el.style.viewTransitionName = NAME; named.push(el); };
const begin = (el, next) => { clearMorph(); gen += 1; give(el); pending = next; };

// 홈에서 카드를 누를 때(주소가 바뀌기 직전): 카드 제목에 이름
export function morphFromCard(el, tripId) {
  if (!can() || !el) return;
  begin(el, { tripId, to: 'trip' });
}

// 라우터: 여행 화면에서 홈으로 돌아갈 때(뒤로가기 포함), 큰 제목에 이름
export function morphLeave(prev, next) {
  if (!can() || prev?.name !== 'trip' || next?.name !== 'trips' || !onHome.has(prev.tripId)) return;
  const h1 = document.querySelector('.trip-header h1');
  if (!h1) return;
  begin(h1, { tripId: prev.tripId, to: 'trips' });
}

// 들어오는 화면이 짝이 되는 제목을 그렸을 때 (where: 'trip' 여행 화면 | 'trips' 홈)
export function morphArrive(el, tripId, where) {
  if (where === 'trips') onHome.add(tripId);
  if (!pending || !el || pending.tripId !== tripId || pending.to !== where || named.includes(el)) return;
  give(el);
  arrive?.();
}

// 라우터: 전환 콜백 안에서 짝이 그려지길 잠깐 기다린다. 예상한 화면이 아니면 이름을 지우고 바로 진행
export function morphArrival(route, ms = 250) {
  if (!pending) return Promise.resolve();
  const expected = pending.to === 'trip' ? route.name === 'trip' && route.tripId === pending.tripId : route.name === 'trips';
  if (!expected) { clearMorph(); return Promise.resolve(); }
  if (named.length >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    arrive = () => { clearTimeout(timer); resolve(); };
  });
}

// 지금 이름을 준 전환의 번호. 라우터가 전환을 시작할 때 받아 두었다가 끝나면 clearMorph(번호)
export const morphToken = () => gen;

// token 을 주면 그 뒤로 다른 전환이 이름을 새로 줬을 때는 건드리지 않는다 (전환 중에 또 이동해 앞 전환이 건너뛰어진 경우)
export function clearMorph(token = null) {
  if (token != null && token !== gen) return;
  named.forEach((el) => { el.style.viewTransitionName = ''; });
  named = [];
  pending = null;
  arrive = null;
}
