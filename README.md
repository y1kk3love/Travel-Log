# Travel Log

트리플처럼 여행 일정을 짜고 지도에서 동선을 보는 개인용 플래너. GitHub Pages + Firebase.

- 사이트: https://y1kk3love.github.io/Travel-Log/
- 데이터: Firebase 프로젝트 `travel-log-d6cc9` (Firestore + Google 로그인, 본인 계정만 허용, 무료 Spark)
- 지도: Google Maps Platform, 별도 Cloud 프로젝트 `travel-log-maps` (Firebase 와 분리해 Firebase 는 무료 요금제 유지)
  - Maps JavaScript(지도), Places API New(검색 자동완성 + 위치·주소만 조회), Routes API(3km 이하 구간 도보 경로)
  - 키는 사이트 주소로 제한. 콘솔 할당량에 하루 한도를 걸어 둠: 지도 로드·자동완성·장소 상세·경로 각 320 (31일 기준 9,920건, 월 무료 10,000건 아래). 한도를 넘으면 그 기능만 실패하고 검색은 OpenStreetMap 으로 대체됨
  - 예산 알림 월 ₩1,000 (메일)
- 사진: `photos/<여행 ID>/` 폴더에 GitHub 웹으로 업로드 (`photos/README.md`)

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
