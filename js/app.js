import { watchAuth, signIn, signOut, isOwner } from './auth.js';
import { el, clear, toast } from './ui.js';
import { startRouter } from './router.js';
import { canUseApp, ensureProfile } from './db.js';
import { isNative, takeSharedText, onShareReceived, onResume, onNotificationTap } from './native.js';
import { refreshAlarms } from './alarms.js';
import { checkForUpdate } from './update-check.js';
import * as shareView from './views/share.js';
import { setPendingShare } from './views/share.js';
import { navigate } from './router.js';
import * as tripsView from './views/trips.js';
import * as tripView from './views/trip.js';

const app = document.getElementById('app');
let stopRouter = null;

function renderLogin() {
  clear(app);
  app.append(el('div', { class: 'screen-center' },
    el('h1', { text: '여행 로그' }),
    el('p', { class: 'muted', text: '본인 Google 계정으로 로그인하면 일정을 볼 수 있어요' }),
    el('button', {
      class: 'btn btn-primary',
      onClick: () => signIn().catch((err) => {
        console.error(err);
        toast(err.code === 'auth/popup-blocked' ? err.message : '로그인에 실패했어요', { kind: 'error', ms: 5000 });
      }),
    }, 'Google로 로그인')));
}

function renderNoAccess(user) {
  clear(app);
  app.append(el('div', { class: 'screen-center' },
    el('h1', { text: '초대받은 계정이 아니에요' }),
    el('p', { class: 'muted', text: `${user.email} 계정은 아직 어느 여행에도 초대되지 않았어요. 여행 주인에게 이 이메일로 초대해 달라고 해 주세요.` }),
    el('p', { class: 'muted' }, '사이트 주인이라면 UID ', el('code', { text: user.uid }), ' 를 js/firebase-config.js의 OWNER_UID와 firestore.rules에 넣으세요.'),
    el('button', { class: 'btn', onClick: () => signOut() }, '로그아웃')));
}

function renderChecking() {
  clear(app);
  app.append(el('div', { class: 'screen-center' }, el('p', { class: 'muted', text: '권한 확인 중…' })));
}

function renderApp() {
  clear(app);
  stopRouter = startRouter({ trips: tripsView, trip: tripView, share: shareView }, app);
  // 공유 시트로 열렸으면 여행 선택 화면으로 (앱 전용, 웹에서는 아무것도 안 함)
  const goShare = async () => {
    const text = await takeSharedText();
    if (text) { setPendingShare(text); navigate('/share'); }
  };
  goShare();
  onShareReceived(goShare);
  // 다음 목적지 알림: 앱 시작·복귀 때 다시 예약, 알림을 누르면 그 여행으로 (앱 전용)
  refreshAlarms();
  checkForUpdate();
  onNotificationTap(({ tripId, placeId }) => { if (tripId) navigate(placeId ? `/trip/${tripId}/planner/${placeId}` : `/trip/${tripId}`); });
  onResume(() => { goShare(); refreshAlarms(); });
}

// 홈 화면 앱(PWA): 서비스 워커는 파일 캐시만 담당한다. 안드로이드 앱은 파일이 APK 안에 있어 등록하지 않는다.
if ('serviceWorker' in navigator && !isNative()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch((err) => console.warn('service worker 등록 실패', err));
  });
}

let authSeq = 0;
watchAuth(async (user) => {
  const seq = ++authSeq;
  if (stopRouter) { stopRouter(); stopRouter = null; }
  if (!user) return renderLogin();
  renderChecking();
  const allowed = await canUseApp(isOwner(user));
  if (seq !== authSeq) return; // 확인하는 사이 로그인 상태가 바뀜
  if (!allowed) return renderNoAccess(user);
  await ensureProfile(user); // 첫 로그인이면 Google 이름을 기본 닉네임으로
  if (seq !== authSeq) return;
  renderApp(user);
});
