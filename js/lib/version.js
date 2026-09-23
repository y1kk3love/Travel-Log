// 앱 버전 비교 (순수 함수). "v1.10.0" 같은 태그를 숫자로 비교한다 (문자열 비교면 1.9 > 1.10 이 되어 버린다).
export function parseVersion(s) {
  const m = String(s ?? '').trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  return m ? [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)] : null;
}

export function isNewer(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] > y[i]; }
  return false;
}

export function pickApk(assets) {
  return (assets ?? []).find((a) => /\.apk$/i.test(a.name ?? ''))?.browser_download_url ?? null;
}

// GitHub 릴리스 JSON → { url, version }. APK 자산이 없으면 릴리스 페이지 주소로. 태그가 없으면 null.
export function latestApk(rel) {
  if (!rel || !rel.tag_name) return null;
  return { url: pickApk(rel.assets) ?? rel.html_url ?? null, version: rel.tag_name };
}

// 앱이 최소 지원 버전(app-config.json 의 minAppVersion)보다 낮으면 true. 설정이 없거나 이상하면 막지 않는다.
export function mustUpdate(current, config) {
  const min = config?.minAppVersion;
  if (!parseVersion(current) || !parseVersion(min)) return false;
  return isNewer(min, current);
}
