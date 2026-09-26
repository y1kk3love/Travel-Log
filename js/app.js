import { watchAuth, signIn, signOut, isSiteOwner } from './auth.js';
import { el, clear, toast, confirmDialog, closeTopOverlay } from './ui.js';
import { startRouter } from './router.js';
import { canUseApp, ensureProfile, onLateWriteError } from './db.js';
import { isNative, takeSharedText, onResume, onNotificationTap, onBackButton, exitApp } from './native.js';
import { isHomeHash } from './lib/nav.js';
import { shareFromQuery } from './lib/share.js';
import { refreshAlarms } from './alarms.js';
import { checkForUpdate, checkMinVersion } from './update-check.js';
import * as shareView from './views/share.js';
import { setPendingShare } from './views/share.js';
import { navigate } from './router.js';
import * as tripsView from './views/trips.js';
import * as tripView from './views/trip.js';
import * as adminView from './views/admin.js';

const app = document.getElementById('app');

// 오프라인에서 한 변경은 연결된 뒤 서버에 올라간다. 그때 거절되면(권한·크기 등) 기기 화면에서도 되돌려지므로 알려 준다.
onLateWriteError((err) => {
  console.error('[db] 나중에 실패한 저장', err);
  toast(`저장하지 못한 변경이 있어요 (${err?.code ?? '오류'}). 내용을 다시 확인해 주세요`, { kind: 'error', ms: 7000 });
});
let stopApp = () => {}; // renderApp 이 시작한 것(라우터·네이티브 리스너)을 전부 끄는 함수. 로그인 상태가 바뀔 때 부른다

function renderLogin() {
  clear(app);
  app.append(el('div', { class: 'screen-center' },
    el('h1', { text: '여행 로그' }),
    el('p', { class: 'muted', text: '본인 Google 계정으로 로그인하면 일정을 볼 수 있어요' }),
    el('button', {
      class: 'btn btn-primary',
      onClick: () => signIn().catch((err) => {
        console.error(err);
        if (err.code === 'auth/native-cancelled') { toast(`로그인이 취소됐어요 · ${err.message}`, { ms: 6000 }); return; }
        // 앱에서는 원인을 알 수 있게 코드와 메시지를 그대로 보여 준다 (웹 팝업 차단도 메시지 그대로)
        const detail = isNative() || err.code === 'auth/popup-blocked';
        toast(detail ? `로그인 실패 (${err.code ?? '?'}) ${err.message ?? ''}` : '로그인에 실패했어요', { kind: 'error', ms: detail ? 10000 : 5000 });
      }),
    }, 'Google로 로그인')));
}

function renderNoAccess(user) {
  clear(app);
  app.append(el('div', { class: 'screen-center' },
    el('h1', { text: '초대받은 계정이 아니에요' }),
    el('p', { class: 'muted', text: `${user.email} 계정은 아직 어느 여행에도 초대되지 않았어요. 여행 주인에게 이 이메일로 초대해 달라고 해 주세요.` }),
    el('button', { class: 'btn', onClick: () => signOut() }, '로그아웃')));
}

function renderChecking() {
  clear(app);
  app.append(el('div', { class: 'screen-center' }, el('p', { class: 'muted', text: '권한 확인 중…' })));
}

function renderApp() {
  clear(app);
  const disposers = [startRouter({ trips: tripsView, trip: tripView, share: shareView, admin: adminView }, app)];
  // 공유 시트로 열렸으면 여행 선택 화면으로. 앱은 네이티브 인텐트, 홈 화면 웹앱(PWA)은 주소의 ?title=&text=&url= (manifest share_target)
  const goShare = async () => {
    let text = await takeSharedText();
    if (!text) {
      text = shareFromQuery(location.search);
      if (text) history.replaceState(null, '', location.pathname + location.hash); // 새로고침해도 다시 공유되지 않게
    }
    if (text) { setPendingShare(text); navigate('/share'); }
  };
  goShare();
  // 다음 목적지 알림: 앱 시작·복귀 때 다시 예약, 알림을 누르면 그 여행으로 (앱 전용)
  refreshAlarms();
  checkMinVersion();
  checkForUpdate();
  // 로그아웃→로그인을 반복해도 리스너가 쌓이지 않게, 라우터와 함께 정리한다
  disposers.push(
    onNotificationTap(({ tripId, placeId }) => { if (tripId) navigate(placeId ? `/trip/${tripId}/planner/${placeId}` : `/trip/${tripId}`); }),
    onResume(() => { goShare(); refreshAlarms(); checkMinVersion(); checkForUpdate(); }));
  stopApp = () => { disposers.forEach((d) => d?.()); stopApp = () => {}; };
}

// 안드로이드 뒤로가기: 열린 창(대화상자·장소 시트·사진)이 있으면 그것부터 닫고,
// 없으면 홈이 아닐 때 이전 화면으로, 홈이면 종료할지 묻는다 (앱 전용, 한 번만 등록)
let exitAsking = false;
onBackButton(async () => {
  if (closeTopOverlay()) return; // 편집 중이던 창을 닫을 뿐 화면은 그대로
  if (!isHomeHash(location.hash)) { history.back(); return; }
  if (exitAsking) return;
  exitAsking = true;
  try {
    if (await confirmDialog('여행 로그를 종료할까요?', { okText: '예', cancelText: '아니오' })) await exitApp();
  } finally { exitAsking = false; }
});

// 홈 화면 앱(PWA): 서비스 워커는 파일 캐시만 담당한다. 안드로이드 앱은 파일이 APK 안에 있어 등록하지 않는다.
if ('serviceWorker' in navigator && !isNative()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch((err) => console.warn('service worker 등록 실패', err));
  });
}

let authSeq = 0;
watchAuth(async (user) => {
  const seq = ++authSeq;
  stopApp();
  if (!user) return renderLogin();
  renderChecking();
  const allowed = await canUseApp(isSiteOwner(user));
  if (seq !== authSeq) return; // 확인하는 사이 로그인 상태가 바뀜
  if (!allowed) return renderNoAccess(user);
  await ensureProfile(user); // 첫 로그인이면 Google 이름을 기본 닉네임으로
  if (seq !== authSeq) return;
  renderApp(user);
});
