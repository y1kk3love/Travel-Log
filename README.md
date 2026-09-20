# Travel Log

트리플처럼 여행 일정을 짜고 지도에서 동선을 보는 개인용 플래너. GitHub Pages + Firebase.

- 사이트: https://y1kk3love.github.io/Travel-Log/
- 데이터: Firebase 프로젝트 `travel-log-d6cc9` (Firestore + Google 로그인, 본인 계정만 허용)
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
