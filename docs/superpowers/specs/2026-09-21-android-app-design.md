# 여행 로그 안드로이드 앱 설계

작성일 2026-09-21. 웹 버전(GitHub Pages)은 그대로 두고, 같은 코드를 안드로이드 APK로도 내놓는다.

## 1. 목적과 범위

- 목적: (B) 폰 기능 — 구글 지도 앱의 "공유 → 여행 로그", 다음 목적지 알림 / (C) 동행이 쉽게 설치 / 오프라인에서 앱이 무조건 열림.
- 플랫폼: 안드로이드만. iOS는 이번 범위 밖 (맥·Apple 개발자 계정 필요).
- 배포: Play 스토어가 아니라 GitHub Releases. 태그 `vX.Y.Z` 마다 `travel-log-X.Y.Z.apk` 첨부. 동행은 APK 를 받아 설치.
- 비용: 0원. Play 등록비도 없고, 모든 백엔드(Firebase Spark, Google Maps 무료 한도)는 지금과 같다.
- 첫 버전(v1.0.0) 필수: 공유 시트 받기, 다음 목적지 로컬 알림, 앱 파일 APK 내장(오프라인). 홈 화면 위젯은 2차.

## 2. 구조: 한 저장소, 두 산출물

- 웹 코드(`index.html`, `css/`, `js/`, `icons/`, `manifest.webmanifest`)는 그대로 웹에 배포된다.
- 저장소에 Capacitor 안드로이드 프로젝트를 추가한다: `package.json` 에 Capacitor 의존성, `capacitor.config.json`, `android/` 폴더(커밋함), `dist/`(빌드 산출물, 커밋 안 함).
- `scripts/build-web.js` 가 웹 파일을 `dist/` 로 복사한다(테스트·문서·android 제외). Capacitor 의 `webDir` 는 `dist`.
- 번들러는 쓰지 않는다. 네이티브 기능은 Capacitor 가 웹뷰에 주입하는 전역 `window.Capacitor` 와 `Capacitor.Plugins.*` 로 부른다. 이를 감싸는 `js/native.js` 하나만 새로 만든다:
  - `isNative()` — `window.Capacitor?.isNativePlatform?.()`.
  - `googleSignIn()`, `getSharedText()`, `scheduleNotifications(list)`, `cancelNotifications()`, `appVersion()` — 네이티브가 아니면 각각 null/빈 값/no-op.
- 웹뷰 안의 출처(origin)는 `https://travellog.local` 로 고정한다(`capacitor.config.json` 의 `server.hostname`). Firebase Auth 승인 도메인과 Google Maps 키의 HTTP 리퍼러에 이 주소를 추가한다.
- 앱에서는 서비스 워커를 등록하지 않는다(`js/app.js` 에서 `isNative()` 면 건너뜀). 파일이 APK 안에 있어 필요 없다.
- 지도 타일·검색·경로·날씨는 인터넷이 필요하다(구글 약관상 타일은 저장 불가). 일정 데이터는 Firestore 오프라인 캐시로 인터넷 없이 읽고 쓴다(재접속 시 동기화). 이는 지금 웹과 같다.

## 3. 로그인

- 문제: 구글은 앱 내 웹뷰의 OAuth 팝업을 막는다(`disallowed_useragent`). 현재 `signInWithPopup` 은 앱에서 동작하지 않는다.
- 해결: 앱에서는 네이티브 구글 로그인 플러그인(`@capacitor-firebase/authentication`, Google 제공자)으로 ID 토큰을 받고, JS 의 Firebase Auth 에 `signInWithCredential(GoogleAuthProvider.credential(idToken))` 로 넘긴다. 이후 흐름(`canUseApp`, `ensureProfile`, 규칙)은 웹과 완전히 같다.
- `js/auth.js` 의 `signIn()` 이 `isNative()` 면 네이티브 경로, 아니면 기존 팝업 경로를 탄다. 로그아웃은 JS `signOut()` 과 네이티브 로그아웃을 둘 다 부른다.
- 준비물(콘솔, 무료): Firebase 프로젝트 `travel-log-d6cc9` 에 안드로이드 앱 등록(패키지 `io.github.y1kk3love.travellog`), 서명 키의 SHA-1·SHA-256 지문 등록, 내려받은 `google-services.json` 을 `android/app/` 에 둔다. 이 파일은 공개해도 되는 값이라 커밋한다.
- Firebase Auth 승인 도메인에 `travellog.local` 추가.

