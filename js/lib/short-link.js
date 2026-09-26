// 구글 지도 앱이 공유하는 짧은 링크(maps.app.goo.gl)를 긴 구글 지도 주소로 바꾼다 (순수 로직, 테스트 대상).
// 짧은 링크엔 위치가 없고, 따라가야 나오는 긴 주소에 이름·핀 좌표·장소 키가 있다.
// 브라우저는 CORS 때문에 리디렉트 주소를 볼 수 없어서, 앱은 네이티브로, 웹은 중계(Apps Script, relay/)로 따라간다.

const SHORT_MAPS_LINK = /^https:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/maps)\/[^\s]+$/i;
const GOOGLE_MAPS_URL = /^https:\/\/(?:www\.|maps\.)?google\.[a-z.]+\/maps[/?]/i;

export const isShortMapsLink = (url) => SHORT_MAPS_LINK.test(String(url ?? '').trim());
export const isGoogleMapsUrl = (url) => typeof url === 'string' && GOOGLE_MAPS_URL.test(url);

// resolvers: 짧은 링크 → 긴 주소(또는 null)를 돌려주는 함수들. 앞에서부터 해 보고, 구글 지도 주소가 나오면 멈춘다.
// 실패(던짐)·구글 지도가 아닌 주소는 건너뛴다.
export async function resolveShortLink(url, resolvers) {
  const short = String(url ?? '').trim();
  if (!isShortMapsLink(short)) return null;
  for (const resolve of resolvers) {
    try {
      const long = await resolve(short);
      if (isGoogleMapsUrl(long)) return long;
    } catch { /* 다음 방법으로 */ }
  }
  return null;
}

// 웹 중계: GET <relay>?url=<짧은 링크> → { url: 긴 주소 | null }. 중계 주소가 없거나 실패하면 null.
export function relayResolver(relayUrl, fetchImpl = globalThis.fetch, timeoutMs = 8000) {
  return async (short) => {
    if (!relayUrl || typeof fetchImpl !== 'function') return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${relayUrl}?url=${encodeURIComponent(short)}`, { signal: ctrl.signal });
      if (!res.ok) return null;
      const body = await res.json();
      return typeof body?.url === 'string' ? body.url : null;
    } finally {
      clearTimeout(timer);
    }
  };
}
