// 앱이 시작하지 못했을 때 한 번 스스로 다시 연다. index.html 이 앱 모듈(js/app.js)보다 먼저 부른다 (모듈이 아닌 보통 스크립트).
// 배포 직후 1분쯤은 새 파일과 옛 파일이 섞여 받아질 수 있다 (새 app.js 가 옛 db.js 에 없는 이름을 찾는 식).
// 그러면 모듈 묶음이 통째로 실패해 "불러오는 중…"에서 멈추는데, 다시 열면 풀린다 → 그 새로고침을 대신 해 준다.
// 한 번 다시 열어도 안 되면(1분 안에 또 실패) 계속 돌지 않고, 안내와 "다시 열기" 버튼을 보여 준다.
(function bootGuard() {
  const KEY = 'tl.bootRetryAt';
  const WINDOW_MS = 60000;
  let handled = false;

  function lastRetryAt() {
    try { return Number(sessionStorage.getItem(KEY)) || 0; } catch (e) { return 0; }
  }
  function showStuck() {
    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = '<div class="screen-center"><h1>여행 로그</h1>'
      + '<p class="muted">새 버전을 받는 중이라 화면을 열지 못했어요. 잠시 뒤 다시 열어 주세요.</p>'
      + '<button class="btn btn-primary" type="button">다시 열기</button></div>';
    app.querySelector('button').addEventListener('click', function () { location.reload(); });
  }
  function onBootError() {
    if (handled || window.__tlBooted) return; // 앱이 시작한 뒤의 오류는 앱이 알아서 다룬다
    handled = true;
    const now = Date.now();
    if (now - lastRetryAt() < WINDOW_MS) { showStuck(); return; }
    try { sessionStorage.setItem(KEY, String(now)); } catch (e) { showStuck(); return; } // 기억하지 못하면 끝없이 돌 수 있으니 자동으로는 다시 열지 않는다
    setTimeout(function () { location.reload(); }, 1200);
  }

  // 모듈 묶음이 이어지지 못하면(없는 이름·문법 오류) window 에 오류가 오고, 파일을 못 받으면(404·끊김) 그 script 요소에 온다.
  // 두 번째는 위로 올라오지 않으므로 잡는 단계(capture)에서 듣는다. 사진 같은 다른 자원의 실패는 건너뛴다
  window.addEventListener('error', function (e) {
    const t = e && e.target;
    if (t && t !== window && t.tagName !== 'SCRIPT') return;
    onBootError();
  }, true);
  window.addEventListener('unhandledrejection', onBootError);
}());
