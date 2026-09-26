// 홈 화면 앱(PWA)·웹용 서비스 워커.
// - 설치 때 앱 파일(모든 JS 모듈 포함, PRECACHE)을 미리 받아 둔다 → 한 번 열었으면 오프라인이어도 열린다
// - 같은 출처(앱 파일): 서버에 바뀌었는지 묻고(no-cache, 304 면 빠르다) 받아 캐시를 갱신한다.
//   배포 직후 브라우저 HTTP 캐시(GitHub Pages 10분)에 남은 옛 파일과 새 파일이 섞이지 않게.
//   NETWORK_WAIT_MS 안에 답이 없으면(느린 망) 캐시로 먼저 보여 주고, 받은 건 뒤에서 캐시에 넣는다
// - CDN(지도 라이브러리, Firebase SDK, 글꼴): 캐시 우선 (버전이 URL에 박혀 있어 안전)
// - 데이터(Firestore, 타일, 검색, 날씨 API)는 건드리지 않는다. Firestore 는 자체 오프라인 캐시가 있다.
// - 주소의 쿼리(공유로 받은 글 ?title=&text= 등)는 캐시 키에 넣지 않는다 (개인 내용이 캐시에 남지 않게)
const VERSION = 'v3';
const APP_CACHE = `app-${VERSION}`;
const CDN_CACHE = 'cdn-v2';
const NETWORK_WAIT_MS = 3500;
// npm run sw:precache 로 갱신 (scripts/sw-precache.js)
const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "favicon.svg",
  "css/main.css",
  "js/alarms.js",
  "js/app.js",
  "js/auth.js",
  "js/db.js",
  "js/firebase-config.js",
  "js/firebase-sdk.js",
  "js/firebase.js",
  "js/geocode.js",
  "js/gmaps.js",
  "js/lib/alarms.js",
  "js/lib/clipboard.js",
  "js/lib/coords.js",
  "js/lib/dates.js",
  "js/lib/expenses.js",
  "js/lib/file-type.js",
  "js/lib/firestore-size.js",
  "js/lib/flight.js",
  "js/lib/geo.js",
  "js/lib/image.js",
  "js/lib/members.js",
  "js/lib/nav.js",
  "js/lib/order.js",
  "js/lib/overlays.js",
  "js/lib/polyline.js",
  "js/lib/pool.js",
  "js/lib/profile.js",
  "js/lib/quota.js",
  "js/lib/reservation-links.js",
  "js/lib/reservation-place.js",
  "js/lib/schedule.js",
  "js/lib/settle.js",
  "js/lib/share.js",
  "js/lib/short-link.js",
  "js/lib/single-flight.js",
  "js/lib/stamp.js",
  "js/lib/text.js",
  "js/lib/timeline.js",
  "js/lib/version.js",
  "js/lib/weather.js",
  "js/map.js",
  "js/native.js",
  "js/photo.js",
  "js/places.js",
  "js/quota.js",
  "js/rates.js",
  "js/router.js",
  "js/ui.js",
  "js/update-check.js",
  "js/views/account-menu.js",
  "js/views/action-menu.js",
  "js/views/app-download.js",
  "js/views/avatar.js",
  "js/views/checklist.js",
  "js/views/cover-dialog.js",
  "js/views/expenses.js",
  "js/views/invites-dialog.js",
  "js/views/members-dialog.js",
  "js/views/place-sheet.js",
  "js/views/planner.js",
  "js/views/profile-dialog.js",
  "js/views/reservations.js",
  "js/views/share.js",
  "js/views/topbar.js",
  "js/views/trip-edit-dialog.js",
  "js/views/trip.js",
  "js/views/trips.js",
  "js/views/usage-dialog.js",
  "js/walk-routes.js",
  "js/weather.js"
];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  // 하나가 실패해도 나머지는 받아 둔다 (addAll 은 하나만 실패해도 전부 실패)
  event.waitUntil(caches.open(APP_CACHE)
    .then((cache) => Promise.allSettled(PRECACHE.map((path) => cache.add(new Request(path, { cache: 'reload' })))))
    .then(() => self.skipWaiting()));
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
    event.respondWith(networkFirst(event, request));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
});

// 같은 출처는 쿼리를 뺀 주소로 캐시한다
function cacheKey(request) {
  const url = new URL(request.url);
  return url.origin + url.pathname;
}

async function networkFirst(event, request) {
  const cache = await caches.open(APP_CACHE);
  const key = cacheKey(request);
  const fromNetwork = fetch(request, { cache: 'no-cache' }).then((res) => {
    if (res.ok) cache.put(key, res.clone());
    return res;
  });
  event.waitUntil(fromNetwork.catch(() => {})); // 캐시로 먼저 답해도 받은 건 끝까지 넣는다
  const cachedLater = new Promise((resolve) => setTimeout(() => resolve(cache.match(key)), NETWORK_WAIT_MS));
  try {
    // 네트워크가 먼저 오면 그걸, 오래 걸리면 캐시(있을 때)를
    const first = await Promise.race([fromNetwork, cachedLater.then((hit) => hit || fromNetwork)]);
    if (first) return first;
  } catch { /* 오프라인 → 아래 캐시 */ }
  const cached = await cache.match(key);
  if (cached) return cached;
  if (request.mode === 'navigate') {
    const shell = (await cache.match(new URL('./', self.location).href)) || (await cache.match(new URL('index.html', self.location).href));
    if (shell) return shell;
  }
  return fromNetwork; // 캐시도 없으면 네트워크 오류를 그대로
}

async function cacheFirst(request) {
  const cache = await caches.open(CDN_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}