## 4. 공유 시트 받기

- `android/app/src/main/AndroidManifest.xml` 에 `ACTION_SEND` + `text/plain` 인텐트 필터. 플러그인 `send-intent` 로 공유 텍스트를 읽는다.
- 앱이 공유로 열리거나(콜드 스타트) 앞으로 나오면(`appUrlOpen`/`resume`), `native.getSharedText()` 가 텍스트를 돌려주고 라우터를 `#/share` 로 보낸다. 텍스트는 메모리(모듈 변수)에만 둔다.
- 새 화면 `js/views/share.js`(`#/share`): "어느 여행에 넣을까요?" — 여행 목록(진행 중·다가오는 여행이 위, 지난 여행은 아래)을 고르면 Day 선택(보관함 포함). 마지막으로 본 여행이 있으면 기본 선택. 고르면 그 여행의 일정 화면으로 이동해 장소 추가 창을 열고, 검색창에 공유 텍스트를 넣어 기존 붙여넣기 로직(`applyPastedCoords` → `parseShareText`/좌표 파싱)을 그대로 태운다.
- 공유 텍스트에 이름이 없고 짧은 링크만 있으면 지금과 같은 안내 토스트가 뜬다.
- 로그인 전에 공유로 열리면 로그인 후 `#/share` 로 이어간다.

## 5. 다음 목적지 알림

- 플러그인 `@capacitor/local-notifications`. 서버 없음. 앱이 꺼져 있어도 폰이 울린다.
- 계산은 순수 함수 `js/lib/alarms.js`:
  - `planAlarms(trips, places, now)` → `[{ id, tripId, placeId, at(ms), title, body }]`
  - 대상: 오늘·내일 날짜의 Day 에 있고 시각(입력 또는 추정)이 있는 장소. 메모 제외. 이미 지난 것 제외.
  - 시각: `출발 = 도착 시각 − 앞 구간 도보 시간(저장된 구글 경로 우선, 없으면 직선 추정) − 10분`. 첫 장소는 `도착 − 10분`.
  - 문구: 제목 "곧 출발: {장소 이름}", 본문 "{HH:MM} 도착 예정 · 도보 {N}분" (첫 장소는 "{HH:MM} 예정").
  - 최대 20개, 시각 순.
  - id 는 `placeId` 를 안정적으로 해시한 정수(같은 장소는 같은 id → 중복 예약 방지).
- 예약 시점: 앱 시작 직후, 일정 화면의 places/days 스냅샷이 바뀔 때(디바운스 2초). 매번 기존 예약을 모두 취소하고 다시 예약한다.
- 권한: 첫 예약 시도 때 `requestPermissions()`. 거부하면 조용히 건너뛰고, 사용량 창 옆에 "알림이 꺼져 있어요" 안내 한 줄(설정으로 가는 버튼).
- 알림을 누르면 앱이 열리고 그 여행의 일정 화면(`#/trip/{id}/planner/{placeId}`)으로 간다.

## 6. 새 버전 확인

- 앱 시작 시 하루 한 번 `https://api.github.com/repos/y1kk3love/Travel-Log/releases/latest` 를 읽는다(공개, 인증 없음). `tag_name` 과 앱 버전(`native.appVersion()`)을 `js/lib/version.js` 의 `isNewer(a, b)` 로 비교한다.
- 새 버전이면 상단에 배너 "새 버전 v1.1.0 받기" → 릴리스의 APK 자산(`browser_download_url`)을 연다. "다음에" 를 누르면 그 버전은 이번 세션 동안 다시 묻지 않는다.
- 실패(오프라인, 한도)는 무시한다.

## 7. 빌드와 배포

