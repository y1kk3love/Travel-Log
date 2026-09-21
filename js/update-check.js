// 앱 전용: GitHub 최신 릴리스와 앱 버전을 비교해 새 버전 배너를 띄운다. 하루 1회, 실패는 무시.
import { isNative, appVersion } from './native.js';
import { isNewer, pickApk } from './lib/version.js';
import { el } from './ui.js';

const API = 'https://api.github.com/repos/y1kk3love/Travel-Log/releases/latest';
const STAMP = 'tl.update.checkedAt';
const SKIP = 'tl.update.skip';

export async function checkForUpdate() {
  if (!isNative()) return;
  try {
    const last = Number(localStorage.getItem(STAMP) || 0);
    if (Date.now() - last < 24 * 3600 * 1000) return;
    localStorage.setItem(STAMP, String(Date.now()));
    const res = await fetch(API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return;
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
