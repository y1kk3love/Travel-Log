# Travel Log

트리플처럼 여행 일정을 짜고 지도에서 동선을 보는 플래너. 사이트 주인과 초대한 동행이 함께 쓴다. GitHub Pages + Firebase, 안드로이드 앱(Capacitor).

- 사이트: https://y1kk3love.github.io/Travel-Log/
- 데이터: Firebase 프로젝트 `travel-log-d6cc9` (Firestore + Google 로그인, 무료 Spark). 로그인은 사이트 주인과 초대 목록(`allowedUsers`)의 계정만. 구조는 `docs/data-model.md`
- 지도: Google Maps Platform, 별도 Cloud 프로젝트 `travel-log-maps` (Firebase 와 분리해 Firebase 는 무료 요금제 유지)
  - Maps JavaScript(지도), Places API New(검색 자동완성 + 위치·주소만 조회), Routes API(3km 이하 구간 도보 경로)
  - 키는 사이트 주소로 제한. 콘솔 할당량에 하루 한도를 걸어 둠: 지도 로드·자동완성 각 320 (월 무료 10,000건 아래), 장소 상세·경로 각 32 (키가 악용돼 가장 비싼 등급으로 불려도 월 무료 1,000건 아래), 앱이 쓰지 않는 메서드(텍스트 검색·주변 검색·사진·경로 행렬 등)는 0. 한도를 넘으면 그 기능만 멈추고 검색은 OpenStreetMap 으로 대체됨. 도보 경로는 "경로 없음"까지 30일간 저장해 다시 묻지 않음
  - 예산 알림 월 ₩1,000 (메일)
- 사진·예약 서류: 앱에서 올리면 줄여서 Firestore 문서에 직접 저장 (Storage 는 카드 등록이 필요해 안 씀). `photos/` 폴더는 예전 방식 사진만

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

main 에 올리면 GitHub Actions 가 둘 다 돌린다 (`.github/workflows/test.yml`).

## 구조

- `js/app.js` 로그인 분기 → `js/router.js` 해시 라우팅 → `js/views/*`
- `js/db.js` Firestore 접근 전부
- `js/lib/*` 순수 계산 (테스트 대상)
- `firestore.rules` 보안 규칙. 게시는 `npm run deploy:rules` (처음 한 번 `npx firebase login`). 문서에 새 필드를 쓰면 규칙의 필드 목록·`tests-rules/` 도 함께 고친다
- `manifest.webmanifest`, `sw.js`, `icons/` 홈 화면 앱(PWA). 서비스 워커는 설치 때 앱 파일을 전부 받아 두므로, JS 파일을 더하거나 지우면 `npm run sw:precache` (테스트가 알려 준다). 아이콘은 `node scripts/make-icons.js`로 `favicon.svg`에서 다시 만든다
- `js/firebase-sdk.js` Firebase SDK 버전은 여기 한 곳. `js/walk-routes.js` Routes API 도보 경로
- `app-config.json` 앱 최소 지원 버전 (위 "옛 앱 막기")
- 날씨는 Open-Meteo(키 없음, 오늘부터 15일 안의 날짜만), 도착 예상 시간은 `js/lib/timeline.js`
- 설계: `docs/superpowers/specs/2026-09-20-travel-planner-design.md` (첫 설계. 지금과 다른 점은 그 문서 맨 위에 적어 둠), 데이터 구조: `docs/data-model.md`
