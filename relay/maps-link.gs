// 여행 로그 — 구글 지도 짧은 링크 중계 (Google Apps Script 웹 앱)
//
// 구글 지도 앱이 공유하는 짧은 링크(maps.app.goo.gl)에는 위치가 없고, 따라가면 나오는 긴 주소에 이름·핀 좌표·장소 키가 있다.
// 웹 브라우저는 CORS 때문에 그 주소를 볼 수 없어서 이 스크립트가 대신 따라가 긴 구글 지도 주소만 돌려준다.
// (안드로이드 앱은 이 중계 없이 네이티브로 따라간다.)
//
// 배포: script.google.com 새 프로젝트에 이 파일 내용을 붙여넣고 → 배포 → 새 배포 → 웹 앱,
//       실행 계정 "나", 액세스 권한 "모든 사용자" → 나온 .../exec 주소를 js/firebase-config.js 의 MAPS_LINK_RELAY 에 넣는다.
// 안전: 구글 짧은 링크 주소만 요청하고(다른 주소로는 요청하지 않음), 본문은 읽지 않고 리디렉트의 Location 헤더만 본다.
//       구글 지도 주소가 아니면 null. 요청: GET ?url=<짧은 링크> → { "url": 긴 주소 | null }

var SHORT_LINK = /^https:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/maps)\/[^\s]+$/i;
var SHORT_HOST = /^https:\/\/(?:maps\.app\.goo\.gl|goo\.gl|g\.co)\//i;
var GOOGLE_MAPS = /^https:\/\/(?:www\.|maps\.)?google\.[a-z.]+\/maps[/?]/i;
var MAX_HOPS = 5;
var CACHE_SECONDS = 6 * 60 * 60;

function doGet(e) {
  var url = String((e && e.parameter && e.parameter.url) || '').trim();
  return json({ url: SHORT_LINK.test(url) ? resolve(url) : null });
}

function resolve(url) {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(url);
  if (hit) return hit;
  var current = url;
  try {
    for (var hop = 0; hop < MAX_HOPS && current && !GOOGLE_MAPS.test(current); hop++) {
      if (!SHORT_HOST.test(current)) return null;
      var res = UrlFetchApp.fetch(current, { followRedirects: false, muteHttpExceptions: true });
      var code = res.getResponseCode();
      var headers = res.getAllHeaders();
      var location = headers.Location || headers.location;
      if (Array.isArray(location)) location = location[0];
      current = code >= 300 && code < 400 && location ? String(location) : null;
    }
  } catch (err) {
    return null; // 시간 초과 등: 캐시에 남기지 않아 다음에 다시 시도한다
  }
  if (!current || !GOOGLE_MAPS.test(current)) return null;
  cache.put(url, current, CACHE_SECONDS);
  return current;
}

function json(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
