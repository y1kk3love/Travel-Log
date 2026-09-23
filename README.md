# Travel Log

트리플처럼 여행 일정을 짜고 지도에서 동선을 보는 개인용 플래너. GitHub Pages + Firebase.

- 사이트: https://y1kk3love.github.io/Travel-Log/
- 데이터: Firebase 프로젝트 `travel-log-d6cc9` (Firestore + Google 로그인, 본인 계정만 허용, 무료 Spark)
- 지도: Google Maps Platform, 별도 Cloud 프로젝트 `travel-log-maps` (Firebase 와 분리해 Firebase 는 무료 요금제 유지)
  - Maps JavaScript(지도), Places API New(검색 자동완성 + 위치·주소만 조회), Routes API(3km 이하 구간 도보 경로)
  - 키는 사이트 주소로 제한. 콘솔 할당량에 하루 한도를 걸어 둠: 지도 로드·자동완성 각 320 (월 무료 10,000건 아래), 장소 상세·경로 각 32 (키가 악용돼 가장 비싼 등급으로 불려도 월 무료 1,000건 아래), 앱이 쓰지 않는 메서드(텍스트 검색·주변 검색·사진·경로 행렬 등)는 0. 한도를 넘으면 그 기능만 멈추고 검색은 OpenStreetMap 으로 대체됨. 도보 경로는 "경로 없음"까지 30일간 저장해 다시 묻지 않음
  - 예산 알림 월 ₩1,000 (메일)
- 사진: `photos/<여행 ID>/` 폴더에 GitHub 웹으로 업로드 (`photos/README.md`)

## 안드로이드 앱

- 최신 APK: https://github.com/y1kk3love/Travel-Log/releases/latest → `travel-log-X.Y.Z.apk`
- 설치: 폰에서 APK 다운로드 → 열기 → "알 수 없는 앱 설치 허용"(처음 한 번) → 설치. 업데이트는 새 APK 를 같은 방법으로 설치하면 덮어써진다.
- 앱에서만 되는 것: 구글 지도 앱의 "공유 → 여행 로그", 다음 목적지 출발 알림, 인터넷 없이 앱 열기.
- 릴리스 만들기: `git tag v1.0.1 && git push origin v1.0.1` → Actions 가 APK 를 만들어 릴리스에 붙인다. 서명 키는 `docs/android-signing.md`.
- 옛 앱 막기: 데이터 구조를 바꿔 옛 버전 앱이 깨질 때는 저장소 루트 `app-config.json` 의 `minAppVersion` 을 올려 main 에 올린다. 앱은 시작·복귀 때 웹(GitHub Pages)의 이 파일을 읽어, 더 낮은 버전이면 닫을 수 없는 업데이트 화면을 띄운다 (오프라인이면 막지 않는다). 이 기능은 v1.1.22 부터 들어 있다.
- 구조: 웹 코드를 `dist/` 로 복사하고 Firebase CDN 모듈을 `dist/vendor/firebase/` 에 내려받아 Capacitor(`android/`)에 담는다(인터넷 없이도 앱이 열리도록). 네이티브 기능은 `js/native.js` 한 곳에서만 부르고 웹에서는 no-op.

## 로컬 실행

```bash
npx --yes http-server -p 8080 -c-1 .
```
`http://localhost:8080/` 에서 Google 로그인.

## 테스트

```bash
npm test
```

## 구조

- `js/app.js` 로그인 분기 → `js/router.js` 해시 라우팅 → `js/views/*`
- `js/db.js` Firestore 접근 전부
- `js/lib/*` 순수 계산 (테스트 대상)
- `firestore.rules` 보안 규칙 원본 (콘솔에 붙여 넣어 배포)
- `manifest.webmanifest`, `sw.js`, `icons/` 홈 화면 앱(PWA). 아이콘은 `node scripts/make-icons.js`로 `favicon.svg`에서 다시 만든다
- 날씨는 Open-Meteo(키 없음, 오늘부터 15일 안의 날짜만), 도착 예상 시간은 `js/lib/timeline.js`
- 설계: `docs/superpowers/specs/2026-09-20-travel-planner-design.md`
