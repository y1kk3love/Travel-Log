// 네이티브(안드로이드 앱) 기능 접근을 이 파일에만 둔다. 웹에서는 전부 no-op.
// Capacitor 는 앱 웹뷰에 window.Capacitor 를 주입한다. 번들러가 없으므로 registerPlugin 으로 플러그인 프록시를 얻는다.
import { sharedTextFrom } from './lib/share.js';
import { isShortMapsLink, isGoogleMapsUrl } from './lib/short-link.js';

const cap = () => (typeof window !== 'undefined' ? window.Capacitor : undefined);

export function isNative() {
  return !!cap()?.isNativePlatform?.();
}

// 안드로이드 런타임이 웹뷰에 주입하는 스크립트에는 registerPlugin 이 없다 (그건 번들러로 넣는 @capacitor/core 몫).
// 대신 네이티브 플러그인마다 Capacitor.Plugins.<이름> 프록시(메서드 → nativePromise, addListener → {remove})를 넣어 준다.
// registerPlugin 이 있으면 그걸, 없으면 그 프록시를 쓴다. 둘 다 없으면 null (웹).
const cache = new Map();
export function plugin(name) {
  const c = cap();
  if (!c) return null;
  if (!cache.has(name)) {
    const p = typeof c.registerPlugin === 'function' ? c.registerPlugin(name) : (c.Plugins?.[name] ?? null);
    cache.set(name, p ?? null);
  }
  return cache.get(name);
}

export async function appVersion() {
  const app = plugin('App');
  if (!app) return null;
  try { return (await app.getInfo()).version ?? null; } catch { return null; }
}

// 앱 안 웹뷰에서는 구글 OAuth 팝업이 막혀서(disallowed_useragent) 네이티브 로그인으로 ID 토큰만 받는다.
// 실패는 삼키지 않고 code 를 붙여 던진다: 취소 auth/native-cancelled, 토큰 없음 auth/native-no-token, 그 외 auth/native-failed (원문 메시지 유지)
export async function googleIdToken() {
  const fa = plugin('FirebaseAuthentication');
  if (!fa) return null;
  let result;
  try {
    // Credential Manager 방식은 콘솔 설정이 맞아도 [28444] Developer console is not set up correctly 로 실패하는 사례가 있어
    // (미해결 이슈 다수) 기존 Google Sign-In 인텐트 방식을 쓴다. 같은 OAuth 클라이언트·SHA-1 을 검사하므로 설정 문제면 code 10 으로 드러난다.
    result = await fa.signInWithGoogle({ useCredentialManager: false });
  } catch (err) {
    const message = String(err?.message ?? err);
    const e = new Error(message);
    e.code = /cancel/i.test(message) ? 'auth/native-cancelled' : 'auth/native-failed';
    e.nativeCode = err?.code;
    throw e;
  }
  const token = result?.credential?.idToken;
  if (!token) {
    const e = new Error(`구글 로그인은 됐는데 ID 토큰이 없어요 (${JSON.stringify(Object.keys(result ?? {}))})`);
    e.code = 'auth/native-no-token';
    throw e;
  }
  return token;
}

export async function nativeSignOut() {
  const fa = plugin('FirebaseAuthentication');
  if (!fa) return;
  try { await fa.signOut(); } catch (err) { console.warn('native signOut', err); }
}

// 공유 시트로 들어온 텍스트를 꺼낸다 (없으면 null). 앱 자체 플러그인(android/.../SharePlugin.java)이 한 번 주고 비운다.
// 앱이 켜진 채로 공유가 오면 MainActivity 가 resume 되므로 onResume 에서 다시 부르면 된다.
export async function takeSharedText() {
  const si = plugin('ShareIntent');
  if (!si) return null;
  try {
    return sharedTextFrom(await si.take());
  } catch (err) { console.warn('share take', err); return null; }
}

// 구글 지도 앱이 공유하는 짧은 링크(maps.app.goo.gl)를 앱이 따라가 긴 구글 지도 주소를 받는다 (없으면 null).
// 웹은 브라우저 보안(CORS) 때문에 따라갈 수 없어 null — 부른 쪽이 이름 검색으로 넘어간다. 예전 앱에는 이 메서드가 없다.
export async function resolveMapsLink(url) {
  const short = String(url ?? '').trim();
  if (!isShortMapsLink(short)) return null;
  const si = plugin('ShareIntent');
  if (!si) return null;
  try {
    const long = (await si.resolveLink({ url: short }))?.url;
    return isGoogleMapsUrl(long) ? long : null;
  } catch (err) { console.warn('resolveLink', err); return null; }
}

