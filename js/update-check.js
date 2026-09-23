// 앱 전용: GitHub 최신 릴리스와 앱 버전을 비교해 새 버전 배너를 띄운다. 30분에 1회(시작·복귀 때), 실패는 무시.
import { isNative, appVersion } from './native.js';
import { isNewer, pickApk, mustUpdate } from './lib/version.js';
import { el } from './ui.js';

const API = 'https://api.github.com/repos/y1kk3love/Travel-Log/releases/latest';
const STAMP = 'tl.update.checkedAt';
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 하루 1회면 같은 날 올린 릴리스를 다음 날까지 못 본다. GitHub 미인증 API 는 시간당 60회라 30분이면 넉넉하다
const SKIP = 'tl.update.skip';
// 최소 지원 버전: 웹(GitHub Pages)에 올린 설정을 앱이 읽는다. 데이터 구조를 바꿔 옛 앱이 깨질 때 minAppVersion 을 올린다.
const CONFIG_URL = 'https://y1kk3love.github.io/Travel-Log/app-config.json';
const RELEASES_PAGE = 'https://github.com/y1kk3love/Travel-Log/releases/latest';

// 앱 전용: 지금 앱이 최소 지원 버전보다 낮으면 닫을 수 없는 업데이트 화면을 띄운다. 시작·복귀 때마다 확인하고,
// 오프라인이거나 설정을 못 읽으면 막지 않는다 (여행 중에 앱이 잠기면 안 된다).
export async function checkMinVersion() {
  if (!isNative() || globalThis.document?.querySelector?.('.force-update')) return;
  try {
    const res = await fetch(CONFIG_URL, { cache: 'no-store' });
    if (!res.ok) return;
    const config = await res.json();
    const current = await appVersion();
    if (!mustUpdate(current, config)) return;
    let url = RELEASES_PAGE;
    try {
      const rel = await (await fetch(API, { headers: { Accept: 'application/vnd.github+json' } })).json();
      url = pickApk(rel.assets) ?? url;
    } catch { /* 릴리스 페이지로 안내 */ }
    document.body.append(el('div', { class: 'force-update', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'fu-title' },
      el('div', { class: 'force-update-card' },
        el('h2', { id: 'fu-title', text: '새 버전으로 업데이트해 주세요' }),
        el('p', { class: 'muted', text: `지금 앱(${current})은 더 이상 쓸 수 없어요. 최신 버전(${config.minAppVersion} 이상)을 설치하면 일정은 그대로 이어서 볼 수 있어요.` }),
        el('a', { class: 'btn btn-primary', href: url, target: '_blank', rel: 'noopener', text: '최신 버전 받기' }))));
  } catch (err) { console.warn('min version check', err); }
}

export async function checkForUpdate() {
  if (!isNative()) return;
  try {
    const last = Number(localStorage.getItem(STAMP) || 0);
    if (Date.now() - last < CHECK_INTERVAL_MS) return;
    if (globalThis.document?.querySelector?.('.update-banner')) return; // 이미 배너가 떠 있으면 또 붙이지 않는다
    const res = await fetch(API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return; // 실패하면 도장을 찍지 않아 다음 실행 때 다시 시도한다
    localStorage.setItem(STAMP, String(Date.now()));
    const rel = await res.json();
    const current = await appVersion();
    if (!current || !isNewer(rel.tag_name, current)) return;
    if (sessionStorage.getItem(SKIP) === rel.tag_name) return;
    const url = pickApk(rel.assets) ?? rel.html_url;
    const banner = el('div', { class: 'update-banner' },
      el('span', { text: `새 버전 ${rel.tag_name}이 나왔어요` }),
      el('a', { class: 'btn btn-sm btn-primary', href: url, target: '_blank', rel: 'noopener', text: '받기' }),
      el('button', { class: 'btn btn-sm btn-ghost', onClick: () => { sessionStorage.setItem(SKIP, rel.tag_name); banner.remove(); } }, '다음에'));
    document.body.prepend(banner);
  } catch (err) { console.warn('update check', err); }
}
