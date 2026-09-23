# 여행 플래너 설계 스펙

작성일: 2026-09-20

> **2026-09-23 현재 구현과 다른 점** (이 문서는 첫 설계 기록으로 둔다)
> - 사용자: 혼자 쓰는 앱에서 사이트 주인 + 초대한 동행이 함께 쓰는 앱으로 바뀜 (초대 목록, 여행마다 동행, 지출 정산)
> - 지도·검색: Leaflet·Nominatim 대신 Google Maps Platform (검색이 막히면 OpenStreetMap 으로 대체)
> - 사진: GitHub `photos/` 폴더 대신 Firestore 문서에 직접 저장
> - 안드로이드 앱(Capacitor), 예약(탑승권·키카드), 지출 탭이 더해짐
> - 최신 구조는 `README.md`, 데이터는 `docs/data-model.md`
디자인 목업: https://claude.ai/artifact/W9VUB6ZCs6ahqEx3Zhfz4k

## 1. 목적

트리플처럼 여행 전에 날짜별 일정을 짜고, 장소를 지도 위 동선으로 확인하고, 준비물과 예약 정보를 한곳에서 관리하는 개인용 웹 앱. 다녀온 뒤에는 각 장소에 메모와 사진을 붙여 기록으로 남긴다.

- 사용자: 본인 한 명. 다른 사람과 공유하지 않는다.
- 호스팅: GitHub Pages (`https://y1kk3love.github.io/Travel-Log/`).
- 데이터: Firebase (Firestore + Google 로그인).
- 비용: Firebase Spark(무료) 플랜 안에서만 동작. 카드 등록이 필요한 서비스는 쓰지 않는다.

## 2. 기능 요구사항

### 2.1 내 여행 목록 (홈)
- 로그인한 본인의 여행을 다가오는 여행 / 지난 여행으로 나눠 보여준다.
- 다가오는 여행은 D-day, 기간, Day 수, 장소 수, 체크리스트 완료율, 예약 수를 크게 보여준다.
- 새 여행 만들기: 제목, 시작일, 종료일 입력. 기간만큼 Day가 자동 생성된다.
- 여행 삭제는 확인 대화 후 하위 데이터(Day, 장소, 체크리스트, 예약)까지 함께 삭제한다.

### 2.2 일정 플래너
- 상단: 여행 제목, 기간, D-day, 탭(일정 / 체크리스트 / 예약).
- 왼쪽: Day 탭(Day n + 날짜). Day 추가/삭제 가능. Day 삭제 시 그 Day의 장소도 삭제된다.
- 선택한 Day의 장소를 순서대로 타임라인으로 보여준다. 각 항목: 순번, 시간, 분류 태그, 이름, 메모 첫 줄.
- 장소와 장소 사이에 직선 거리와 도보 예상 시간을 보여준다 (3km 초과 시 거리만).
- 장소 순서는 드래그로 바꾼다. 마우스와 터치 모두 지원.
- 오른쪽(모바일은 위): Leaflet 지도. 선택한 Day의 장소를 순번 핀으로 찍고 순서대로 점선으로 잇는다. "전체 일정" 토글로 모든 Day의 핀을 함께 본다.
- 핀 클릭 시 이름과 시간 말풍선. 타임라인 항목 클릭 시 지도가 그 핀으로 이동.

### 2.3 장소 추가·편집 시트
- 오른쪽에서 열리는 패널 (모바일은 전체 화면).
- 필드: 장소 검색(OpenStreetMap Nominatim, 결과 선택 시 이름·좌표 채움), 이름(직접 수정 가능), 시간(HH:MM), 머무는 시간(분), 분류(관광/식사/카페/쇼핑/숙소/이동/기타), 메모(여러 줄), 사진 파일명 목록.
- 사진: GitHub 저장소 `photos/<tripId>/` 폴더에 웹으로 올린 파일명을 적으면 `photos/<tripId>/<파일명>` 경로로 표시한다. 시트에서 썸네일로 보여주고, 없는 파일은 깨진 이미지 대신 파일명 텍스트로 표시한다.
- 삭제 버튼은 확인 후 삭제.

### 2.4 체크리스트
- 그룹(기본: 출발 전, 짐)별 항목. 그룹 추가/이름 변경/삭제, 항목 추가/수정/삭제/완료 토글.
- 전체 완료율 진행 막대.
- 새 여행을 만들 때 기본 항목 몇 개를 넣어 준다 (여권, 항공권, 숙소, 환전, 유심, 보조 배터리, 어댑터).

### 2.5 예약
- 종류: 항공, 숙소, 식당, 기타. 공통 필드: 제목, 일시, 예약번호, 메모. 종류별 추가 필드는 없다 (메모로 대신한다).
- 식당/기타 예약은 일정의 장소 하나와 연결할 수 있다. 연결된 장소 타임라인에는 "예약" 표시가 붙고, 예약 카드에서 그 장소로 이동할 수 있다.