- 서명 키: 로컬에서 `keytool` 로 한 번 만든다(`travel-log.keystore`, 별칭 `travel-log`). 저장소에 넣지 않는다. base64 로 인코딩해 GitHub Secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` 에 보관한다. 키를 잃으면 기존 설치 위에 업데이트할 수 없으므로 사용자가 별도 보관한다.
- 워크플로 `.github/workflows/android-release.yml`: 태그 `v*` 푸시에 실행. Ubuntu, Java 17, Android SDK, Node 24. 순서: `npm ci` → `npm test` → `node scripts/build-web.js` → `npx cap sync android` → `versionName` = 태그, `versionCode` = major*10000 + minor*100 + patch → `gradlew assembleRelease`(서명 포함) → `softprops/action-gh-release` 로 `travel-log-X.Y.Z.apk` 첨부, 릴리스 노트는 태그 메시지.
- 버전 표시: 앱 설정(사용량 창 하단)에 현재 버전. 웹에는 표시 안 함.
- README 에 설치 안내: 릴리스 링크 → APK 다운로드 → "알 수 없는 앱 설치 허용" → 설치. 업데이트는 같은 서명이라 덮어쓰기 설치.

## 8. 파일 목록 (새로 만들거나 바뀌는 것)

- 새 파일: `capacitor.config.json`, `android/**`, `scripts/build-web.js`, `js/native.js`, `js/views/share.js`, `js/lib/alarms.js`, `js/lib/version.js`, `js/update-check.js`, `.github/workflows/android-release.yml`, `tests/alarms.test.js`, `tests/version.test.js`, `tests/share.test.js`(공유 텍스트→라우팅 파싱이 필요하면).
- 바뀌는 파일: `package.json`(의존성·스크립트), `js/app.js`(서비스 워커 건너뜀, 공유 진입, 알림 예약 시작, 업데이트 확인), `js/auth.js`(네이티브 로그인 분기), `js/router.js`(`share` 라우트), `js/views/planner.js`(스냅샷 변경 시 알림 재예약 훅, 공유로 진입 시 장소 창 열기), `js/views/usage-dialog.js`(앱 버전·알림 상태), `README.md`, `.gitignore`(`dist/`, 키 파일).
- 콘솔 작업: Firebase 안드로이드 앱 등록 + SHA 지문 + 승인 도메인, Google Cloud 지도 키 리퍼러 추가, GitHub Secrets 4개.

## 9. 오류 처리

- 네이티브 플러그인이 없거나 실패하면(예: 웹) 모든 `native.*` 는 no-op/null 을 돌려주고 앱은 웹과 같이 동작한다.
- 네이티브 로그인 실패: 토스트 "로그인에 실패했어요" + 다시 시도 버튼. 취소는 조용히.
- 알림 권한 거부: 예약 건너뜀, 안내 한 줄.
- 공유 텍스트가 비었거나 파싱 불가: 여행 선택 화면 대신 홈으로 가고 토스트.
- 새 버전 확인 실패: 무시.
- APK 빌드 실패: Actions 에서 릴리스가 만들어지지 않는다(반쪽 릴리스 없음).

## 10. 테스트

- 단위(`npm test`): `planAlarms`(오늘·내일 필터, 시각 계산, 지난 것 제외, 20개 상한, id 안정성), `isNewer`(v1.2.0 > v1.10.0 같은 숫자 비교), 공유 진입 파싱.
- 수동(폰): 릴리스 APK 설치 → 구글 로그인 → 구글 지도에서 장소 공유 → 여행·Day 선택 → 검색 결과 뜸 → 저장. 시간 있는 장소를 오늘로 옮기고 알림이 울리는지. 비행기 모드에서 앱을 열어 일정이 보이는지. 웹(github.io)은 전과 같이 동작하는지.
- 첫 릴리스 `v1.0.0` 후 문제는 `v1.0.1` 로 고친다.

## 11. 하지 않는 것

- iOS, Play 스토어, 홈 화면 위젯, 백그라운드 위치 추적, 푸시 서버, 지도 타일 오프라인 저장, 앱 내 자동 업데이트(다운로드 안내까지만).