// 안드로이드 뒤로가기. 리스너를 달면 웹뷰 기본 동작이 꺼지므로 cb 가 직접 처리한다 ({ canGoBack })
export function onBackButton(cb) {
  const app = plugin('App');
  if (!app?.addListener) return () => {};
  const handle = app.addListener('backButton', cb);
  return () => { Promise.resolve(handle).then((h) => h?.remove?.()); };
}

export async function exitApp() {
  const app = plugin('App');
  if (!app?.exitApp) return;
  try { await app.exitApp(); } catch (err) { console.warn('exitApp', err); }
}

// ---- 로컬 알림 ----
// 권한 요청 창은 앱이 알아서는 설치 뒤 한 번만 띄운다. 거절하면 앱으로 돌아올 때마다(알림을 다시 잡을 때마다) 또 묻던 것을 막는다.
// 나중에 켜려면 내 계정 메뉴의 "알림 켜기"(ask: true, 폰이 더 묻지 않으면 설정 안내)로.
const NOTIF_ASKED = 'tl.notif.asked';
const askedBefore = () => { try { return globalThis.localStorage?.getItem(NOTIF_ASKED) === '1'; } catch { return false; } };
const markAsked = () => { try { globalThis.localStorage?.setItem(NOTIF_ASKED, '1'); } catch { /* 저장 못 해도 됨 */ } };
export async function notificationPermission({ ask = false } = {}) {
  const ln = plugin('LocalNotifications');
  if (!ln) return 'unavailable';
  try {
    let { display } = await ln.checkPermissions();
    if ((display === 'prompt' || display === 'prompt-with-rationale') && (ask || !askedBefore())) {
      ({ display } = await ln.requestPermissions());
      markAsked(); // 요청이 실패(throw)하면 물어본 것으로 치지 않는다
    }
    return display === 'granted' ? 'granted' : 'denied';
  } catch { return 'unavailable'; }
}

export async function cancelAllNotifications() {
  const ln = plugin('LocalNotifications');
  if (!ln) return;
  try {
    const { notifications } = await ln.getPending();
    if (notifications?.length) await ln.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
  } catch (err) { console.warn('cancel notifications', err); }
}

// 정확 알람을 쓸 수 있나 (USE_EXACT_ALARM 선언으로 안드로이드 13+ 는 자동 허용). 확인할 수 없으면 false.
async function canExactAlarm(ln) {
  try { return (await ln.checkExactNotificationSetting?.())?.exact_alarm === 'granted'; } catch { return false; }
}

// list: planAlarms() 결과
export async function scheduleNotifications(list) {
  const ln = plugin('LocalNotifications');
  if (!ln || !list.length) return;
  const exact = await canExactAlarm(ln);
  await ln.schedule({
    notifications: list.map((a) => ({
      id: a.id, title: a.title, body: a.body,
      // 정확 알람은 허용돼 있을 때만 요구한다. 허용 안 된 채로 요구하면 플러그인이 매번 설정 화면으로 튕긴다.
      // 정확하지 않은 알람은 절전 중에 한참 늦게 울릴 수 있어 "10분 뒤 출발" 알림으로는 쓸모가 없다.
      isExactNotification: exact,
      schedule: { at: new Date(a.at), allowWhileIdle: true },
      extra: { tripId: a.tripId, placeId: a.placeId },
    })),
  });
}

export function onNotificationTap(cb) {
  const ln = plugin('LocalNotifications');
  if (!ln?.addListener) return () => {};
  const handle = ln.addListener('localNotificationActionPerformed', (e) => cb(e?.notification?.extra ?? {}));
  return () => { Promise.resolve(handle).then((h) => h?.remove?.()); };
}

// 앱이 앞으로 돌아올 때 (공유 인텐트·알림 탭 처리용)
export function onResume(cb) {
  const app = plugin('App');
  if (!app?.addListener) return () => {};
  const handle = app.addListener('resume', cb);
  return () => { Promise.resolve(handle).then((h) => h?.remove?.()); };
}
