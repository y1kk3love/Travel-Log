# Travel Log

트리플처럼 여행 일정을 짜고 지도에서 동선을 보는 플래너. 사이트 주인과 초대한 동행이 함께 쓴다. GitHub Pages + Firebase, 안드로이드 앱(Capacitor).

- 사이트: https://y1kk3love.github.io/Travel-Log/
- 데이터: Firebase 프로젝트 `travel-log-d6cc9` (Firestore + Google 로그인, 무료 Spark). 로그인은 사이트 주인과 초대 목록(`allowedUsers`)의 계정만. 구조는 `docs/data-model.md`
- 지도: Google Maps Platform, 별도 Cloud 프로젝트 `travel-log-maps` (Firebase 와 분리해 Firebase 는 무료 요금제 유지)
  - Maps JavaScript(지도), Places API New(검색 자동완성), Geocoding(고른 장소의 위치·주소를 장소 ID 로, 지도 라이브러리의 Geocoder). 장소 상세(Places Details)는 쓰지 않는다. 도보 경로(Routes API)는 쓰지 않는다: 지도는 장소 사이를 점선 직선으로 잇고, 실제 길은 일정의 "길찾기"(구글 지도 앱·웹으로 연결, 요금 없음)로 본다. 옛 앱이 부르지 않게 콘솔에서 Routes API 는 사용 중지
  - 키는 사이트 주소로 제한. 콘솔 할당량에 하루 한도를 걸어 둠: 지도 로드·자동완성·Geocoding(v3) 각 320 (월 무료 10,000건 아래. Geocoding 은 요금 등급이 하나라 키가 악용돼도 이 안), 앱이 쓰지 않는 메서드(장소 상세·텍스트 검색·주변 검색·사진·경로 행렬·Geocoding v4 등)는 0. 키의 API 제한은 Maps JavaScript·Places API (New)·Geocoding 셋. 한도를 넘으면 그 기능만 멈추고 검색은 OpenStreetMap(Nominatim)으로 대체됨. Nominatim 은 입력 중 검색을 금지해서 엔터나 버튼을 눌러야 찾는다
  - 예산 알림 월 ₩1,000 (메일)
- 사진·예약 서류: 앱에서 올리면 줄여서 Firestore 문서에 직접 저장 (Storage 는 카드 등록이 필요해 안 씀). 사진은 원본(긴 변 1280px)과 작은 썸네일(240px)을 함께 저장하고, 장소 창은 썸네일만 받는다 (원본은 눌러 크게 볼 때만). `photos/` 폴더는 예전 방식의 흔적으로 지금은 쓰지 않는다

## 안드로이드 앱

- 최신 APK: https://github.com/y1kk3love/Travel-Log/releases/latest → `travel-log-X.Y.Z.apk`
- 설치: 폰에서 APK 다운로드 → 열기 → "알 수 없는 앱 설치 허용"(처음 한 번) → 설치. 업데이트는 새 APK 를 같은 방법으로 설치하면 덮어써진다.
- 앱에서만 되는 것: 구글 지도 앱의 "공유 → 여행 로그", 다음 목적지 출발 알림, 인터넷 없이 앱 열기.
- 릴리스 만들기: `git tag v1.2.3 && git push origin v1.2.3` → Actions 가 APK 와 `.sha256` 체크섬을 만들어 릴리스에 붙인다. 서명 키는 `docs/android-signing.md`. 실패하면 Actions 화면에서 다시 실행하거나 새 태그로.
- 옛 앱 막기: 데이터 구조를 바꿔 옛 버전 앱이 깨질 때는 저장소 루트 `app-config.json` 의 `minAppVersion` 을 올려 main 에 올린다. 앱은 시작·복귀 때 웹(GitHub Pages)의 이 파일을 읽어, 더 낮은 버전이면 닫을 수 없는 업데이트 화면을 띄운다 (오프라인이면 막지 않는다). 이 기능은 v1.1.22 부터 들어 있다.
- 구조: 웹 코드를 `dist/` 로 복사하고 Firebase 모듈(`dist/vendor/firebase/`)과 글꼴(`dist/vendor/fonts/`)을 내려받아 Capacitor(`android/`)에 담는다(인터넷 없이도 앱이 열리도록, `scripts/build-web.js`). 네이티브 기능은 `js/native.js` 한 곳에서만 부르고 웹에서는 no-op. 시스템 바·키보드 여백은 Capacitor SystemBars 가 준다(`index.html` 에 `viewport-fit=cover` 를 넣지 말 것).

## 로컬 실행

```bash
npx --yes http-server -p 8080 -c-1 .
```
`http://localhost:8080/` 에서 Google 로그인.

## 테스트

