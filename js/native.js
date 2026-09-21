// 네이티브(안드로이드 앱) 기능 접근을 이 파일에만 둔다. 웹에서는 전부 no-op.
// Capacitor 는 앱 웹뷰에 window.Capacitor 를 주입한다. 번들러가 없으므로 registerPlugin 으로 플러그인 프록시를 얻는다.
import { sharedTextFrom } from './lib/share.js';

const cap = () => (typeof window !== 'undefined' ? window.Capacitor : undefined);

export function isNative() {
  return !!cap()?.isNativePlatform?.();
}

const cache = new Map();
export function plugin(name) {
  const c = cap();
  if (!c?.registerPlugin) return null;
  if (!cache.has(name)) cache.set(name, c.registerPlugin(name));
  return cache.get(name);
}

export async function appVersion() {
  const app = plugin('App');
  if (!app) return null;
  try { return (await app.getInfo()).version ?? null; } catch { return null; }
}

// 앱 안 웹뷰에서는 구글 OAuth 팝업이 막혀서(disallowed_useragent) 네이티브 로그인으로 ID 토큰만 받는다.
export async function googleIdToken() {
  const fa = plugin('FirebaseAuthentication');
  if (!fa) return null;
  try {
    const result = await fa.signInWithGoogle();
    return result?.credential?.idToken ?? null;
  } catch (err) {
    if (/cancel/i.test(String(err?.message ?? err))) return null;
    throw err;
  }
}

export async function nativeSignOut() {
  const fa = plugin('FirebaseAuthentication');
  if (!fa) return;
  try { await fa.signOut(); } catch (err) { console.warn('native signOut', err); }
}

// 공유 시트로 들어온 텍스트를 꺼낸다 (없으면 null). 꺼낸 뒤 인텐트 액티비티를 닫는다.
export async function takeSharedText() {
  const si = plugin('SendIntent');
  if (!si) return null;
  try {
    const result = await si.checkSendIntentReceived();
    const text = sharedTextFrom(result);
    if (text) Promise.resolve(si.finish?.()).catch(() => {});
    return text;
  } catch { return null; }
}

// 앱이 이미 켜진 채로 공유가 들어올 때
export function onShareReceived(cb) {
  if (!isNative() || typeof window === 'undefined') return () => {};
  const handler = () => cb();
  window.addEventListener('sendIntentReceived', handler);
  return () => window.removeEventListener('sendIntentReceived', handler);
}

// ---- 로컬 알림 ----
export async function notificationPermission() {
  const ln = plugin('LocalNotifications');
  if (!ln) return 'unavailable';
  try {
    let { display } = await ln.checkPermissions();
    if (display === 'prompt' || display === 'prompt-with-rationale') ({ display } = await ln.requestPermissions());
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

// list: planAlarms() 결과
export async function scheduleNotifications(list) {
  const ln = plugin('LocalNotifications');
  if (!ln || !list.length) return;
  await ln.schedule({
    notifications: list.map((a) => ({
      id: a.id, title: a.title, body: a.body,
      // 정확 알람(isExactNotification)은 안드로이드 12+ 에서 별도 권한이 필요해 설정 화면으로 튕긴다. 출발 알림은 몇 분 오차가 괜찮으니 요구하지 않는다.
      isExactNotification: false,
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
