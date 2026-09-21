// 홈 화면 앱(PWA)용 서비스 워커.
// - 같은 출처(앱 파일): 네트워크 우선, 실패하면 캐시 (배포 직후에도 최신 코드를 받도록)
// - CDN(지도 라이브러리, Firebase SDK): 캐시 우선 (버전이 URL에 박혀 있어 안전)
// - 데이터(Firestore, 타일, 검색, 날씨 API)는 건드리지 않는다. Firestore 는 자체 오프라인 캐시가 있다.
const VERSION = 'v2';
const APP_CACHE = `app-${VERSION}`;
const CDN_CACHE = `cdn-${VERSION}`;
const APP_SHELL = ['./', 'index.html', 'manifest.webmanifest', 'favicon.svg', 'css/main.css'];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== APP_CACHE && k !== CDN_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match('index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CDN_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}