```bash
npm test
```

보안 규칙 테스트 (Firestore 에뮬레이터, Java 21 필요. demo 프로젝트라 로그인·과금 없음):

```bash
npm run test:rules
```

화면 테스트 (실제 화면 코드를 가짜 데이터로 띄워 주요 흐름을 눌러 본다. 설치된 크롬·엣지를 쓰고, 이 컴퓨터 밖으로 나가는 요청은 막는다):

```bash
npm run test:ui
```

코드 검사 (ESLint: 안 쓰는 import·선언 안 한 이름 같은 실수):

```bash
npm run lint
```

## 배포

main 에 올리면 GitHub Actions(`.github/workflows/test.yml`)가 코드 검사·단위 테스트·규칙 테스트·화면 테스트를 돌리고, **모두 통과했을 때만** 앱 파일을 모아(`scripts/build-site.js`) GitHub Pages 에 올린다. 하나라도 실패하면 사이트는 이전 상태로 남는다.

- 저장소 Settings → Pages → Source 가 "GitHub Actions" 여야 한다. "Deploy from a branch" 로 두면 검사와 상관없이 올리는 즉시 배포된다.
- 보안 규칙은 따로 게시한다 (`npm run deploy:rules`). 새 필드·새 모음을 쓰는 변경은 **규칙을 먼저 게시하고** 웹을 올린다 (반대로 하면 그 저장이 `permission-denied` 로 막힌다).

## 화면 확인 (로그인 없이)

`http://localhost:8080/harness/` 는 `index.html` 과 같은 화면 코드를 가짜 데이터로 띄운다 (import map 이 `js/firebase.js`·`db.js`·`auth.js` 를 `harness/fake-*.js` 로 바꾼다). 화면 테스트도 이걸 쓴다. `js/db.js` 에 내보내는 함수를 더하면 `harness/fake-db.js` 에도 같은 이름을 더한다 (테스트가 알려 준다). 사이트에는 배포되지 않는다.

## 구조

- `js/app.js` 로그인 분기 → `js/router.js` 해시 라우팅 → `js/views/*`
- `js/db.js` Firestore 접근 전부
- `js/lib/*` 순수 계산 (테스트 대상)
- 장소 창은 `js/views/place-sheet.js`(보기·편집·저장) + `place-location.js`(검색·링크) + `place-photos.js`(사진·썸네일) + `js/sheet-swipe.js`(끌어 닫기). 있는 장소를 열면 읽기 화면이 먼저 뜨고 "편집"을 눌러야 입력 폼이 된다
- 관리자(사이트 주인, `OWNER_UID`): 내 계정 메뉴 → "관리자 · 모든 여행"(`#/admin`, `js/views/admin.js`). 동행 목록에 들어가지 않고 모든 여행을 보고·고치고·지우고 동행을 관리한다 (규칙의 `isSiteOwner()`). 동행이 아닌 여행에서는 "관리자로 보는 중" 표시가 나에게만 보인다
- `firestore.rules` 보안 규칙. 게시는 `npm run deploy:rules` (처음 한 번 `npx firebase login`). 문서에 새 필드를 쓰면 규칙의 필드 목록·`tests-rules/` 도 함께 고친다
- `manifest.webmanifest`, `sw.js`, `icons/` 홈 화면 앱(PWA). 서비스 워커는 설치 때 앱 파일을 전부 받아 두므로, JS 파일을 더하거나 지우면 `npm run sw:precache` (테스트가 알려 준다). 아이콘은 `node scripts/make-icons.js`로 `favicon.svg`에서 다시 만든다
- `js/firebase-sdk.js` Firebase SDK 버전은 여기 한 곳
- `app-config.json` 앱 최소 지원 버전 (위 "옛 앱 막기")
- 날씨는 Open-Meteo(키 없음, 오늘부터 15일 안의 날짜만), 도착 예상 시간은 `js/lib/timeline.js`
- 구글 지도 짧은 공유 링크(maps.app.goo.gl): 앱은 네이티브(`SharePlugin.resolveLink`)로, 웹은 중계 `relay/maps-link.gs`(사이트 주인 구글 계정의 Apps Script 웹 앱 "여행 로그 지도 링크 중계", 주소는 `js/firebase-config.js` 의 `MAPS_LINK_RELAY`)로 따라간다. 중계 코드를 고치면 Apps Script 편집기에 붙여넣고 "배포 관리 → 수정 → 새 버전"으로 올린다 (주소는 그대로)
- 설계: `docs/superpowers/specs/2026-09-20-travel-planner-design.md` (첫 설계. 지금과 다른 점은 그 문서 맨 위에 적어 둠), 데이터 구조: `docs/data-model.md`