### 2.6 로그인과 접근 제어
- Google 로그인(팝업). 로그인 전에는 로그인 버튼만 있는 화면.
- 허용된 계정(본인 UID) 외의 사용자가 로그인하면 "접근 권한이 없는 계정입니다" 화면과 로그아웃 버튼만 보여준다.
- Firestore 보안 규칙에서도 같은 UID만 읽기·쓰기를 허용한다. 화면 제어는 편의용이고 실제 보호는 규칙이 한다.

### 2.7 오프라인
- Firestore 로컬 캐시를 켜서, 인터넷이 없어도 마지막으로 본 일정을 볼 수 있고 편집은 연결되면 자동 반영된다.
- 지도 타일은 캐시하지 않는다 (오프라인에서는 회색 배경).

## 3. 범위 밖

- 여러 사용자, 공유 링크, 협업.
- 실제 경로 기반 이동 시간(대중교통·자동차). 직선 거리 추정만 한다.
- 앱 안에서의 사진 업로드 (Firebase Storage는 카드 등록 필요).
- 예산·지출 관리.
- Google Maps. 나중에 키가 생기면 `js/map.js`만 교체하면 되도록 지도 코드를 한 파일에 둔다.

## 4. 아키텍처

### 4.1 구성

```
브라우저 (GitHub Pages 정적 파일)
  ├─ Firebase Auth (Google 로그인)
  ├─ Firestore (일정 데이터, 오프라인 캐시)
  ├─ Leaflet + Carto 타일 (지도)
  └─ Nominatim (장소 검색, 키 없음)
사진: GitHub 저장소 photos/ 폴더 → GitHub Pages가 그대로 서빙
```

- 빌드 도구 없음. ES 모듈을 브라우저가 직접 로드한다.
- Firebase SDK(모듈형)는 gstatic CDN, Leaflet은 cdnjs에서 `<script type="module">`/`<link>`로 불러온다.
- 단일 페이지 앱. 해시 라우팅: `#/` 홈, `#/trip/{tripId}` 일정, `#/trip/{tripId}/checklist`, `#/trip/{tripId}/reservations`. GitHub Pages는 서버 라우팅이 없으므로 해시를 쓴다.

### 4.2 파일 구조

```
index.html                 앱 껍데기, CDN 로드, <main id="app">
css/main.css               디자인 토큰(색, 글꼴), 레이아웃, 컴포넌트 스타일
js/app.js                  진입점: 로그인 상태 감시 → 라우터 시작
js/router.js               해시 파싱, 뷰 전환
js/firebase-config.js      Firebase 웹 앱 설정값 + OWNER_UID (공개돼도 되는 값)
js/firebase.js             SDK 초기화, auth/db 내보내기, 오프라인 캐시 켜기
js/auth.js                 로그인/로그아웃, 현재 사용자, 허용 계정 판정
js/db.js                   Firestore 읽기·쓰기 함수 전부 (뷰는 이 파일만 호출)
js/views/trips.js          홈: 여행 목록, 새 여행 대화상자
js/views/planner.js        일정: Day 탭, 타임라인, 드래그 정렬, 지도 연동
js/views/place-sheet.js    장소 추가·편집 시트
js/views/checklist.js      체크리스트 탭
js/views/reservations.js   예약 탭
js/map.js                  Leaflet 초기화, 핀/동선 그리기 (지도 라이브러리 의존은 여기만)
js/geocode.js              Nominatim 검색 (디바운스 600ms, 초당 1회 제한)
js/lib/geo.js              하버사인 거리, 도보 시간 추정 (순수 함수)
js/lib/dates.js            날짜 범위 → Day 목록, D-day, 요일 표기 (순수 함수)
js/lib/order.js            순서 재배열 계산 (순수 함수)
js/ui.js                   토스트, 확인 대화상자, 요소 생성 헬퍼
photos/                    여행별 사진 폴더 (photos/<tripId>/)
firestore.rules            보안 규칙
tests/                     순수 함수 단위 테스트 (node --test)
docs/superpowers/specs/    이 문서
```

### 4.3 뷰 렌더링 방식

- 프레임워크 없이 DOM API로 렌더링한다. 각 뷰는 `render(container, params)`와 `destroy()`를 내보낸다.
- Firestore `onSnapshot`으로 구독하고, 변경이 오면 해당 뷰가 자기 영역을 다시 그린다. 드래그 중에는 재렌더를 보류한다.
- 뷰가 바뀌면 이전 뷰의 `destroy()`에서 구독을 해제한다.

## 5. 데이터 모델 (Firestore)

