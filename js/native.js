// 네이티브(안드로이드 앱) 기능 접근을 이 파일에만 둔다. 웹에서는 전부 no-op.
// Capacitor 는 앱 웹뷰에 window.Capacitor 를 주입한다. 번들러가 없으므로 registerPlugin 으로 플러그인 프록시를 얻는다.
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

// 앱이 앞으로 돌아올 때 (공유 인텐트·알림 탭 처리용)
export function onResume(cb) {
  const app = plugin('App');
  if (!app?.addListener) return () => {};
  const handle = app.addListener('resume', cb);
  return () => { Promise.resolve(handle).then((h) => h?.remove?.()); };
}
