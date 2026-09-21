// 웹 전용: 최신 안드로이드 APK 로 이어 주는 카드. 앱 안에서는 보이지 않는다.
// 처음엔 GitHub "최신 릴리스" 페이지를 가리키고, 릴리스 API 로 APK 직접 주소를 알아내면 바꿔 단다 (하루 1회 캐시).
import { el } from '../ui.js';
import { isNative } from '../native.js';
import { latestApk } from '../lib/version.js';

const API = 'https://api.github.com/repos/y1kk3love/Travel-Log/releases/latest';
const LATEST_PAGE = 'https://github.com/y1kk3love/Travel-Log/releases/latest';
const CACHE = 'tl.apk.latest';
const TTL = 24 * 3600 * 1000;

function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || 'null');
    return c && Date.now() - c.at < TTL ? c : null;
  } catch { return null; }
}

async function fetchLatest() {
  const cached = readCache();
  if (cached) return cached;
  const res = await fetch(API, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) return null;
  const info = latestApk(await res.json());
  if (!info) return null;
  try { localStorage.setItem(CACHE, JSON.stringify({ ...info, at: Date.now() })); } catch { /* 저장 못 해도 됨 */ }
  return info;
}

export function appDownloadCard() {
  if (isNative()) return null;
  const link = el('a', { class: 'btn btn-primary btn-sm', href: LATEST_PAGE, target: '_blank', rel: 'noopener', text: 'APK 받기' });
  const sub = el('p', { class: 'muted', text: '구글 지도에서 바로 공유해 넣기 · 다음 목적지 출발 알림 · 인터넷 없이 열기. 안드로이드 폰에서 받아 설치하세요.' });
  const card = el('div', { class: 'card app-download' },
    el('div', { class: 'app-download-body' },
      el('strong', { text: '안드로이드 앱' }), sub),
    link);
  fetchLatest().then((info) => {
    if (!info) return;
    link.href = info.url;
    link.textContent = `APK 받기 ${info.version}`;
  }).catch((err) => console.warn('latest apk', err));
  return card;
}