```
trips/{tripId}
  title: string
  startDate: "YYYY-MM-DD"
  endDate: "YYYY-MM-DD"
  coverPhoto: string | null       photos/<tripId>/ 안의 파일명
  createdAt: Timestamp

trips/{tripId}/days/{dayId}
  date: "YYYY-MM-DD"
  order: number                    0부터, Day 번호 = order + 1

trips/{tripId}/places/{placeId}
  dayId: string
  order: number                    Day 안에서의 순서
  name: string
  time: "HH:MM" | null
  stayMinutes: number | null
  category: "sight"|"food"|"cafe"|"shop"|"stay"|"move"|"etc"
  memo: string
  lat: number | null
  lng: number | null
  address: string | null           검색 결과의 표시 주소
  photos: string[]                 파일명 배열

trips/{tripId}/checklist/{itemId}
  group: string                    그룹 이름 (예: "출발 전")
  groupOrder: number
  order: number
  text: string
  done: boolean

trips/{tripId}/reservations/{resId}
  type: "flight"|"stay"|"food"|"etc"
  title: string
  datetime: "YYYY-MM-DDTHH:MM" | null
  code: string                     예약번호
  note: string
  linkedPlaceId: string | null
```

- 장소를 Day 하위가 아니라 여행 하위 컬렉션에 두고 `dayId`로 묶는다. "전체 일정" 지도와 Day 간 이동을 쿼리 한 번으로 처리하기 위해서다.
- 순서 변경은 영향받는 문서들의 `order`를 배치 쓰기로 갱신한다. 순서값은 0,1,2… 정수로 다시 매긴다.
- 여행 삭제는 하위 컬렉션 문서를 클라이언트에서 모두 조회해 배치로 지운다 (개인 데이터 규모라 충분하다).

## 6. 보안 규칙

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner() {
      return request.auth != null && request.auth.uid == "<OWNER_UID>";
    }
    match /trips/{tripId} {
      allow read, write: if isOwner();
      match /{sub=**} { allow read, write: if isOwner(); }
    }
  }
}
```

- `<OWNER_UID>`는 본인이 처음 로그인했을 때 Firebase 콘솔의 Authentication 사용자 목록에서 확인해 넣는다.
- 규칙은 Firebase 콘솔의 Rules 탭에 붙여 넣어 배포한다. 저장소의 `firestore.rules`가 원본이다.

## 7. 외부 서비스 사용 규칙

- Nominatim: 검색어 입력 후 600ms 디바운스, 요청 간 최소 1초 간격, `accept-language=ko`, 결과 5개. 사용 정책상 대량 요청 금지. 실패 시 "검색에 실패했어요. 잠시 후 다시 시도해 주세요" 토스트.
- Carto 타일: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`, 저작권 표기 "© OpenStreetMap contributors © CARTO".
- Firebase Auth 허용 도메인에 `y1kk3love.github.io`를 추가해야 GitHub Pages에서 팝업 로그인이 된다.

## 8. 오류 처리

- 로그인 팝업이 막히면 리디렉트 방식으로 다시 시도한다.
- Firestore 권한 오류(`permission-denied`)는 "접근 권한이 없는 계정입니다" 화면으로 보낸다.
- 네트워크 오류 중 쓰기는 Firestore가 큐에 쌓아 두므로 별도 처리 없이 상단에 "오프라인" 배지만 보여준다.
- 지도 타일 로드 실패는 무시한다 (Leaflet 기본 동작).

## 9. 테스트

- 순수 함수(`js/lib/*.js`)는 Node 내장 테스트 러너(`node --test tests/`)로 단위 테스트한다. 의존성 설치 없음.
  - geo: 두 좌표 거리, 도보 시간, 3km 초과 판정.
  - dates: 시작·종료일에서 Day 목록 생성, D-day 계산(오늘/과거/미래), 요일 한글 표기.
  - order: 항목을 i에서 j로 옮겼을 때의 새 order 배열.
- 보안 규칙: 본인 계정으로 읽기·쓰기 성공, 다른 Google 계정으로 로그인 시 화면과 규칙 모두 거부되는지 배포 후 수동 확인한다.
- 화면: GitHub Pages 배포 후 브라우저로 로그인 → 여행 생성 → 장소 추가 → 드래그 정렬 → 다른 탭에서 반영 → 체크리스트 토글 → 예약 연결까지 확인한다. 모바일 폭(390px)에서도 같은 흐름을 확인한다.

## 10. 배포

- `main` 브랜치 루트를 GitHub Pages 소스로 사용 (설정 완료됨).
- 모든 경로는 상대 경로로 써서 `/Travel-Log/` 하위에서 동작하게 한다.
- push 후 1~2분 안에 반영된다.

## 11. 구현 전 준비 (Firebase)

1. Firebase 콘솔에서 프로젝트 생성 (Google Analytics 끔).
2. Authentication → Sign-in method → Google 사용 설정.
3. Authentication → Settings → 승인된 도메인에 `y1kk3love.github.io` 추가.
4. Firestore Database 생성 (프로덕션 모드, 리전 `asia-northeast3` 서울).
5. 프로젝트 설정 → 웹 앱 추가 → `firebaseConfig` 값을 `js/firebase-config.js`에 넣기.
6. 한 번 로그인한 뒤 Authentication 사용자 목록에서 UID를 복사해 `OWNER_UID`와 `firestore.rules`에 넣고 규칙 배포.
