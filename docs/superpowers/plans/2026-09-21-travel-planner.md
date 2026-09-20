# 여행 플래너 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitHub Pages에 올리는 개인용 여행 플래너. 날짜별 장소 타임라인, 지도 동선, 체크리스트·예약을 Firebase에 저장하고 Google 로그인으로 본인만 쓴다.

**Architecture:** 빌드 도구 없는 정적 SPA. 브라우저가 ES 모듈을 직접 로드하고, Firebase 모듈형 SDK와 Leaflet은 CDN에서 가져온다. 해시 라우터가 뷰(`js/views/*.js`)를 갈아 끼우고, 모든 Firestore 접근은 `js/db.js` 한 파일을 거친다. 순수 계산(`js/lib/*.js`)은 Node 내장 테스트 러너로 단위 테스트한다.

**Tech Stack:** HTML/CSS/JS(ES2022, 프레임워크 없음), Firebase JS SDK 12.19.0 (Auth + Firestore, gstatic CDN), Leaflet 1.9.4 (cdnjs) + Carto Voyager 타일, Nominatim 검색 API, Node 22 LTS (`node --test`만 사용), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-20-travel-planner-design.md`

## Global Constraints

- 빌드 도구·번들러 없음. `npm install`로 런타임 의존성을 넣지 않는다. Node는 테스트와 로컬 정적 서버(`npx http-server`)에만 쓴다.
- Firebase Spark(무료) 플랜 안에서만 동작. Storage, Functions, Hosting을 쓰지 않는다.
- 모든 경로는 상대 경로(`js/app.js`, `photos/...`)로 써서 `https://y1kk3love.github.io/Travel-Log/` 하위에서 동작하게 한다. 절대 경로 `/js/...` 금지.
- CDN URL은 정확히 다음만 쓴다: Firebase `https://www.gstatic.com/firebasejs/12.19.0/firebase-{app,auth,firestore}.js`, Leaflet `https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.{js,css}`, Google Fonts `Gowun Batang` + `Noto Sans KR`.
- 화면 문구는 모두 한국어. 존댓말 "~해요"체 (예: "삭제했어요", "불러오지 못했어요").
- 디자인 토큰(색·글꼴)은 `css/main.css`의 `:root` 변수만 쓴다. 뷰 코드에 hex 색을 직접 쓰지 않는다 (Leaflet 폴리라인 색 `#B4502B` 한 곳만 예외).
- Firebase 프로젝트는 `travel-log-d6cc9` 하나. 새 프로젝트를 만들지 않는다.
- Nominatim: 요청 간 최소 1초, 입력 디바운스 600ms, `accept-language=ko`, `limit=5`.
- 커밋 메시지는 한국어 요약 + 끝에 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. 종료일이 시작일보다 빠른 여행 생성 → Day가 0개인 여행이 생기면 안 된다. `dayList`가 빈 배열을 돌려주고 대화상자가 토스트로 막아야 한다. (Task 2 테스트 + Task 7 검증)
2. 좌표 없는 장소(검색 없이 이름만 입력) → 타임라인엔 보이고, 지도 핀과 이동 구간 표시는 없어야 하며 오류가 나면 안 된다. (Task 3 `legLabel` null 테스트, Task 8 `hasCoords` 필터)
3. 드래그를 같은 자리에 놓았을 때 → Firestore 쓰기가 0건이어야 한다. (Task 4 `reorderUpdates` 빈 배열 테스트)
4. 오늘이 여행 기간 안이거나 지난 뒤 → D-day가 음수로 나오면 안 되고 "여행 중"/"지난 여행"으로 보여야 한다. (Task 2 `tripStatus` 테스트)
5. Nominatim이 빈 배열·비정상 JSON·HTTP 오류를 돌려줄 때 → 시트가 죽지 않고 토스트만 떠야 한다. (Task 10 `parseNominatim` 테스트 + try/catch)

---

## 파일 구조

```
package.json               "type":"module", test 스크립트
.gitignore                 node_modules
.claude/launch.json        로컬 정적 서버 (npx http-server 8080)
index.html                 앱 껍데기
css/main.css               토큰, 기본, 컴포넌트, 뷰 스타일 (뷰별 블록을 각 Task에서 추가)
js/app.js                  로그인 상태 감시 → 화면 분기 → 라우터
js/router.js               parseHash / navigate / startRouter
js/firebase-config.js      firebaseConfig + OWNER_UID
js/firebase.js             app/auth/db 초기화, 오프라인 캐시
js/auth.js                 signIn/signOut/watchAuth/isOwner
js/db.js                   Firestore 접근 함수 전부
js/ui.js                   el, clear, toast, confirmDialog, icon, escapeHtml, photoPath, CATEGORY_LABELS
js/map.js                  Leaflet 래퍼 createMap
js/geocode.js              parseNominatim, searchPlaces, debounce
js/lib/dates.js            날짜 순수 함수
js/lib/geo.js              거리·도보 시간 순수 함수
js/lib/order.js            순서 변경 순수 함수
js/views/topbar.js         상단 바 (워드마크, 오프라인 배지, 이메일, 로그아웃)
js/views/trips.js          홈: 여행 목록 + 새 여행 대화상자
js/views/trip.js           여행 셸: 헤더·탭, 하위 탭 마운트
js/views/planner.js        일정 탭: Day 탭, 타임라인, 드래그, 지도
js/views/place-sheet.js    장소 추가·편집 시트
js/views/checklist.js      체크리스트 탭
js/views/reservations.js   예약 탭
firestore.rules            보안 규칙 원본
photos/README.md           사진 폴더 사용법
tests/dates.test.js, geo.test.js, order.test.js, router.test.js, geocode.test.js
README.md                  사용법
```

---

### Task 0: Node 설치와 로컬 실행 환경

**Files:**
- Create: `package.json`, `.gitignore`, `.claude/launch.json`

**Interfaces:**
- Produces: `npm test` = `node --test tests/`; 로컬 서버 `http://localhost:8080/`

- [ ] **Step 1: Node LTS 설치 (시스템 변경이므로 사용자에게 먼저 확인)**

사용자에게 "Node.js LTS를 winget으로 설치해도 될까요?"라고 묻고 승인 후 실행:

```powershell
winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
```

- [ ] **Step 2: 새 셸에서 확인. PATH에 없으면 세션에 추가**

```powershell
$env:Path += ";C:\Program Files\nodejs"; node --version; npm --version
```
Expected: `v22.x.x` 와 `10.x.x`. (이후 모든 PowerShell 호출 앞에 같은 `$env:Path += ...`를 붙인다.)

- [ ] **Step 3: package.json, .gitignore 작성**

`package.json`:
```json
{
  "name": "travel-log",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/",
    "serve": "npx --yes http-server -p 8080 -c-1 ."
  }
}
```

`.gitignore`:
```
node_modules/
.DS_Store
```

- [ ] **Step 4: 브라우저 미리보기용 launch.json 작성**

`.claude/launch.json`:
```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "travel-log",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["--yes", "http-server", "-p", "8080", "-c-1", "."],
      "port": 8080
    }
  ]
}
```

- [ ] **Step 5: 테스트 러너가 도는지 확인 (테스트 파일 없음 → 통과)**

```powershell
$env:Path += ";C:\Program Files\nodejs"; mkdir tests -Force | Out-Null; npm test
```
Expected: `# pass 0` 와 종료 코드 0. (`tests/` 폴더가 비어 있으면 node가 에러를 낼 수 있다. 그 경우 `tests/.gitkeep`을 만들고 다시 실행.)

- [ ] **Step 6: 커밋**

```bash
git add package.json .gitignore .claude/launch.json tests/.gitkeep
git commit -m "chore: 테스트 러너와 로컬 서버 설정

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 1: 앱 껍데기와 디자인 토큰

**Files:**
- Create: `index.html`, `css/main.css`, `js/app.js`

**Interfaces:**
- Produces: `#app` 컨테이너, `#toast-root`, CSS 클래스 `.btn .btn-primary .btn-ghost .btn-danger .btn-sm .btn-icon .btn-dashed .field .input .card .topbar .wordmark .container .badge .tag .progress .muted .screen-center`, `<dialog>` 스타일, `.toast`

- [ ] **Step 1: index.html 작성**

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>여행 로그</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<link rel="stylesheet" href="css/main.css">
</head>
<body>
<div id="app"><div class="screen-center"><p class="muted">불러오는 중…</p></div></div>
<div id="toast-root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: css/main.css 작성 (토큰 + 기본 + 공용 컴포넌트)**

```css
:root {
  --paper: #F5F0E6; --card: #FFFDF9; --ink: #1E1A15; --muted: #5C544A;
  --line: #DDD3C2; --line-soft: #EDE6D8; --accent: #B4502B; --accent-ink: #FFFDF9;
  --danger: #A23B2A; --map: #DCE3DF;
  --serif: 'Gowun Batang', serif; --sans: 'Noto Sans KR', system-ui, sans-serif;
  --radius: 10px; --radius-lg: 14px;
}
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body { font-family: var(--sans); background: var(--paper); color: var(--ink); font-size: 15px; line-height: 1.5; }
a { color: inherit; text-decoration: none; }
button, input, select, textarea { font: inherit; color: inherit; }
h1, h2, h3 { font-family: var(--serif); margin: 0; font-weight: 700; }
p { margin: 0; }
code { font-family: ui-monospace, Consolas, monospace; font-size: 13px; background: var(--line-soft); padding: 2px 6px; border-radius: 6px; }
.muted { color: var(--muted); }
.screen-center { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 24px; text-align: center; }

.btn { height: 44px; padding: 0 18px; border: 1px solid var(--line); border-radius: var(--radius); background: transparent; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 500; white-space: nowrap; }
.btn:hover { border-color: var(--accent); color: var(--accent); }
.btn:disabled { opacity: .5; cursor: default; }
.btn-primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.btn-primary:hover { color: var(--accent-ink); filter: brightness(.95); }
.btn-ghost { border-color: transparent; color: var(--muted); }
.btn-danger { border-color: transparent; color: var(--danger); }
.btn-danger:hover { border-color: var(--danger); color: var(--danger); }
.btn-sm { height: 36px; padding: 0 12px; font-size: 13px; }
.btn-icon { width: 44px; height: 44px; padding: 0; border-color: transparent; }
.btn-dashed { border-style: dashed; color: var(--muted); width: 100%; }
.btn svg { width: 16px; height: 16px; flex-shrink: 0; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 12px; font-weight: 500; color: var(--muted); }
.input { height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); width: 100%; }
textarea.input { height: auto; min-height: 88px; padding: 10px 12px; resize: vertical; line-height: 1.6; }
.input:focus { outline: none; border-color: var(--accent); }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }

.card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-lg); }
.container { max-width: 1184px; margin: 0 auto; padding: 32px 24px; }
.badge { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px; background: var(--accent); color: var(--accent-ink); font-size: 11px; font-weight: 700; }
.badge-muted { background: var(--line-soft); color: var(--muted); }
.tag { font-size: 11px; padding: 1px 7px; border-radius: 999px; background: var(--line-soft); color: var(--muted); }
.progress { height: 6px; border-radius: 999px; background: var(--line-soft); overflow: hidden; }
.progress > div { height: 100%; background: var(--accent); }

.topbar { height: 64px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); background: var(--card); gap: 16px; }
.topbar-left, .topbar-right { display: flex; align-items: center; gap: 16px; min-width: 0; }
.wordmark { font-family: var(--serif); font-size: 22px; font-weight: 700; letter-spacing: -.5px; }
.topbar-email { font-size: 13px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
.offline-badge { font-size: 12px; padding: 3px 8px; border-radius: 6px; background: var(--line-soft); color: var(--muted); }
.offline-badge[hidden] { display: none; }

dialog { border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--card); color: var(--ink); padding: 24px; width: min(480px, calc(100vw - 32px)); }
dialog::backdrop { background: rgba(30, 26, 21, .35); }
dialog h2 { font-size: 22px; margin-bottom: 16px; }
.dialog-body { display: flex; flex-direction: column; gap: 14px; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }

#toast-root { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); display: flex; flex-direction: column; gap: 8px; z-index: 1000; pointer-events: none; }
.toast { background: var(--ink); color: var(--paper); padding: 10px 16px; border-radius: var(--radius); font-size: 14px; box-shadow: 0 6px 16px rgba(0, 0, 0, .2); }
.toast-error { background: var(--danger); }
```

- [ ] **Step 3: js/app.js 임시 진입점**

```js
const app = document.getElementById('app');
app.innerHTML = '<div class="screen-center"><h1>여행 로그</h1><p class="muted">껍데기만 있는 상태예요</p></div>';
```

- [ ] **Step 4: 로컬 서버로 확인**

`preview_start`로 `travel-log` 서버를 띄우고 `http://localhost:8080/` 열기.
Expected: 종이색 배경에 세리프 제목 "여행 로그", 콘솔 오류 없음 (Leaflet, 폰트 로드 확인).

- [ ] **Step 5: 커밋**

```bash
git add index.html css/main.css js/app.js
git commit -m "feat: 앱 껍데기와 디자인 토큰

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: 날짜 순수 함수 (`js/lib/dates.js`)

**Files:**
- Create: `js/lib/dates.js`, `tests/dates.test.js`

**Interfaces:**
- Produces:
  - `parseDate(str: 'YYYY-MM-DD') → Date` (로컬 자정)
  - `toDateStr(date: Date) → 'YYYY-MM-DD'`
  - `addDays(str, n) → str`
  - `diffDays(a, b) → number` (b − a, 일 단위 정수)
  - `dayList(start, end) → [{date, order}]` (end < start면 `[]`)
  - `weekdayKo(str) → '일'|'월'|…|'토'`
  - `formatShort(str) → '10.10 (토)'`
  - `formatRange(start, end) → '2026.10.10 – 10.14 · 4박 5일'`
  - `tripStatus(start, end, today) → {kind:'before'|'during'|'after', days}`
  - `formatStatus(status) → 'D-20'|'D-Day'|'여행 중'|'지난 여행'`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/dates.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, toDateStr, addDays, diffDays, dayList, weekdayKo, formatShort, formatRange, tripStatus, formatStatus } from '../js/lib/dates.js';

test('parseDate/toDateStr 왕복', () => {
  assert.equal(toDateStr(parseDate('2026-10-10')), '2026-10-10');
  assert.equal(parseDate('2026-10-10').getHours(), 0);
});

test('addDays와 diffDays', () => {
  assert.equal(addDays('2026-10-30', 3), '2026-11-02');
  assert.equal(diffDays('2026-10-10', '2026-10-14'), 4);
  assert.equal(diffDays('2026-10-14', '2026-10-10'), -4);
});

test('dayList는 시작~종료 날짜를 order와 함께 돌려준다', () => {
  assert.deepEqual(dayList('2026-10-10', '2026-10-12'), [
    { date: '2026-10-10', order: 0 },
    { date: '2026-10-11', order: 1 },
    { date: '2026-10-12', order: 2 },
  ]);
  assert.deepEqual(dayList('2026-10-10', '2026-10-10'), [{ date: '2026-10-10', order: 0 }]);
});

test('dayList는 종료일이 시작일보다 빠르면 빈 배열', () => {
  assert.deepEqual(dayList('2026-10-14', '2026-10-10'), []);
});

test('weekdayKo와 formatShort', () => {
  assert.equal(weekdayKo('2026-10-10'), '토');
  assert.equal(formatShort('2026-10-10'), '10.10 (토)');
});

test('formatRange', () => {
  assert.equal(formatRange('2026-10-10', '2026-10-14'), '2026.10.10 – 10.14 · 4박 5일');
  assert.equal(formatRange('2026-12-30', '2027-01-02'), '2026.12.30 – 2027.01.02 · 3박 4일');
});

test('tripStatus: 여행 전 / 여행 중 / 지난 여행', () => {
  assert.deepEqual(tripStatus('2026-10-10', '2026-10-14', '2026-09-20'), { kind: 'before', days: 20 });
  assert.deepEqual(tripStatus('2026-10-10', '2026-10-14', '2026-10-10'), { kind: 'during', days: 0 });
  assert.deepEqual(tripStatus('2026-10-10', '2026-10-14', '2026-10-12'), { kind: 'during', days: 2 });
  assert.deepEqual(tripStatus('2026-10-10', '2026-10-14', '2026-10-20'), { kind: 'after', days: 6 });
});

test('formatStatus', () => {
  assert.equal(formatStatus({ kind: 'before', days: 20 }), 'D-20');
  assert.equal(formatStatus({ kind: 'during', days: 0 }), 'D-Day');
  assert.equal(formatStatus({ kind: 'during', days: 2 }), '여행 중');
  assert.equal(formatStatus({ kind: 'after', days: 6 }), '지난 여행');
});
```

- [ ] **Step 2: 실패 확인**

```powershell
$env:Path += ";C:\Program Files\nodejs"; node --test tests/dates.test.js
```
Expected: `Cannot find module '.../js/lib/dates.js'` 로 실패.

- [ ] **Step 3: 구현**

`js/lib/dates.js`:
```js
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n) => String(n).padStart(2, '0');

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDateStr(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(str, n) {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function diffDays(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

export function dayList(start, end) {
  const n = diffDays(start, end);
  if (Number.isNaN(n) || n < 0) return [];
  return Array.from({ length: n + 1 }, (_, i) => ({ date: addDays(start, i), order: i }));
}

export function weekdayKo(str) {
  return WEEKDAYS[parseDate(str).getDay()];
}

export function formatShort(str) {
  const d = parseDate(str);
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${weekdayKo(str)})`;
}

export function formatRange(start, end) {
  const s = parseDate(start);
  const e = parseDate(end);
  const nights = diffDays(start, end);
  const sStr = `${s.getFullYear()}.${pad(s.getMonth() + 1)}.${pad(s.getDate())}`;
  const eStr = s.getFullYear() === e.getFullYear()
    ? `${pad(e.getMonth() + 1)}.${pad(e.getDate())}`
    : `${e.getFullYear()}.${pad(e.getMonth() + 1)}.${pad(e.getDate())}`;
  return `${sStr} – ${eStr} · ${nights}박 ${nights + 1}일`;
}

export function tripStatus(start, end, today) {
  const toStart = diffDays(today, start);
  if (toStart > 0) return { kind: 'before', days: toStart };
  if (diffDays(today, end) >= 0) return { kind: 'during', days: -toStart };
  return { kind: 'after', days: -diffDays(today, end) };
}

export function formatStatus(status) {
  if (status.kind === 'before') return `D-${status.days}`;
  if (status.kind === 'during') return status.days === 0 ? 'D-Day' : '여행 중';
  return '지난 여행';
}
```

- [ ] **Step 4: 통과 확인**

```powershell
$env:Path += ";C:\Program Files\nodejs"; node --test tests/dates.test.js
```
Expected: `# pass 8`, `# fail 0`.

- [ ] **Step 5: 커밋**

```bash
git add js/lib/dates.js tests/dates.test.js
git commit -m "feat: 날짜 계산 순수 함수

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: 거리·도보 시간 순수 함수 (`js/lib/geo.js`)

**Files:**
- Create: `js/lib/geo.js`, `tests/geo.test.js`

**Interfaces:**
- Produces:
  - `hasCoords(p) → boolean` (`p.lat`, `p.lng`가 number)
  - `distanceKm(a, b) → number` (하버사인)
  - `walkMinutes(km) → number` (시속 4.5km, 올림, 최소 1)
  - `legLabel(a, b) → string | null` (좌표 없으면 null, 3km 이하 `도보 N분 · X.Xkm`, 초과 `거리 X.Xkm`)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/geo.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasCoords, distanceKm, walkMinutes, legLabel } from '../js/lib/geo.js';

test('hasCoords', () => {
  assert.equal(hasCoords({ lat: 35, lng: 135 }), true);
  assert.equal(hasCoords({ lat: null, lng: null }), false);
  assert.equal(hasCoords({}), false);
  assert.equal(hasCoords(null), false);
});

test('distanceKm: 같은 점은 0, 후시미이나리→기요미즈데라는 약 3.3km', () => {
  assert.equal(distanceKm({ lat: 35, lng: 135 }, { lat: 35, lng: 135 }), 0);
  const d = distanceKm({ lat: 34.9671, lng: 135.7727 }, { lat: 34.9949, lng: 135.7850 });
  assert.ok(d > 3.2 && d < 3.4, `got ${d}`);
});

test('walkMinutes: 4.5km/h 기준 올림, 최소 1분', () => {
  assert.equal(walkMinutes(1.1), 15);
  assert.equal(walkMinutes(0), 1);
});

test('legLabel: 3km 이하는 도보, 초과는 거리만, 좌표 없으면 null', () => {
  assert.equal(legLabel({ lat: 35, lng: 135 }, { lat: 35.009, lng: 135 }), '도보 14분 · 1.0km');
  assert.equal(legLabel({ lat: 35, lng: 135 }, { lat: 35.05, lng: 135 }), '거리 5.6km');
  assert.equal(legLabel({ lat: 35, lng: 135 }, { lat: null, lng: null }), null);
  assert.equal(legLabel({ name: '이름만' }, { lat: 35, lng: 135 }), null);
});
```

- [ ] **Step 2: 실패 확인**

```powershell
$env:Path += ";C:\Program Files\nodejs"; node --test tests/geo.test.js
```
Expected: 모듈 없음으로 실패.

- [ ] **Step 3: 구현**

`js/lib/geo.js`:
```js
const EARTH_RADIUS_KM = 6371;
const WALK_KMH = 4.5;
const WALK_LIMIT_KM = 3;

export function hasCoords(p) {
  return p != null && typeof p.lat === 'number' && typeof p.lng === 'number'
    && Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

export function distanceKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function walkMinutes(km) {
  return Math.max(1, Math.ceil((km / WALK_KMH) * 60));
}

export function legLabel(a, b) {
  if (!hasCoords(a) || !hasCoords(b)) return null;
  const km = distanceKm(a, b);
  if (km <= WALK_LIMIT_KM) return `도보 ${walkMinutes(km)}분 · ${km.toFixed(1)}km`;
  return `거리 ${km.toFixed(1)}km`;
}
```

- [ ] **Step 4: 통과 확인**

```powershell
$env:Path += ";C:\Program Files\nodejs"; node --test tests/geo.test.js
```
Expected: `# pass 4`.

- [ ] **Step 5: 커밋**

```bash
git add js/lib/geo.js tests/geo.test.js
git commit -m "feat: 거리와 도보 시간 계산

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: 순서 변경 순수 함수 (`js/lib/order.js`)

**Files:**
- Create: `js/lib/order.js`, `tests/order.test.js`

**Interfaces:**
- Produces:
  - `moveItem(list, from, to) → 새 배열` (범위 밖·같은 자리면 복사본 그대로)
  - `reorderUpdates(items: [{id, order}], from, to) → [{id, order}]` (order가 바뀐 항목만)
  - `nextOrder(items) → number` (max+1, 비어 있으면 0)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/order.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveItem, reorderUpdates, nextOrder } from '../js/lib/order.js';

test('moveItem: 앞→뒤, 뒤→앞, 원본 불변', () => {
  const list = ['a', 'b', 'c', 'd'];
  assert.deepEqual(moveItem(list, 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveItem(list, 3, 1), ['a', 'd', 'b', 'c']);
  assert.deepEqual(list, ['a', 'b', 'c', 'd']);
});

test('moveItem: 같은 자리나 범위 밖이면 그대로', () => {
  assert.deepEqual(moveItem(['a', 'b'], 1, 1), ['a', 'b']);
  assert.deepEqual(moveItem(['a', 'b'], 0, 5), ['a', 'b']);
});

test('reorderUpdates: 바뀐 항목만 새 order로', () => {
  const items = [{ id: 'p1', order: 0 }, { id: 'p2', order: 1 }, { id: 'p3', order: 2 }, { id: 'p4', order: 3 }];
  assert.deepEqual(reorderUpdates(items, 2, 0), [{ id: 'p3', order: 0 }, { id: 'p1', order: 1 }, { id: 'p2', order: 2 }]);
});

test('reorderUpdates: 같은 자리면 빈 배열', () => {
  const items = [{ id: 'p1', order: 0 }, { id: 'p2', order: 1 }];
  assert.deepEqual(reorderUpdates(items, 1, 1), []);
});

test('reorderUpdates: 기존 order에 구멍이 있으면 0부터 다시 매긴다', () => {
  const items = [{ id: 'p1', order: 0 }, { id: 'p2', order: 5 }];
  assert.deepEqual(reorderUpdates(items, 0, 0), [{ id: 'p2', order: 1 }]);
});

test('nextOrder', () => {
  assert.equal(nextOrder([]), 0);
  assert.equal(nextOrder([{ order: 0 }, { order: 4 }]), 5);
});
```

- [ ] **Step 2: 실패 확인**

```powershell
$env:Path += ";C:\Program Files\nodejs"; node --test tests/order.test.js
```
Expected: 모듈 없음으로 실패.

- [ ] **Step 3: 구현**

`js/lib/order.js`:
```js
export function moveItem(list, from, to) {
  const next = list.slice();
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function reorderUpdates(items, from, to) {
  const moved = moveItem(items, from, to);
  return moved
    .map((item, index) => ({ id: item.id, order: index }))
    .filter((u) => items.find((item) => item.id === u.id).order !== u.order);
}

export function nextOrder(items) {
  if (!items.length) return 0;
  return Math.max(...items.map((item) => item.order)) + 1;
}
```

- [ ] **Step 4: 통과 확인**

```powershell
$env:Path += ";C:\Program Files\nodejs"; node --test tests/order.test.js
```
Expected: `# pass 6`.

- [ ] **Step 5: 커밋**

```bash
git add js/lib/order.js tests/order.test.js
git commit -m "feat: 순서 변경 계산

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Firebase 초기화, 로그인 화면, 접근 제어, 보안 규칙

**Files:**
- Create: `js/firebase-config.js`, `js/firebase.js`, `js/auth.js`, `js/ui.js`, `firestore.rules`
- Modify: `js/app.js` (전체 교체), `css/main.css` (끝에 추가)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `firebase.js`: `export const app, auth, db`
  - `firebase-config.js`: `export const firebaseConfig`, `export const OWNER_UID`
  - `auth.js`: `watchAuth(cb(user|null)) → unsubscribe`, `signIn() → Promise`, `signOut() → Promise`, `isOwner(user) → boolean`
  - `ui.js`: `el(tag, attrs, ...children)`, `clear(node)`, `toast(msg, {kind:'info'|'error'})`, `confirmDialog(message, {okText, cancelText}) → Promise<boolean>`, `icon(name)` (`plus close drag search back trash edit more check expand pin calendar`), `escapeHtml(str)`, `photoPath(tripId, filename)`, `CATEGORY_LABELS`, `CATEGORY_ORDER`

- [ ] **Step 1: firebase-config.js (콘솔에서 받은 값. 공개돼도 되는 값)**

```js
export const firebaseConfig = {
  apiKey: 'AIzaSyAMtvkiVR3TNvzGlCmDIQxdmytKr4N8j5o',
  authDomain: 'travel-log-d6cc9.firebaseapp.com',
  projectId: 'travel-log-d6cc9',
  storageBucket: 'travel-log-d6cc9.firebasestorage.app',
  messagingSenderId: '660409033949',
  appId: '1:660409033949:web:289773cbe56ee64b256734',
};

// 첫 로그인 후 "접근 권한 없음" 화면에 표시되는 UID를 여기에 넣는다.
export const OWNER_UID = '';
```

- [ ] **Step 2: firebase.js**

```js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
```

- [ ] **Step 3: auth.js**

```js
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut as firebaseSignOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { auth } from './firebase.js';
import { OWNER_UID } from './firebase-config.js';

export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function signIn() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw err;
  }
}

export function signOut() {
  return firebaseSignOut(auth);
}

export function isOwner(user) {
  return !!user && OWNER_UID !== '' && user.uid === OWNER_UID;
}
```

- [ ] **Step 4: ui.js**

```js
const ICONS = {
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  close: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  drag: '<circle cx="9" cy="6" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.6" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.6" fill="currentColor" stroke="none"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>',
  back: '<polyline points="15 5 8 12 15 19"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  more: '<circle cx="5" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="2" fill="currentColor" stroke="none"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  expand: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
};

export const CATEGORY_LABELS = { sight: '관광', food: '식사', cafe: '카페', shop: '쇼핑', stay: '숙소', move: '이동', etc: '기타' };
export const CATEGORY_ORDER = ['sight', 'food', 'cafe', 'shop', 'stay', 'move', 'etc'];

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name] || '';
  return svg;
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function photoPath(tripId, filename) {
  return `photos/${encodeURIComponent(tripId)}/${encodeURIComponent(filename)}`;
}

export function toast(message, { kind = 'info', ms = 2800 } = {}) {
  const root = document.getElementById('toast-root');
  const node = el('div', { class: `toast${kind === 'error' ? ' toast-error' : ''}`, text: message });
  root.append(node);
  setTimeout(() => node.remove(), ms);
}

export function confirmDialog(message, { okText = '삭제', cancelText = '취소' } = {}) {
  return new Promise((resolve) => {
    const dialog = el('dialog', {},
      el('p', { text: message }),
      el('div', { class: 'dialog-actions' },
        el('button', { type: 'button', class: 'btn', onClick: () => dialog.close('cancel') }, cancelText),
        el('button', { type: 'button', class: 'btn btn-primary', onClick: () => dialog.close('ok') }, okText)));
    dialog.addEventListener('close', () => { resolve(dialog.returnValue === 'ok'); dialog.remove(); });
    document.body.append(dialog);
    dialog.showModal();
  });
}
```

- [ ] **Step 5: app.js 교체 (로그인 / 접근 없음 / 앱 분기)**

```js
import { watchAuth, signIn, signOut, isOwner } from './auth.js';
import { el, clear, toast } from './ui.js';

const app = document.getElementById('app');

function renderLogin() {
  clear(app);
  app.append(el('div', { class: 'screen-center' },
    el('h1', { text: '여행 로그' }),
    el('p', { class: 'muted', text: '본인 Google 계정으로 로그인하면 일정을 볼 수 있어요' }),
    el('button', {
      class: 'btn btn-primary',
      onClick: () => signIn().catch((err) => { console.error(err); toast('로그인에 실패했어요', { kind: 'error' }); }),
    }, 'Google로 로그인')));
}

function renderNoAccess(user) {
  clear(app);
  app.append(el('div', { class: 'screen-center' },
    el('h1', { text: '접근 권한이 없는 계정이에요' }),
    el('p', { class: 'muted', text: `${user.email} 계정은 이 여행 로그의 주인으로 등록되어 있지 않아요.` }),
    el('p', {}, '내 UID: ', el('code', { text: user.uid })),
    el('p', { class: 'muted', text: '이 계정이 본인 계정이라면 위 UID를 js/firebase-config.js의 OWNER_UID와 firestore.rules에 넣으세요.' }),
    el('button', { class: 'btn', onClick: () => signOut() }, '로그아웃')));
}

function renderApp(user) {
  clear(app);
  app.append(el('div', { class: 'screen-center' },
    el('h1', { text: '로그인 완료' }),
    el('p', { class: 'muted', text: `${user.email} · 여행 목록은 다음 단계에서 붙어요` }),
    el('button', { class: 'btn', onClick: () => signOut() }, '로그아웃')));
}

watchAuth((user) => {
  if (!user) return renderLogin();
  if (!isOwner(user)) return renderNoAccess(user);
  renderApp(user);
});
```

- [ ] **Step 6: firestore.rules 작성**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner() {
      return request.auth != null && request.auth.uid == "OWNER_UID_HERE";
    }
    match /trips/{tripId} {
      allow read, write: if isOwner();
      match /{sub=**} {
        allow read, write: if isOwner();
      }
    }
  }
}
```

- [ ] **Step 7: 로컬에서 로그인해 UID 얻기**

`http://localhost:8080/` 열기 → "Google로 로그인" 클릭 → 팝업에서 본인 계정 선택 (팝업 로그인은 사용자가 직접 한다).
Expected: "접근 권한이 없는 계정이에요" 화면과 UID 표시. UID를 복사한다.

- [ ] **Step 8: OWNER_UID 채우기와 규칙 배포**

1. `js/firebase-config.js`의 `OWNER_UID = ''`에 UID 넣기.
2. `firestore.rules`의 `OWNER_UID_HERE`를 같은 UID로 바꾸기.
3. Firebase 콘솔 `https://console.firebase.google.com/project/travel-log-d6cc9/firestore/rules` 에서 편집기 내용을 `firestore.rules`로 교체하고 "게시".
4. 페이지 새로고침.
Expected: "로그인 완료" 화면.

- [ ] **Step 9: 로그아웃 → 다시 로그인 화면이 나오는지 확인 후 커밋**

```bash
git add js/firebase-config.js js/firebase.js js/auth.js js/ui.js js/app.js firestore.rules
git commit -m "feat: Firebase 초기화, Google 로그인, 소유자 접근 제어

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Firestore 접근 계층 (`js/db.js`)

**Files:**
- Create: `js/db.js`

**Interfaces:**
- Consumes: `dayList, addDays, toDateStr` (Task 2), `nextOrder` (Task 4), `db` (Task 5)
- Produces (모두 `js/db.js`에서 export):
  - `watchTrips(cb(trips[]), onError) → unsub` (startDate 내림차순)
  - `watchTrip(tripId, cb(trip|null), onError) → unsub`
  - `createTrip({title, startDate, endDate}) → Promise<tripId>` (Day와 기본 체크리스트 생성)
  - `updateTrip(tripId, data)`, `deleteTrip(tripId)` (하위 전부 삭제)
  - `tripStats(tripId) → Promise<{days, places, checklistTotal, checklistDone, reservations} | null>`
  - `watchDays(tripId, cb(days[]))`, `addDay(tripId)`, `deleteDay(tripId, dayId)`
  - `watchPlaces(tripId, cb(places[]))` (order 오름차순, 모든 Day), `addPlace(tripId, data) → id`, `updatePlace(tripId, id, data)`, `deletePlace(tripId, id)`, `reorderPlaces(tripId, updates)`
  - `watchChecklist(tripId, cb(items[]))`, `addChecklistItem(tripId, {group, groupOrder, text})`, `updateChecklistItem(tripId, id, data)`, `deleteChecklistItem(tripId, id)`, `renameChecklistGroup(tripId, from, to)`, `deleteChecklistGroup(tripId, group)`
  - `watchReservations(tripId, cb(items[]))`, `addReservation(tripId, data)`, `updateReservation(tripId, id, data)`, `deleteReservation(tripId, id)`
  - `DEFAULT_CHECKLIST`
  - 모든 문서 객체는 `{ id, ...data }` 형태.

- [ ] **Step 1: db.js 작성**

```js
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where, orderBy,
  onSnapshot, writeBatch, serverTimestamp, getCountFromServer,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { db } from './firebase.js';
import { dayList, addDays, toDateStr } from './lib/dates.js';
import { nextOrder } from './lib/order.js';

export const DEFAULT_CHECKLIST = [
  { group: '출발 전', items: ['여권 유효기간 확인', '항공권 예약', '숙소 예약', '환전 · 트래블 카드 충전', '유심 / 이심 구매'] },
  { group: '짐', items: ['보조 배터리', '돼지코 어댑터', '상비약'] },
];

const tripsCol = () => collection(db, 'trips');
const tripDoc = (tripId) => doc(db, 'trips', tripId);
const sub = (tripId, name) => collection(db, 'trips', tripId, name);
const docsOf = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const byOrder = (a, b) => a.order - b.order;
const logError = (err) => console.error('[db]', err);

// ---------- trips ----------
export function watchTrips(cb, onError = logError) {
  return onSnapshot(query(tripsCol(), orderBy('startDate', 'desc')), (s) => cb(docsOf(s)), onError);
}

export function watchTrip(tripId, cb, onError = logError) {
  return onSnapshot(tripDoc(tripId), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null), onError);
}

export async function createTrip({ title, startDate, endDate }) {
  const days = dayList(startDate, endDate);
  if (!title.trim() || days.length === 0) throw new Error('invalid-trip');
  const ref = doc(tripsCol());
  const batch = writeBatch(db);
  batch.set(ref, { title: title.trim(), startDate, endDate, coverPhoto: null, createdAt: serverTimestamp() });
  for (const day of days) batch.set(doc(sub(ref.id, 'days')), day);
  DEFAULT_CHECKLIST.forEach((g, groupOrder) => g.items.forEach((text, order) => {
    batch.set(doc(sub(ref.id, 'checklist')), { group: g.group, groupOrder, order, text, done: false });
  }));
  await batch.commit();
  return ref.id;
}

export function updateTrip(tripId, data) {
  return updateDoc(tripDoc(tripId), data);
}

export async function deleteTrip(tripId) {
  const batch = writeBatch(db);
  for (const name of ['days', 'places', 'checklist', 'reservations']) {
    const snap = await getDocs(sub(tripId, name));
    snap.docs.forEach((d) => batch.delete(d.ref));
  }
  batch.delete(tripDoc(tripId));
  await batch.commit();
}

export async function tripStats(tripId) {
  try {
    const [days, places, total, done, reservations] = await Promise.all([
      getCountFromServer(sub(tripId, 'days')),
      getCountFromServer(sub(tripId, 'places')),
      getCountFromServer(sub(tripId, 'checklist')),
      getCountFromServer(query(sub(tripId, 'checklist'), where('done', '==', true))),
      getCountFromServer(sub(tripId, 'reservations')),
    ]);
    return {
      days: days.data().count, places: places.data().count,
      checklistTotal: total.data().count, checklistDone: done.data().count,
      reservations: reservations.data().count,
    };
  } catch (err) {
    logError(err);
    return null;
  }
}

// ---------- days ----------
export function watchDays(tripId, cb, onError = logError) {
  return onSnapshot(query(sub(tripId, 'days'), orderBy('order')), (s) => cb(docsOf(s)), onError);
}

export async function addDay(tripId) {
  const days = docsOf(await getDocs(query(sub(tripId, 'days'), orderBy('order'))));
  const last = days[days.length - 1];
  const date = last ? addDays(last.date, 1) : toDateStr(new Date());
  const batch = writeBatch(db);
  batch.set(doc(sub(tripId, 'days')), { date, order: days.length });
  batch.update(tripDoc(tripId), { endDate: date });
  await batch.commit();
}

// Day를 지우면 그 날 장소도 지우고, 남은 Day는 첫 날부터 이어지는 날짜로 다시 매긴다.
export async function deleteDay(tripId, dayId) {
  const [daysSnap, placesSnap] = await Promise.all([
    getDocs(query(sub(tripId, 'days'), orderBy('order'))),
    getDocs(query(sub(tripId, 'places'), where('dayId', '==', dayId))),
  ]);
  const remaining = docsOf(daysSnap).filter((d) => d.id !== dayId);
  if (remaining.length === 0) throw new Error('last-day');
  const batch = writeBatch(db);
  placesSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(sub(tripId, 'days'), dayId));
  const first = remaining[0].date;
  remaining.forEach((d, i) => {
    const date = addDays(first, i);
    if (d.order !== i || d.date !== date) batch.update(doc(sub(tripId, 'days'), d.id), { order: i, date });
  });
  batch.update(tripDoc(tripId), { startDate: first, endDate: addDays(first, remaining.length - 1) });
  await batch.commit();
}

// ---------- places ----------
export function watchPlaces(tripId, cb, onError = logError) {
  return onSnapshot(sub(tripId, 'places'), (s) => cb(docsOf(s).sort(byOrder)), onError);
}

export async function addPlace(tripId, data) {
  const sameDay = docsOf(await getDocs(query(sub(tripId, 'places'), where('dayId', '==', data.dayId))));
  const ref = await addDoc(sub(tripId, 'places'), {
    name: '', time: null, stayMinutes: null, category: 'sight', memo: '',
    lat: null, lng: null, address: null, photos: [],
    ...data, order: nextOrder(sameDay),
  });
  return ref.id;
}

export function updatePlace(tripId, placeId, data) {
  return updateDoc(doc(sub(tripId, 'places'), placeId), data);
}

export function deletePlace(tripId, placeId) {
  return deleteDoc(doc(sub(tripId, 'places'), placeId));
}

export async function reorderPlaces(tripId, updates) {
  if (!updates.length) return;
  const batch = writeBatch(db);
  updates.forEach((u) => batch.update(doc(sub(tripId, 'places'), u.id), { order: u.order }));
  await batch.commit();
}

// ---------- checklist ----------
export function watchChecklist(tripId, cb, onError = logError) {
  return onSnapshot(sub(tripId, 'checklist'), (s) => cb(docsOf(s)), onError);
}

export async function addChecklistItem(tripId, { group, groupOrder, text }) {
  const inGroup = docsOf(await getDocs(query(sub(tripId, 'checklist'), where('group', '==', group))));
  const ref = await addDoc(sub(tripId, 'checklist'), { group, groupOrder, order: nextOrder(inGroup), text, done: false });
  return ref.id;
}

export function updateChecklistItem(tripId, itemId, data) {
  return updateDoc(doc(sub(tripId, 'checklist'), itemId), data);
}

export function deleteChecklistItem(tripId, itemId) {
  return deleteDoc(doc(sub(tripId, 'checklist'), itemId));
}

export async function renameChecklistGroup(tripId, from, to) {
  const snap = await getDocs(query(sub(tripId, 'checklist'), where('group', '==', from)));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { group: to }));
  await batch.commit();
}

export async function deleteChecklistGroup(tripId, group) {
  const snap = await getDocs(query(sub(tripId, 'checklist'), where('group', '==', group)));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ---------- reservations ----------
export function watchReservations(tripId, cb, onError = logError) {
  return onSnapshot(sub(tripId, 'reservations'), (s) => cb(docsOf(s)), onError);
}

export async function addReservation(tripId, data) {
  const ref = await addDoc(sub(tripId, 'reservations'), {
    type: 'etc', title: '', datetime: null, code: '', note: '', linkedPlaceId: null, ...data,
  });
  return ref.id;
}

export function updateReservation(tripId, id, data) {
  return updateDoc(doc(sub(tripId, 'reservations'), id), data);
}

export function deleteReservation(tripId, id) {
  return deleteDoc(doc(sub(tripId, 'reservations'), id));
}
```

- [ ] **Step 2: 브라우저 콘솔에서 스모크 테스트**

로컬 서버에서 로그인한 뒤 브라우저 콘솔(또는 `javascript_tool`)에서:
```js
const db = await import('./js/db.js');
const id = await db.createTrip({ title: '테스트', startDate: '2026-10-10', endDate: '2026-10-12' });
const pid = await db.addPlace(id, { dayId: 'x', name: '임시' });
await db.deleteTrip(id);
console.log('ok', id, pid);
```
Expected: `ok <id> <pid>` 출력, Firebase 콘솔 Firestore 데이터에서 `trips`가 비어 있음 (생성 후 삭제됨). 권한 오류(`permission-denied`)가 나면 Task 5 Step 8 규칙 배포를 다시 확인.

- [ ] **Step 3: 커밋**

```bash
git add js/db.js
git commit -m "feat: Firestore 접근 계층

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: 라우터, 상단 바, 여행 목록(홈)

**Files:**
- Create: `js/router.js`, `tests/router.test.js`, `js/views/topbar.js`, `js/views/trips.js`, `js/views/trip.js` (임시)
- Modify: `js/app.js`, `css/main.css` (끝에 추가)

**Interfaces:**
- Consumes: `db.watchTrips/createTrip/deleteTrip/tripStats`, `dates.*`, `ui.*`, `auth.signOut`
- Produces:
  - `router.js`: `parseHash(hash) → {name:'trips'} | {name:'trip', tripId, tab}`, `navigate(path)`, `startRouter(views, container) → stop()`; 뷰 계약은 `render(container, route) → cleanup | undefined`
  - `topbar.js`: `topbar({ backHref = null } = {}) → HTMLElement`
  - `trips.js`: `render(container)`
  - `trip.js`(임시): `render(container, route)` — Task 9에서 완성

- [ ] **Step 1: parseHash 테스트 작성**

`tests/router.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHash } from '../js/router.js';

test('빈 해시와 #/ 는 trips', () => {
  assert.deepEqual(parseHash(''), { name: 'trips' });
  assert.deepEqual(parseHash('#/'), { name: 'trips' });
  assert.deepEqual(parseHash('#/unknown'), { name: 'trips' });
});

test('trip 경로와 탭', () => {
  assert.deepEqual(parseHash('#/trip/abc'), { name: 'trip', tripId: 'abc', tab: 'planner' });
  assert.deepEqual(parseHash('#/trip/abc/checklist'), { name: 'trip', tripId: 'abc', tab: 'checklist' });
  assert.deepEqual(parseHash('#/trip/abc/reservations'), { name: 'trip', tripId: 'abc', tab: 'reservations' });
  assert.deepEqual(parseHash('#/trip/abc/bogus'), { name: 'trip', tripId: 'abc', tab: 'planner' });
});
```

- [ ] **Step 2: 실패 확인**

```powershell
$env:Path += ";C:\Program Files\nodejs"; node --test tests/router.test.js
```
Expected: 모듈 없음으로 실패.

- [ ] **Step 3: router.js 작성 (import 시점에 window를 건드리지 않는다)**

```js
const TABS = ['planner', 'checklist', 'reservations'];

export function parseHash(hash) {
  const parts = String(hash || '').replace(/^#/, '').split('/').filter(Boolean);
  if (parts[0] === 'trip' && parts[1]) {
    return { name: 'trip', tripId: parts[1], tab: TABS.includes(parts[2]) ? parts[2] : 'planner' };
  }
  return { name: 'trips' };
}

export function navigate(path) {
  window.location.hash = path.startsWith('#') ? path : `#${path}`;
}

export function startRouter(views, container) {
  let cleanup = null;
  const run = () => {
    if (cleanup) cleanup();
    cleanup = null;
    while (container.firstChild) container.removeChild(container.firstChild);
    const route = parseHash(window.location.hash);
    window.scrollTo(0, 0);
    cleanup = views[route.name].render(container, route) || null;
  };
  window.addEventListener('hashchange', run);
  run();
  return () => {
    window.removeEventListener('hashchange', run);
    if (cleanup) cleanup();
  };
}
```

- [ ] **Step 4: 통과 확인**

```powershell
$env:Path += ";C:\Program Files\nodejs"; node --test tests/router.test.js
```
Expected: `# pass 2`.

- [ ] **Step 5: topbar.js**

```js
import { el } from '../ui.js';
import { auth } from '../firebase.js';
import { signOut } from '../auth.js';

export function topbar({ backHref = null } = {}) {
  const offline = el('span', { class: 'offline-badge', text: '오프라인', hidden: navigator.onLine });
  const setOnline = () => { offline.hidden = navigator.onLine; };
  window.addEventListener('online', setOnline);
  window.addEventListener('offline', setOnline);
  return el('header', { class: 'topbar' },
    el('div', { class: 'topbar-left' },
      el('a', { href: '#/', class: 'wordmark', text: '여행 로그' }),
      backHref && el('a', { href: backHref, class: 'muted', text: '← 내 여행' })),
    el('div', { class: 'topbar-right' },
      offline,
      el('span', { class: 'topbar-email', text: auth.currentUser?.email ?? '' }),
      el('button', { class: 'btn btn-sm btn-ghost', onClick: () => signOut() }, '로그아웃')));
}
```

- [ ] **Step 6: trips.js (홈)**

```js
import { el, clear, toast, confirmDialog, icon, photoPath } from '../ui.js';
import { topbar } from './topbar.js';
import { watchTrips, createTrip, deleteTrip, tripStats } from '../db.js';
import { tripStatus, formatStatus, formatRange, toDateStr, dayList } from '../lib/dates.js';
import { navigate } from '../router.js';

export function render(container) {
  const main = el('main', { class: 'container trips-page' });
  container.append(topbar(), main);
  const unsub = watchTrips(
    (trips) => draw(main, trips),
    (err) => {
      console.error(err);
      if (err.code === 'permission-denied') toast('접근 권한이 없어요. firestore.rules의 UID를 확인해 주세요', { kind: 'error', ms: 6000 });
      else toast('여행 목록을 불러오지 못했어요', { kind: 'error' });
    },
  );
  return () => unsub();
}

function draw(main, trips) {
  clear(main);
  const today = toDateStr(new Date());
  const withStatus = trips.map((t) => ({ ...t, status: tripStatus(t.startDate, t.endDate, today) }));
  const upcoming = withStatus.filter((t) => t.status.kind !== 'after').sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = withStatus.filter((t) => t.status.kind === 'after');

  main.append(
    el('div', { class: 'page-head' },
      el('div', {},
        el('h1', { text: '내 여행' }),
        el('p', { class: 'muted', text: `다가오는 여행 ${upcoming.length}개 · 지난 여행 ${past.length}개` })),
      el('button', { class: 'btn btn-primary', onClick: openNewTripDialog }, icon('plus'), '새 여행')),
    section('다가오는 여행', upcoming.map(featureCard), '아직 계획한 여행이 없어요. 새 여행을 만들어 보세요.'),
    section('지난 여행', past.map(smallCard), '지난 여행이 없어요.'),
  );
}

function section(title, cards, emptyText) {
  return el('section', { class: 'trips-section' },
    el('h2', { class: 'section-title', text: title }),
    cards.length ? el('div', { class: title === '지난 여행' ? 'trips-grid' : 'trips-list' }, cards)
      : el('p', { class: 'muted', text: emptyText }));
}

function cover(trip, className) {
  if (trip.coverPhoto) return el('img', { class: className, src: photoPath(trip.id, trip.coverPhoto), alt: '' });
  return el('div', { class: `${className} cover-empty`, text: '사진 없음' });
}

function deleteButton(trip) {
  return el('button', {
    class: 'btn btn-icon card-delete', 'aria-label': '여행 삭제',
    onClick: async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!(await confirmDialog(`'${trip.title}' 여행과 모든 일정을 삭제할까요?`))) return;
      try { await deleteTrip(trip.id); toast('여행을 삭제했어요'); }
      catch (err) { console.error(err); toast('삭제하지 못했어요', { kind: 'error' }); }
    },
  }, icon('trash'));
}

function featureCard(trip) {
  const stats = el('div', { class: 'trip-stats' });
  const bar = el('div', { class: 'progress' }, el('div', { style: { width: '0%' } }));
  tripStats(trip.id).then((s) => {
    if (!s) return;
    clear(stats);
    stats.append(
      stat('일정', `${s.days}일 · 장소 ${s.places}곳`),
      stat('체크리스트', `${s.checklistDone} / ${s.checklistTotal} 완료`),
      stat('예약', `${s.reservations}건`));
    bar.firstChild.style.width = s.checklistTotal ? `${Math.round((s.checklistDone / s.checklistTotal) * 100)}%` : '0%';
  });
  return el('a', { href: `#/trip/${trip.id}`, class: 'card trip-feature' },
    cover(trip, 'trip-feature-cover'),
    el('div', { class: 'trip-feature-body' },
      el('div', { class: 'trip-meta' },
        el('span', { class: 'badge', text: formatStatus(trip.status) }),
        el('span', { class: 'muted', text: formatRange(trip.startDate, trip.endDate) })),
      el('h2', { class: 'trip-title', text: trip.title }),
      stats, bar),
    deleteButton(trip));
}

function stat(label, value) {
  return el('div', { class: 'stat' }, el('span', { class: 'muted', text: label }), el('strong', { text: value }));
}

function smallCard(trip) {
  return el('a', { href: `#/trip/${trip.id}`, class: 'card trip-small' },
    cover(trip, 'trip-small-cover'),
    el('div', { class: 'trip-small-body' },
      el('h3', { text: trip.title }),
      el('p', { class: 'muted', text: formatRange(trip.startDate, trip.endDate) })),
    deleteButton(trip));
}

function openNewTripDialog() {
  const title = el('input', { class: 'input', id: 'nt-title', required: true, placeholder: '예: 오사카 · 교토' });
  const start = el('input', { class: 'input', id: 'nt-start', type: 'date', required: true });
  const end = el('input', { class: 'input', id: 'nt-end', type: 'date', required: true });
  const dialog = el('dialog', {});
  const form = el('form', { method: 'dialog' },
    el('h2', { text: '새 여행' }),
    el('div', { class: 'dialog-body' },
      el('div', { class: 'field' }, el('label', { for: 'nt-title', text: '여행 이름' }), title),
      el('div', { class: 'form-grid' },
        el('div', { class: 'field' }, el('label', { for: 'nt-start', text: '시작일' }), start),
        el('div', { class: 'field' }, el('label', { for: 'nt-end', text: '종료일' }), end))),
    el('div', { class: 'dialog-actions' },
      el('button', { type: 'button', class: 'btn', onClick: () => dialog.close() }, '취소'),
      el('button', { type: 'submit', class: 'btn btn-primary' }, '만들기')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (dayList(start.value, end.value).length === 0) {
      toast('종료일은 시작일보다 빠를 수 없어요', { kind: 'error' });
      return;
    }
    try {
      const id = await createTrip({ title: title.value, startDate: start.value, endDate: end.value });
      dialog.close();
      navigate(`/trip/${id}`);
    } catch (err) {
      console.error(err);
      toast('여행을 만들지 못했어요', { kind: 'error' });
    }
  });
  dialog.addEventListener('close', () => dialog.remove());
  dialog.append(form);
  document.body.append(dialog);
  dialog.showModal();
  title.focus();
}
```

- [ ] **Step 7: trip.js 임시 뷰**

```js
import { el } from '../ui.js';
import { topbar } from './topbar.js';

export function render(container, route) {
  container.append(topbar({ backHref: '#/' }),
    el('main', { class: 'container' }, el('h1', { text: `여행 ${route.tripId}` }), el('p', { class: 'muted', text: '일정 화면은 다음 단계에서 붙어요' })));
}
```

- [ ] **Step 8: app.js에서 라우터 연결 (`renderApp` 교체)**

```js
import { startRouter } from './router.js';
import * as tripsView from './views/trips.js';
import * as tripView from './views/trip.js';
```
`renderApp`을 다음으로 교체하고, `watchAuth` 콜백 첫 줄에 `if (stopRouter) { stopRouter(); stopRouter = null; }` 추가:
```js
let stopRouter = null;

function renderApp() {
  clear(app);
  stopRouter = startRouter({ trips: tripsView, trip: tripView }, app);
}
```

- [ ] **Step 9: 홈 CSS 추가 (main.css 끝)**

```css
/* ---- trips (home) ---- */
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 32px; }
.page-head h1 { font-size: 36px; letter-spacing: -.5px; }
.trips-section { display: flex; flex-direction: column; gap: 14px; margin-bottom: 32px; }
.section-title { font-family: var(--sans); font-size: 14px; font-weight: 500; color: var(--muted); letter-spacing: .5px; }
.trips-list { display: flex; flex-direction: column; gap: 16px; }
.trips-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
.trip-feature { position: relative; display: flex; overflow: hidden; }
.trip-feature-cover { width: 320px; flex-shrink: 0; object-fit: cover; min-height: 220px; }
.cover-empty { background: var(--line-soft); color: var(--muted); font-size: 13px; display: flex; align-items: center; justify-content: center; }
.trip-feature-body { flex-grow: 1; padding: 28px 32px; display: flex; flex-direction: column; gap: 12px; }
.trip-meta { display: flex; align-items: center; gap: 12px; font-size: 14px; }
.trip-title { font-size: 30px; }
.trip-stats { display: flex; gap: 28px; font-size: 14px; min-height: 40px; }
.stat { display: flex; flex-direction: column; gap: 2px; }
.stat .muted { font-size: 12px; }
.trip-small { position: relative; display: flex; flex-direction: column; overflow: hidden; }
.trip-small-cover { height: 150px; width: 100%; object-fit: cover; }
.trip-small-body { padding: 16px 20px 18px; display: flex; flex-direction: column; gap: 6px; }
.trip-small-body h3 { font-size: 20px; }
.card-delete { position: absolute; top: 8px; right: 8px; background: var(--card); opacity: 0; transition: opacity .15s; }
.card:hover .card-delete, .card-delete:focus-visible { opacity: 1; }
```

- [ ] **Step 10: 브라우저 확인**

1. `http://localhost:8080/` 로그인 → 빈 홈 ("아직 계획한 여행이 없어요").
2. "새 여행" → 이름 `오사카 · 교토`, 2026-10-10 ~ 2026-10-14 → 만들기 → `#/trip/<id>` 임시 화면으로 이동.
3. 뒤로 가면 홈에 D-day 배지, 기간, 일정 5일 · 장소 0곳, 체크리스트 0 / 8 완료 표시.
4. 종료일을 시작일보다 앞으로 넣고 만들기 → 토스트 "종료일은 시작일보다 빠를 수 없어요".
5. 카드에 마우스 올리면 휴지통 → 삭제 확인 → 목록에서 사라짐. (테스트용 여행은 하나 남겨 둔다.)

- [ ] **Step 11: 전체 테스트 후 커밋**

```powershell
$env:Path += ";C:\Program Files\nodejs"; npm test
```
Expected: 모두 통과.

```bash
git add js/router.js tests/router.test.js js/views/topbar.js js/views/trips.js js/views/trip.js js/app.js css/main.css
git commit -m "feat: 해시 라우터와 여행 목록 홈

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: 지도 래퍼 (`js/map.js`)

**Files:**
- Create: `js/map.js`
- Modify: `css/main.css` (끝에 추가)

**Interfaces:**
- Consumes: 전역 `L` (Leaflet, index.html에서 로드), `hasCoords` (Task 3), `escapeHtml` (Task 5)
- Produces: `createMap(container) → { setRoutes(groups, {fit}), focus(placeId), onSelect(cb(placeId)), invalidate(), destroy() }`
  - `groups`: `[[place, ...], ...]` — 그룹마다 순번 핀과 점선 하나. 각 place는 `{ id, name, time, lat, lng, label }` 이고 `label`은 핀에 찍히는 글자(`'1'` 또는 `'2-3'`).

- [ ] **Step 1: map.js 작성**

```js
import { hasCoords } from './lib/geo.js';
import { escapeHtml } from './ui.js';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const ATTRIBUTION = '© OpenStreetMap contributors © CARTO';
const ROUTE_COLOR = '#B4502B';
const DEFAULT_VIEW = { center: [36.5, 127.8], zoom: 6 };

export function createMap(container) {
  const map = L.map(container, { zoomControl: true }).setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);
  L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, subdomains: 'abcd', maxZoom: 19 }).addTo(map);
  const layer = L.layerGroup().addTo(map);
  let markers = new Map();
  let selectCb = null;

  function setRoutes(groups, { fit = true } = {}) {
    layer.clearLayers();
    markers = new Map();
    const all = [];
    for (const group of groups) {
      const pts = group.filter(hasCoords);
      pts.forEach((p) => {
        const marker = L.marker([p.lat, p.lng], {
          icon: L.divIcon({ className: 'pin-wrap', html: `<div class="pin">${escapeHtml(p.label)}</div>`, iconSize: [32, 32], iconAnchor: [16, 16] }),
        });
        marker.bindPopup(`<strong>${escapeHtml(p.name)}</strong>${p.time ? `<br><span class="muted">${escapeHtml(p.time)}</span>` : ''}`);
        marker.on('click', () => selectCb && selectCb(p.id));
        marker.addTo(layer);
        markers.set(p.id, marker);
        all.push([p.lat, p.lng]);
      });
      if (pts.length > 1) {
        L.polyline(pts.map((p) => [p.lat, p.lng]), { color: ROUTE_COLOR, weight: 3, dashArray: '8 7', opacity: 0.9 }).addTo(layer);
      }
    }
    if (fit && all.length) map.fitBounds(L.latLngBounds(all), { padding: [48, 48], maxZoom: 15 });
  }

  function focus(placeId) {
    const marker = markers.get(placeId);
    if (!marker) return;
    map.panTo(marker.getLatLng());
    marker.openPopup();
  }

  return {
    setRoutes,
    focus,
    onSelect: (cb) => { selectCb = cb; },
    invalidate: () => map.invalidateSize(),
    destroy: () => map.remove(),
  };
}
```

- [ ] **Step 2: 핀 CSS 추가 (main.css 끝)**

```css
/* ---- map ---- */
.pin-wrap { background: none; border: 0; }
.pin { width: 32px; height: 32px; border-radius: 999px; background: var(--accent); color: var(--accent-ink); border: 3px solid var(--card); font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0, 0, 0, .25); font-family: var(--sans); }
.leaflet-popup-content { font-family: var(--sans); font-size: 13px; }
```

- [ ] **Step 3: 브라우저 콘솔에서 확인**

임시 trip.js 화면(`#/trip/<id>`)에서 콘솔:
```js
const { createMap } = await import('./js/map.js');
const box = document.createElement('div'); box.style.cssText = 'height:400px'; document.querySelector('main').append(box);
const m = createMap(box);
m.setRoutes([[{ id: 'a', name: '후시미 이나리', time: '07:30', lat: 34.9671, lng: 135.7727, label: '1' }, { id: 'b', name: '니시키 시장', lat: 35.0050, lng: 135.7649, label: '2' }, { id: 'c', name: '이름만', lat: null, lng: null, label: '3' }]]);
m.onSelect((id) => console.log('select', id)); m.focus('b');
```
Expected: Carto 타일 지도, 테라코타 핀 1·2, 점선 연결, 핀 3은 없음, 핀 클릭 시 `select b` 로그와 말풍선.

- [ ] **Step 4: 커밋**

```bash
git add js/map.js css/main.css
git commit -m "feat: Leaflet 지도 래퍼

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: 여행 셸과 일정 플래너 (Day 탭, 타임라인, 지도 연동)

**Files:**
- Modify: `js/views/trip.js` (전체 교체), `css/main.css` (끝에 추가)
- Create: `js/views/planner.js`

**Interfaces:**
- Consumes: `db.watchTrip/watchDays/watchPlaces/addDay/deleteDay`, `map.createMap`, `dates.*`, `geo.legLabel`, `ui.*`
- Produces:
  - `trip.js`: `render(container, route)`; 탭 하위 뷰 계약 `mount(content, ctx) → cleanup`, `ctx = { tripId, trip }`
  - `planner.js`: `mount(content, ctx)`; 장소 클릭 시 `openPlaceSheet`를 호출하는 자리는 Task 10에서 채운다 (이 Task에서는 `toast('장소 편집은 다음 단계에서')`).

- [ ] **Step 1: trip.js 교체 (셸 + 헤더 + 탭 마운트)**

```js
import { el, clear, toast } from '../ui.js';
import { topbar } from './topbar.js';
import { watchTrip } from '../db.js';
import { formatRange, tripStatus, formatStatus, toDateStr } from '../lib/dates.js';
import { navigate } from '../router.js';
import * as planner from './planner.js';

const TAB_VIEWS = { planner };
const TAB_LABELS = { planner: '일정', checklist: '체크리스트', reservations: '예약' };

export function render(container, route) {
  const { tripId, tab } = route;
  const header = el('div', { class: 'trip-header' });
  const content = el('div', { class: 'trip-content' });
  container.append(topbar({ backHref: '#/' }), header, content);
  let mounted = false;
  let cleanupTab = null;

  const unsub = watchTrip(tripId, (trip) => {
    if (!trip) { toast('여행을 찾을 수 없어요', { kind: 'error' }); navigate('/'); return; }
    drawHeader(header, trip, tab);
    if (!mounted) {
      mounted = true;
      const view = TAB_VIEWS[tab];
      if (view) cleanupTab = view.mount(content, { tripId, trip }) || null;
      else content.append(el('p', { class: 'muted container', text: `${TAB_LABELS[tab]} 탭은 다음 단계에서 붙어요` }));
    }
  }, (err) => { console.error(err); toast('여행을 불러오지 못했어요', { kind: 'error' }); });

  return () => { unsub(); if (cleanupTab) cleanupTab(); };
}

function drawHeader(header, trip, tab) {
  clear(header);
  header.append(
    el('div', { class: 'trip-header-left' },
      el('h1', { text: trip.title }),
      el('span', { class: 'muted', text: formatRange(trip.startDate, trip.endDate) }),
      el('span', { class: 'badge', text: formatStatus(tripStatus(trip.startDate, trip.endDate, toDateStr(new Date()))) })),
    el('nav', { class: 'tabs' },
      ...Object.entries(TAB_LABELS).map(([key, label]) => el('a', {
        href: key === 'planner' ? `#/trip/${trip.id}` : `#/trip/${trip.id}/${key}`,
        class: `tab${key === tab ? ' active' : ''}`, text: label,
      }))));
}
```

- [ ] **Step 2: planner.js 작성**

```js
import { el, clear, toast, confirmDialog, icon, CATEGORY_LABELS } from '../ui.js';
import { watchDays, watchPlaces, addDay, deleteDay } from '../db.js';
import { formatShort } from '../lib/dates.js';
import { legLabel } from '../lib/geo.js';
import { createMap } from '../map.js';

export function mount(content, ctx) {
  const { tripId } = ctx;
  const state = { days: [], places: [], selectedDayId: null, showAll: false, dragging: false, pending: false };

  const panel = el('section', { class: 'planner-panel' });
  const mapArea = el('section', { class: 'planner-map' });
  const mapBox = el('div', { class: 'map-box' });
  const toggleDay = el('button', { class: 'btn btn-sm map-toggle active', onClick: () => setShowAll(false) }, '이 날만');
  const toggleAll = el('button', { class: 'btn btn-sm map-toggle', onClick: () => setShowAll(true) }, '전체 일정');
  mapArea.append(mapBox, el('div', { class: 'map-controls' }, toggleDay, toggleAll));
  content.append(el('div', { class: 'planner' }, panel, mapArea));

  const map = createMap(mapBox);
  map.onSelect((placeId) => highlight(placeId));
  requestAnimationFrame(() => map.invalidate());

  const unsubs = [
    watchDays(tripId, (days) => {
      state.days = days;
      if (!state.selectedDayId || !days.some((d) => d.id === state.selectedDayId)) state.selectedDayId = days[0]?.id ?? null;
      redraw();
    }),
    watchPlaces(tripId, (places) => { state.places = places; redraw(); }),
  ];

  function setShowAll(value) {
    state.showAll = value;
    toggleDay.classList.toggle('active', !value);
    toggleAll.classList.toggle('active', value);
    drawMap();
  }

  function selectDay(dayId) {
    state.selectedDayId = dayId;
    redraw();
  }

  function placesOf(dayId) {
    return state.places.filter((p) => p.dayId === dayId);
  }

  function redraw() {
    if (state.dragging) { state.pending = true; return; }
    drawPanel();
    drawMap();
  }

  function drawMap() {
    const groups = state.showAll
      ? state.days.map((d, di) => placesOf(d.id).map((p, i) => ({ ...p, label: `${di + 1}-${i + 1}` })))
      : [placesOf(state.selectedDayId).map((p, i) => ({ ...p, label: String(i + 1) }))];
    map.setRoutes(groups, { fit: true });
  }

  function highlight(placeId) {
    panel.querySelectorAll('.tl-item').forEach((n) => n.classList.toggle('active', n.dataset.id === placeId));
    panel.querySelector(`.tl-item[data-id="${placeId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function drawPanel() {
    clear(panel);
    const dayIndex = state.days.findIndex((d) => d.id === state.selectedDayId);
    const day = state.days[dayIndex];
    panel.append(el('div', { class: 'day-tabs' },
      ...state.days.map((d, i) => el('button', {
        class: `day-tab${d.id === state.selectedDayId ? ' active' : ''}`, onClick: () => selectDay(d.id),
      }, el('strong', { text: `Day ${i + 1}` }), el('span', { text: formatShort(d.date) }))),
      el('button', {
        class: 'day-tab day-tab-add', 'aria-label': '날짜 추가',
        onClick: () => addDay(tripId).catch((err) => { console.error(err); toast('날짜를 추가하지 못했어요', { kind: 'error' }); }),
      }, icon('plus'))));

    if (!day) { panel.append(el('p', { class: 'muted', text: '날짜가 없어요' })); return; }
    const places = placesOf(day.id);

    panel.append(el('div', { class: 'day-head' },
      el('span', { class: 'day-title', text: `Day ${dayIndex + 1} · ${formatShort(day.date)}` }),
      el('div', { class: 'day-head-right' },
        el('span', { class: 'muted', text: `장소 ${places.length}곳` }),
        el('button', {
          class: 'btn btn-sm btn-danger', disabled: state.days.length <= 1,
          onClick: async () => {
            if (!(await confirmDialog(`Day ${dayIndex + 1}과 그 날의 장소 ${places.length}곳을 삭제할까요?`))) return;
            try { await deleteDay(tripId, day.id); toast('날짜를 삭제했어요'); }
            catch (err) { console.error(err); toast('삭제하지 못했어요', { kind: 'error' }); }
          },
        }, '이 날 삭제'))));

    const list = el('div', { class: 'timeline' });
    places.forEach((p, i) => {
      if (i > 0) {
        const label = legLabel(places[i - 1], p);
        list.append(el('div', { class: 'tl-leg' }, el('span', { class: 'tl-leg-line' }), el('span', { class: 'muted', text: label ?? '' })));
      }
      list.append(timelineItem(p, i));
    });
    if (!places.length) list.append(el('p', { class: 'muted tl-empty', text: '아직 장소가 없어요. 아래에서 추가해 보세요.' }));
    panel.append(list);
    panel.append(el('button', { class: 'btn btn-dashed', onClick: () => openSheet({ dayId: day.id, dayIndex }) }, icon('plus'), '장소 추가'));
  }

  function timelineItem(p, index) {
    return el('div', { class: 'tl-item', dataset: { id: p.id, index: String(index) } },
      el('div', { class: 'tl-num', text: String(index + 1) }),
      el('button', { class: 'tl-body', onClick: () => { map.focus(p.id); highlight(p.id); openSheet({ dayId: p.dayId, place: p }); } },
        el('div', { class: 'tl-meta' },
          p.time && el('span', { class: 'muted', text: p.time }),
          el('span', { class: 'tag', text: CATEGORY_LABELS[p.category] ?? '기타' }),
          p.stayMinutes ? el('span', { class: 'muted', text: `${p.stayMinutes}분` }) : null),
        el('div', { class: 'tl-name', text: p.name || '(이름 없음)' }),
        p.memo && el('div', { class: 'muted tl-memo', text: p.memo.split('\n')[0] })),
      el('button', { class: 'btn btn-icon drag-handle', 'aria-label': '순서 이동' }, icon('drag')));
  }

  function openSheet() {
    toast('장소 편집은 다음 단계에서 붙어요');
  }

  return () => { unsubs.forEach((u) => u()); map.destroy(); };
}
```

- [ ] **Step 3: 플래너 CSS 추가 (main.css 끝)**

```css
/* ---- trip shell ---- */
.trip-header { min-height: 76px; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--line); background: var(--card); flex-wrap: wrap; }
.trip-header-left { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
.trip-header h1 { font-size: 26px; }
.tabs { display: flex; gap: 4px; padding: 4px; background: var(--line-soft); border-radius: var(--radius); }
.tab { padding: 8px 18px; border-radius: 8px; font-size: 14px; font-weight: 500; color: var(--muted); }
.tab.active { background: var(--card); color: var(--ink); }
.trip-content { min-height: calc(100vh - 140px); }

/* ---- planner ---- */
.planner { display: flex; height: calc(100vh - 140px); min-height: 480px; }
.planner-panel { width: 520px; flex-shrink: 0; background: var(--card); border-right: 1px solid var(--line); display: flex; flex-direction: column; overflow-y: auto; padding: 0 24px 24px; }
.planner-map { flex-grow: 1; position: relative; background: var(--map); }
.map-box { position: absolute; inset: 0; }
.map-controls { position: absolute; left: 12px; top: 12px; z-index: 500; display: flex; gap: 6px; }
.map-toggle { background: var(--card); color: var(--muted); }
.map-toggle.active { color: var(--ink); border-color: var(--line); background: var(--card); font-weight: 700; }
.day-tabs { display: flex; gap: 8px; padding: 16px 0; overflow-x: auto; border-bottom: 1px solid var(--line-soft); flex-shrink: 0; }
.day-tab { height: 48px; padding: 0 14px; border: 1px solid var(--line); border-radius: var(--radius); background: transparent; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; cursor: pointer; flex-shrink: 0; }
.day-tab strong { font-size: 12px; }
.day-tab span { font-size: 11px; color: var(--muted); }
.day-tab.active { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.day-tab.active span { color: var(--accent-ink); }
.day-tab-add { width: 48px; border-style: dashed; color: var(--muted); }
.day-tab-add svg { width: 16px; height: 16px; }
.day-head { display: flex; align-items: center; justify-content: space-between; padding: 20px 0 10px; }
.day-head-right { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.day-title { font-family: var(--serif); font-size: 18px; font-weight: 700; }
.timeline { display: flex; flex-direction: column; }
.tl-item { display: flex; gap: 14px; padding: 10px 0; align-items: flex-start; border-radius: var(--radius); }
.tl-item.active { background: var(--paper); margin: 0 -8px; padding-left: 8px; padding-right: 8px; }
.tl-item.dragging { opacity: .5; }
.tl-item.drop-before { box-shadow: 0 -2px 0 var(--accent); }
.tl-item.drop-after { box-shadow: 0 2px 0 var(--accent); }
.tl-num { width: 28px; height: 28px; flex-shrink: 0; border-radius: 999px; background: var(--accent); color: var(--accent-ink); font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 2px; }
.tl-body { flex-grow: 1; min-width: 0; text-align: left; border: 0; background: transparent; padding: 0; cursor: pointer; display: flex; flex-direction: column; gap: 3px; }
.tl-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.tl-name { font-size: 15px; font-weight: 500; }
.tl-memo { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.drag-handle { color: var(--line); cursor: grab; touch-action: none; }
.drag-handle:active { cursor: grabbing; }
.tl-leg { display: flex; align-items: center; gap: 14px; padding-left: 13px; height: 26px; font-size: 12px; }
.tl-leg-line { width: 2px; height: 26px; border-left: 2px dashed var(--line); }
.tl-empty { padding: 16px 0; }
```

- [ ] **Step 4: 브라우저 확인**

1. 홈에서 여행 카드 클릭 → 헤더(제목·기간·D-day·탭), 왼쪽 Day 1~5 탭, 오른쪽 지도(한국 중심 기본 뷰).
2. Day 탭 클릭 시 활성 색이 바뀌고 "Day n · 날짜" 제목이 바뀜.
3. "+" 날짜 추가 → Day 6이 생기고 헤더 기간이 `10.15`로 늘어남. "이 날 삭제" → 다시 5일.
4. 콘솔에서 장소를 두 개 넣어 타임라인과 지도를 확인:
```js
const db = await import('./js/db.js'); const tripId = location.hash.split('/')[2];
const dayId = (await new Promise((r) => db.watchDays(tripId, (d) => r(d))))[0].id;
await db.addPlace(tripId, { dayId, name: '후시미 이나리 타이샤', time: '07:30', lat: 34.9671, lng: 135.7727, memo: '사람 몰리기 전에' });
await db.addPlace(tripId, { dayId, name: '니시키 시장', time: '11:00', category: 'food', lat: 35.0050, lng: 135.7649 });
```
Expected: 순번 1·2 항목, 사이에 "거리 4.3km" 또는 "도보 …" 구간, 지도에 핀 1·2와 점선. 항목 클릭 시 지도가 그 핀으로 이동하고 말풍선. "전체 일정" 토글 시 핀 라벨이 `1-1`, `1-2`.
5. 체크리스트/예약 탭 클릭 → "다음 단계에서 붙어요" 안내.

- [ ] **Step 5: 커밋**

```bash
git add js/views/trip.js js/views/planner.js css/main.css
git commit -m "feat: 여행 셸과 일정 플래너 (Day 탭, 타임라인, 지도 동선)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: 장소 검색과 장소 추가·편집 시트

**Files:**
- Create: `js/geocode.js`, `tests/geocode.test.js`, `js/views/place-sheet.js`
- Modify: `js/views/planner.js` (`openSheet` 교체), `css/main.css` (끝에 추가)

**Interfaces:**
- Consumes: `db.addPlace/updatePlace/deletePlace`, `ui.*`
- Produces:
  - `geocode.js`: `parseNominatim(json) → [{name, address, lat, lng}]`, `searchPlaces(q) → Promise<[...]>` (1초 간격 제한), `debounce(fn, ms)`
  - `place-sheet.js`: `openPlaceSheet({ tripId, dayId, dayIndex, place = null }) → close()`

- [ ] **Step 1: geocode 테스트 작성**

`tests/geocode.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNominatim, debounce } from '../js/geocode.js';

test('parseNominatim: name/display_name/lat/lon을 정리한다', () => {
  const json = [
    { name: '伏見稲荷大社', display_name: '伏見稲荷大社, 68, 深草藪之内町, 伏見区, 京都市, 京都府, 日本', lat: '34.9671', lon: '135.7727' },
    { name: '', display_name: '니시키 시장, 나카교구, 교토시', lat: '35.0050', lon: '135.7649' },
  ];
  assert.deepEqual(parseNominatim(json), [
    { name: '伏見稲荷大社', address: '伏見稲荷大社, 68, 深草藪之内町, 伏見区, 京都市, 京都府, 日本', lat: 34.9671, lng: 135.7727 },
    { name: '니시키 시장', address: '니시키 시장, 나카교구, 교토시', lat: 35.005, lng: 135.7649 },
  ]);
});

test('parseNominatim: 배열이 아니거나 좌표가 깨지면 버린다', () => {
  assert.deepEqual(parseNominatim(null), []);
  assert.deepEqual(parseNominatim({ error: 'x' }), []);
  assert.deepEqual(parseNominatim([{ display_name: 'a', lat: 'abc', lon: '1' }]), []);
});

test('debounce: 마지막 호출만 실행된다', async () => {
  const calls = [];
  const fn = debounce((v) => calls.push(v), 20);
  fn(1); fn(2); fn(3);
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(calls, [3]);
});
```

- [ ] **Step 2: 실패 확인**

```powershell
$env:Path += ";C:\Program Files\nodejs"; node --test tests/geocode.test.js
```
Expected: 모듈 없음으로 실패.

- [ ] **Step 3: geocode.js 작성**

```js
const BASE_URL = 'https://nominatim.openstreetmap.org/search';
const MIN_INTERVAL_MS = 1000;
let lastRequestAt = 0;

export function parseNominatim(json) {
  if (!Array.isArray(json)) return [];
  return json
    .map((r) => ({
      name: String(r.name || String(r.display_name || '').split(',')[0]).trim(),
      address: String(r.display_name || ''),
      lat: Number(r.lat),
      lng: Number(r.lon),
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
}

export async function searchPlaces(q) {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
  const url = `${BASE_URL}?format=jsonv2&limit=5&accept-language=ko&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  return parseNominatim(await res.json());
}

export function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
```

- [ ] **Step 4: 통과 확인**

```powershell
$env:Path += ";C:\Program Files\nodejs"; node --test tests/geocode.test.js
```
Expected: `# pass 3`.

- [ ] **Step 5: place-sheet.js 작성**

```js
import { el, toast, confirmDialog, icon, photoPath, CATEGORY_LABELS, CATEGORY_ORDER } from '../ui.js';
import { addPlace, updatePlace, deletePlace } from '../db.js';
import { searchPlaces, debounce } from '../geocode.js';

export function openPlaceSheet({ tripId, dayId, dayIndex, place = null }) {
  const draft = {
    name: place?.name ?? '', time: place?.time ?? '', stayMinutes: place?.stayMinutes ?? '',
    category: place?.category ?? 'sight', memo: place?.memo ?? '',
    lat: place?.lat ?? null, lng: place?.lng ?? null, address: place?.address ?? null,
    photos: [...(place?.photos ?? [])],
  };

  const search = el('input', { class: 'input', id: 'ps-search', type: 'search', placeholder: '장소 이름이나 주소로 검색', autocomplete: 'off' });
  const results = el('div', { class: 'search-results', hidden: true });
  const name = el('input', { class: 'input', id: 'ps-name', value: draft.name, required: true, placeholder: '장소 이름' });
  const time = el('input', { class: 'input', id: 'ps-time', type: 'time', value: draft.time });
  const stay = el('input', { class: 'input', id: 'ps-stay', type: 'number', min: '0', step: '5', value: draft.stayMinutes, placeholder: '분' });
  const memo = el('textarea', { class: 'input', id: 'ps-memo', rows: '3', placeholder: '메모' });
  memo.value = draft.memo;
  const location = el('p', { class: 'muted ps-location' });
  const photoList = el('div', { class: 'photo-list' });
  const photoInput = el('input', { class: 'input', id: 'ps-photo', placeholder: '파일명 (예: 01.jpg) 입력 후 Enter' });
  const categoryRow = el('div', { class: 'chips' });

  function drawLocation() {
    location.textContent = draft.lat != null ? `위치 설정됨 · ${draft.address ?? `${draft.lat.toFixed(4)}, ${draft.lng.toFixed(4)}`}` : '위치 없음 · 검색해서 고르면 지도에 표시돼요';
  }

  function drawCategories() {
    categoryRow.replaceChildren(...CATEGORY_ORDER.map((key) => el('button', {
      type: 'button', class: `chip${draft.category === key ? ' active' : ''}`,
      onClick: () => { draft.category = key; drawCategories(); },
    }, CATEGORY_LABELS[key])));
  }

  function drawPhotos() {
    photoList.replaceChildren(...draft.photos.map((file) => el('div', { class: 'photo-chip' },
      el('img', { src: photoPath(tripId, file), alt: '', onError: (e) => { e.target.replaceWith(el('span', { class: 'photo-missing', text: file })); } }),
      el('button', { type: 'button', class: 'photo-remove', 'aria-label': `${file} 제거`, onClick: () => { draft.photos = draft.photos.filter((f) => f !== file); drawPhotos(); } }, icon('close')))));
  }

  const runSearch = debounce(async (q) => {
    if (q.trim().length < 2) { results.hidden = true; return; }
    try {
      const found = await searchPlaces(q.trim());
      results.replaceChildren(...(found.length ? found.map((r) => el('button', {
        type: 'button', class: 'search-result',
        onClick: () => {
          draft.lat = r.lat; draft.lng = r.lng; draft.address = r.address;
          if (!name.value.trim()) name.value = r.name;
          results.hidden = true; search.value = '';
          drawLocation();
        },
      }, el('strong', { text: r.name }), el('span', { class: 'muted', text: r.address }))) : [el('p', { class: 'muted', text: '검색 결과가 없어요' })]));
      results.hidden = false;
    } catch (err) {
      console.error(err);
      toast('검색에 실패했어요. 잠시 후 다시 시도해 주세요', { kind: 'error' });
    }
  }, 600);
  search.addEventListener('input', () => runSearch(search.value));
  photoInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const file = photoInput.value.trim();
    if (file && !draft.photos.includes(file)) { draft.photos.push(file); drawPhotos(); }
    photoInput.value = '';
  });

  const overlay = el('div', { class: 'sheet-overlay' });
  const form = el('form', { class: 'sheet' });
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: name.value.trim(), time: time.value || null,
      stayMinutes: stay.value === '' ? null : Number(stay.value),
      category: draft.category, memo: memo.value,
      lat: draft.lat, lng: draft.lng, address: draft.address, photos: draft.photos,
    };
    if (!data.name) { toast('장소 이름을 입력해 주세요', { kind: 'error' }); name.focus(); return; }
    try {
      if (place) await updatePlace(tripId, place.id, data);
      else await addPlace(tripId, { dayId, ...data });
      toast(place ? '저장했어요' : '일정에 추가했어요');
      close();
    } catch (err) {
      console.error(err);
      toast('저장하지 못했어요', { kind: 'error' });
    }
  });

  form.append(
    el('div', { class: 'sheet-head' },
      el('h2', { text: place ? '장소 편집' : `장소 추가 · Day ${dayIndex + 1}` }),
      el('button', { type: 'button', class: 'btn btn-icon', 'aria-label': '닫기', onClick: close }, icon('close'))),
    el('div', { class: 'sheet-body' },
      el('div', { class: 'field' }, el('label', { for: 'ps-search', text: '장소 검색' }), search, results, location),
      el('div', { class: 'field' }, el('label', { for: 'ps-name', text: '이름' }), name),
      el('div', { class: 'form-grid' },
        el('div', { class: 'field' }, el('label', { for: 'ps-time', text: '시간' }), time),
        el('div', { class: 'field' }, el('label', { for: 'ps-stay', text: '머무는 시간(분)' }), stay)),
      el('div', { class: 'field' }, el('label', { text: '분류' }), categoryRow),
      el('div', { class: 'field' }, el('label', { for: 'ps-memo', text: '메모' }), memo),
      el('div', { class: 'field' }, el('label', { for: 'ps-photo', text: '사진 · GitHub photos 폴더에 올린 파일명' }), photoList, photoInput)),
    el('div', { class: 'sheet-foot' },
      place ? el('button', {
        type: 'button', class: 'btn btn-danger',
        onClick: async () => {
          if (!(await confirmDialog(`'${place.name}'을(를) 일정에서 삭제할까요?`))) return;
          try { await deletePlace(tripId, place.id); toast('삭제했어요'); close(); }
          catch (err) { console.error(err); toast('삭제하지 못했어요', { kind: 'error' }); }
        },
      }, '삭제') : el('span'),
      el('div', { class: 'sheet-foot-right' },
        el('button', { type: 'button', class: 'btn', onClick: close }, '취소'),
        el('button', { type: 'submit', class: 'btn btn-primary' }, place ? '저장' : '일정에 추가'))));

  drawLocation(); drawCategories(); drawPhotos();
  overlay.append(form);
  document.body.append(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  (place ? name : search).focus();
  return close;
}
```

- [ ] **Step 6: planner.js의 `openSheet` 교체**

파일 상단에 `import { openPlaceSheet } from './place-sheet.js';` 추가하고, `function openSheet() { toast(...) }`를 다음으로 교체:
```js
  function openSheet({ dayId, dayIndex = state.days.findIndex((d) => d.id === dayId), place = null }) {
    openPlaceSheet({ tripId, dayId, dayIndex, place });
  }
```

- [ ] **Step 7: 시트 CSS 추가 (main.css 끝)**

```css
/* ---- place sheet ---- */
.sheet-overlay { position: fixed; inset: 0; background: rgba(30, 26, 21, 0); z-index: 900; display: flex; justify-content: flex-end; transition: background .2s; }
.sheet-overlay.open { background: rgba(30, 26, 21, .25); }
.sheet { width: 440px; max-width: 100%; height: 100%; background: var(--card); border-left: 1px solid var(--line); box-shadow: -12px 0 32px rgba(30, 26, 21, .12); display: flex; flex-direction: column; transform: translateX(100%); transition: transform .2s; }
.sheet-overlay.open .sheet { transform: none; }
.sheet-head { padding: 16px 20px 16px 28px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line-soft); }
.sheet-head h2 { font-size: 20px; }
.sheet-body { flex-grow: 1; overflow-y: auto; padding: 24px 28px; display: flex; flex-direction: column; gap: 18px; }
.sheet-foot { padding: 16px 28px 20px; border-top: 1px solid var(--line-soft); display: flex; justify-content: space-between; gap: 12px; }
.sheet-foot-right { display: flex; gap: 8px; }
.search-results { display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
.search-results[hidden] { display: none; }
.search-results p { padding: 10px 14px; }
.search-result { text-align: left; padding: 10px 14px; border: 0; border-bottom: 1px solid var(--line-soft); background: transparent; display: flex; flex-direction: column; gap: 2px; cursor: pointer; }
.search-result:last-child { border-bottom: 0; }
.search-result:hover { background: var(--paper); }
.search-result span { font-size: 12px; }
.ps-location { font-size: 12px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { height: 34px; padding: 0 14px; border: 1px solid var(--line); border-radius: 999px; background: transparent; font-size: 13px; color: var(--muted); cursor: pointer; }
.chip.active { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); font-weight: 500; }
.photo-list { display: flex; flex-wrap: wrap; gap: 8px; }
.photo-chip { position: relative; width: 72px; height: 72px; border-radius: 8px; overflow: hidden; background: var(--line-soft); display: flex; align-items: center; justify-content: center; }
.photo-chip img { width: 100%; height: 100%; object-fit: cover; }
.photo-missing { font-size: 10px; color: var(--muted); padding: 4px; text-align: center; word-break: break-all; }
.photo-remove { position: absolute; top: 2px; right: 2px; width: 22px; height: 22px; border: 0; border-radius: 999px; background: rgba(30, 26, 21, .6); color: var(--paper); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.photo-remove svg { width: 12px; height: 12px; }
```

- [ ] **Step 8: 브라우저 확인**

1. "장소 추가" → 시트가 오른쪽에서 열림. 검색창에 `아라시야마` 입력 → 0.6초 뒤 결과 목록 → 하나 선택 → "위치 설정됨 · …", 이름 자동 채움.
2. 시간 09:00, 머무는 시간 90, 분류 관광, 메모 입력, 사진 `01.jpg` Enter → 깨진 이미지 대신 파일명 표시 → "일정에 추가" → 타임라인에 3번으로 추가되고 지도에 핀 3.
3. 항목 클릭 → 편집 시트 → 이름 변경 → 저장 → 반영. 삭제 → 확인 → 사라짐.
4. 검색 없이 이름만 `호텔 체크인` 넣고 추가 → 타임라인엔 보이고 핀·구간 표시 없음, 오류 없음.
5. Esc와 바깥 클릭으로 닫힘.

- [ ] **Step 9: 전체 테스트 후 커밋**

```powershell
$env:Path += ";C:\Program Files\nodejs"; npm test
```

```bash
git add js/geocode.js tests/geocode.test.js js/views/place-sheet.js js/views/planner.js css/main.css
git commit -m "feat: 장소 검색과 장소 추가·편집 시트

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: 타임라인 드래그로 순서 변경

**Files:**
- Modify: `js/views/planner.js`

**Interfaces:**
- Consumes: `order.reorderUpdates` (Task 4), `db.reorderPlaces` (Task 6)

- [ ] **Step 1: planner.js에 import 추가**

```js
import { reorderUpdates } from '../lib/order.js';
import { reorderPlaces } from '../db.js';
```
(기존 `import { watchDays, ... } from '../db.js'` 줄에 `reorderPlaces`를 합쳐도 된다.)

- [ ] **Step 2: `drawPanel` 안에서 `panel.append(list)` 바로 뒤에 `enableDrag(list, places)` 호출 추가**

- [ ] **Step 3: `mount` 안(`timelineItem` 아래)에 `enableDrag` 함수 추가**

```js
  function enableDrag(list, places) {
    list.querySelectorAll('.drag-handle').forEach((handle) => {
      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const item = handle.closest('.tl-item');
        const rows = [...list.querySelectorAll('.tl-item')];
        const from = Number(item.dataset.index);
        let to = from;
        state.dragging = true;
        item.classList.add('dragging');
        handle.setPointerCapture(e.pointerId);

        const onMove = (ev) => {
          const y = ev.clientY;
          let idx = rows.findIndex((r) => { const b = r.getBoundingClientRect(); return y < b.top + b.height / 2; });
          if (idx === -1) idx = rows.length;
          to = idx > from ? idx - 1 : idx;
          rows.forEach((r, i) => {
            r.classList.toggle('drop-before', i === idx && i !== from && i !== from + 1);
            r.classList.toggle('drop-after', idx === rows.length && i === rows.length - 1 && from !== rows.length - 1);
          });
        };
        const onUp = async () => {
          handle.removeEventListener('pointermove', onMove);
          rows.forEach((r) => r.classList.remove('drop-before', 'drop-after', 'dragging'));
          state.dragging = false;
          if (to !== from) {
            try { await reorderPlaces(tripId, reorderUpdates(places, from, to)); }
            catch (err) { console.error(err); toast('순서를 바꾸지 못했어요', { kind: 'error' }); }
          }
          if (state.pending) { state.pending = false; redraw(); }
        };
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp, { once: true });
        handle.addEventListener('pointercancel', onUp, { once: true });
      });
    });
  }
```

- [ ] **Step 4: 브라우저 확인**

1. Day에 장소 3개 이상 준비. 3번 항목의 점 6개 핸들을 누르고 1번 위로 끌어 놓기 → 순번이 3→1로 바뀌고 지도 핀 번호와 점선 순서도 바뀜. 다른 탭에서 같은 여행을 열어 두면 거기도 바뀜.
2. 같은 자리에 놓기 → 변화 없음, Firebase 콘솔의 문서 수정 시간이 그대로.
3. 브라우저 개발자 도구 기기 모드(터치)에서 끌어 보기 → 동작.
4. 드래그 중에 다른 탭에서 장소를 추가 → 드래그를 끝낸 뒤 새 항목이 나타남 (드래그 중에 목록이 갈아엎어지지 않음).

- [ ] **Step 5: 커밋**

```bash
git add js/views/planner.js
git commit -m "feat: 타임라인 드래그로 순서 변경

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: 체크리스트 탭

**Files:**
- Create: `js/views/checklist.js`
- Modify: `js/views/trip.js` (`TAB_VIEWS`에 등록), `css/main.css` (끝에 추가)

**Interfaces:**
- Consumes: `db.watchChecklist/addChecklistItem/updateChecklistItem/deleteChecklistItem/renameChecklistGroup/deleteChecklistGroup`
- Produces: `checklist.js`: `mount(content, ctx) → cleanup`

- [ ] **Step 1: checklist.js 작성**

```js
import { el, clear, toast, confirmDialog, icon } from '../ui.js';
import { watchChecklist, addChecklistItem, updateChecklistItem, deleteChecklistItem, renameChecklistGroup, deleteChecklistGroup } from '../db.js';

export function mount(content, ctx) {
  const { tripId } = ctx;
  const main = el('main', { class: 'container checklist-page' });
  content.append(main);
  const unsub = watchChecklist(tripId, (items) => draw(main, tripId, items),
    (err) => { console.error(err); toast('체크리스트를 불러오지 못했어요', { kind: 'error' }); });
  return () => unsub();
}

function groupItems(items) {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item.group)) map.set(item.group, { name: item.group, groupOrder: item.groupOrder ?? 0, items: [] });
    map.get(item.group).items.push(item);
  }
  return [...map.values()]
    .sort((a, b) => a.groupOrder - b.groupOrder || a.name.localeCompare(b.name))
    .map((g) => ({ ...g, items: g.items.sort((a, b) => a.order - b.order) }));
}

function draw(main, tripId, items) {
  clear(main);
  const done = items.filter((i) => i.done).length;
  const groups = groupItems(items);
  const fail = (msg) => (err) => { console.error(err); toast(msg, { kind: 'error' }); };

  main.append(
    el('div', { class: 'page-head' },
      el('div', {}, el('h2', { class: 'checklist-title', text: '체크리스트' }), el('p', { class: 'muted', text: `${done} / ${items.length} 완료` })),
      el('button', { class: 'btn', onClick: () => addGroupDialog(tripId, groups.length) }, icon('plus'), '그룹 추가')),
    el('div', { class: 'progress' }, el('div', { style: { width: items.length ? `${Math.round((done / items.length) * 100)}%` : '0%' } })),
    el('div', { class: 'checklist-groups' }, ...groups.map((g) => groupCard(tripId, g, fail))),
    groups.length === 0 && el('p', { class: 'muted', text: '그룹을 추가해서 준비물을 적어 보세요.' }));
}

function groupCard(tripId, group, fail) {
  const input = el('input', { class: 'inline-input', placeholder: '항목 추가', 'aria-label': `${group.name}에 항목 추가` });
  input.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter' || !input.value.trim()) return;
    e.preventDefault();
    const text = input.value.trim();
    input.value = '';
    await addChecklistItem(tripId, { group: group.name, groupOrder: group.groupOrder, text }).catch(fail('항목을 추가하지 못했어요'));
  });
  return el('section', { class: 'card check-group' },
    el('div', { class: 'check-group-head' },
      el('span', { class: 'check-group-name', text: group.name }),
      el('div', {},
        el('button', {
          class: 'btn btn-icon btn-sm', 'aria-label': '그룹 이름 바꾸기',
          onClick: () => renameGroupDialog(tripId, group.name),
        }, icon('edit')),
        el('button', {
          class: 'btn btn-icon btn-sm', 'aria-label': '그룹 삭제',
          onClick: async () => {
            if (!(await confirmDialog(`'${group.name}' 그룹과 항목 ${group.items.length}개를 삭제할까요?`))) return;
            await deleteChecklistGroup(tripId, group.name).catch(fail('삭제하지 못했어요'));
          },
        }, icon('trash')))),
    ...group.items.map((item) => checkRow(tripId, item, fail)),
    el('div', { class: 'check-row check-add' }, icon('plus'), input));
}

function checkRow(tripId, item, fail) {
  const id = `chk-${item.id}`;
  const box = el('input', { type: 'checkbox', id, checked: item.done, onChange: () => updateChecklistItem(tripId, item.id, { done: box.checked }).catch(fail('저장하지 못했어요')) });
  return el('div', { class: `check-row${item.done ? ' done' : ''}` },
    box,
    el('label', { for: id, text: item.text }),
    el('button', {
      class: 'btn btn-icon btn-sm check-delete', 'aria-label': `${item.text} 삭제`,
      onClick: () => deleteChecklistItem(tripId, item.id).catch(fail('삭제하지 못했어요')),
    }, icon('close')));
}

function promptDialog({ title, value = '', okText = '저장' }) {
  return new Promise((resolve) => {
    const input = el('input', { class: 'input', value, required: true });
    const dialog = el('dialog', {});
    const form = el('form', { method: 'dialog' },
      el('h2', { text: title }), el('div', { class: 'dialog-body' }, input),
      el('div', { class: 'dialog-actions' },
        el('button', { type: 'button', class: 'btn', onClick: () => dialog.close() }, '취소'),
        el('button', { type: 'submit', class: 'btn btn-primary' }, okText)));
    form.addEventListener('submit', (e) => { e.preventDefault(); dialog.close(); resolve(input.value.trim()); });
    dialog.addEventListener('close', () => { dialog.remove(); resolve(null); });
    dialog.append(form); document.body.append(dialog); dialog.showModal(); input.focus(); input.select();
  });
}

async function addGroupDialog(tripId, groupOrder) {
  const name = await promptDialog({ title: '새 그룹', okText: '추가' });
  if (!name) return;
  await addChecklistItem(tripId, { group: name, groupOrder, text: '첫 항목' })
    .catch((err) => { console.error(err); toast('그룹을 추가하지 못했어요', { kind: 'error' }); });
}

async function renameGroupDialog(tripId, from) {
  const to = await promptDialog({ title: '그룹 이름 바꾸기', value: from });
  if (!to || to === from) return;
  await renameChecklistGroup(tripId, from, to)
    .catch((err) => { console.error(err); toast('이름을 바꾸지 못했어요', { kind: 'error' }); });
}
```

- [ ] **Step 2: trip.js에 등록**

```js
import * as checklist from './checklist.js';
const TAB_VIEWS = { planner, checklist };
```

- [ ] **Step 3: CSS 추가 (main.css 끝)**

```css
/* ---- checklist ---- */
.checklist-title { font-size: 28px; }
.checklist-page .progress { margin: -12px 0 24px; }
.checklist-groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.check-group { padding: 18px 22px; display: flex; flex-direction: column; gap: 2px; }
.check-group-head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; }
.check-group-name { font-size: 12px; font-weight: 700; color: var(--muted); letter-spacing: .5px; }
.check-group-head .btn-icon { width: 36px; height: 36px; color: var(--muted); }
.check-row { display: flex; align-items: center; gap: 12px; min-height: 44px; }
.check-row input[type=checkbox] { width: 20px; height: 20px; margin: 0; accent-color: var(--accent); }
.check-row label { flex-grow: 1; cursor: pointer; }
.check-row.done label { color: var(--muted); text-decoration: line-through; }
.check-delete { width: 36px; height: 36px; color: var(--line); opacity: 0; }
.check-row:hover .check-delete, .check-delete:focus-visible { opacity: 1; }
.check-add { color: var(--line); }
.check-add svg { width: 20px; height: 20px; flex-shrink: 0; }
.inline-input { flex-grow: 1; border: 0; background: transparent; padding: 0; font-size: 15px; }
.inline-input:focus { outline: none; }
```

- [ ] **Step 4: 브라우저 확인**

1. 체크리스트 탭 → "출발 전"(5개), "짐"(3개) 카드, `0 / 8 완료`.
2. 체크 → 취소선, 진행률과 헤더 숫자 갱신. 홈으로 가면 카드의 "체크리스트 n / 8 완료"도 갱신.
3. 항목 추가 입력에 `여행자 보험` Enter → 추가. 항목 옆 × → 삭제.
4. "그룹 추가" → `서류` → "첫 항목"이 든 그룹 생성. 연필 → 이름 바꾸기 반영. 휴지통 → 확인 → 그룹 삭제.

- [ ] **Step 5: 커밋**

```bash
git add js/views/checklist.js js/views/trip.js css/main.css
git commit -m "feat: 체크리스트 탭

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: 예약 탭과 일정 연결

**Files:**
- Create: `js/views/reservations.js`
- Modify: `js/views/trip.js` (등록), `js/views/planner.js` (예약 배지), `css/main.css`

**Interfaces:**
- Consumes: `db.watchReservations/addReservation/updateReservation/deleteReservation/watchPlaces/watchDays`
- Produces: `reservations.js`: `mount(content, ctx) → cleanup`

- [ ] **Step 1: reservations.js 작성**

```js
import { el, clear, toast, confirmDialog, icon } from '../ui.js';
import { watchReservations, addReservation, updateReservation, deleteReservation, watchPlaces, watchDays } from '../db.js';

const TYPE_LABELS = { flight: '항공', stay: '숙소', food: '식당', etc: '기타' };

export function mount(content, ctx) {
  const { tripId } = ctx;
  const state = { reservations: [], places: [], days: [] };
  const main = el('main', { class: 'container reservations-page' });
  content.append(main);
  const redraw = () => draw(main, tripId, state);
  const unsubs = [
    watchReservations(tripId, (r) => { state.reservations = r; redraw(); }, (err) => { console.error(err); toast('예약을 불러오지 못했어요', { kind: 'error' }); }),
    watchPlaces(tripId, (p) => { state.places = p; redraw(); }),
    watchDays(tripId, (d) => { state.days = d; redraw(); }),
  ];
  return () => unsubs.forEach((u) => u());
}

function placeLabel(state, placeId) {
  const place = state.places.find((p) => p.id === placeId);
  if (!place) return null;
  const dayIndex = state.days.findIndex((d) => d.id === place.dayId);
  const order = state.places.filter((p) => p.dayId === place.dayId).findIndex((p) => p.id === place.id);
  return `Day ${dayIndex + 1} · ${order + 1}번 ${place.name}`;
}

function formatDatetime(str) {
  if (!str) return '일시 미정';
  const [d, t] = str.split('T');
  const [, m, day] = d.split('-');
  return `${m}.${day}${t ? ` ${t}` : ''}`;
}

function draw(main, tripId, state) {
  clear(main);
  const sorted = [...state.reservations].sort((a, b) => String(a.datetime ?? '9').localeCompare(String(b.datetime ?? '9')));
  main.append(
    el('div', { class: 'page-head' },
      el('div', {}, el('h2', { class: 'checklist-title', text: '예약' }), el('p', { class: 'muted', text: `${sorted.length}건` })),
      el('button', { class: 'btn', onClick: () => openDialog(tripId, state) }, icon('plus'), '예약 추가')),
    el('div', { class: 'reservation-list' }, ...sorted.map((r) => card(tripId, state, r))),
    sorted.length === 0 && el('p', { class: 'muted', text: '항공, 숙소, 식당 예약을 적어 두면 여행 중에 바로 찾을 수 있어요.' }));
}

function card(tripId, state, r) {
  const linked = r.linkedPlaceId ? placeLabel(state, r.linkedPlaceId) : null;
  return el('section', { class: 'card reservation' },
    el('div', { class: 'reservation-head' },
      el('div', { class: 'reservation-title' },
        el('span', { class: 'badge badge-muted', text: TYPE_LABELS[r.type] ?? '기타' }),
        el('strong', { text: r.title || '(제목 없음)' })),
      el('div', {},
        el('span', { class: 'muted', text: formatDatetime(r.datetime) }),
        el('button', { class: 'btn btn-icon btn-sm', 'aria-label': '편집', onClick: () => openDialog(tripId, state, r) }, icon('edit')),
        el('button', {
          class: 'btn btn-icon btn-sm', 'aria-label': '삭제',
          onClick: async () => {
            if (!(await confirmDialog(`'${r.title}' 예약을 삭제할까요?`))) return;
            await deleteReservation(tripId, r.id).catch((err) => { console.error(err); toast('삭제하지 못했어요', { kind: 'error' }); });
          },
        }, icon('trash')))),
    el('div', { class: 'reservation-grid' },
      field('예약번호', r.code ? el('code', { text: r.code }) : el('span', { class: 'muted', text: '없음' })),
      field('메모', r.note || '—'),
      field('연결된 일정', linked ? el('a', { href: `#/trip/${tripId}`, class: 'link-accent', text: linked }) : '없음')));
}

function field(label, value) {
  return el('div', { class: 'stat' }, el('span', { class: 'muted', text: label }), el('span', {}, value));
}

function openDialog(tripId, state, existing = null) {
  const type = el('select', { class: 'input', id: 'rs-type' },
    ...Object.entries(TYPE_LABELS).map(([k, v]) => el('option', { value: k, selected: (existing?.type ?? 'etc') === k, text: v })));
  const title = el('input', { class: 'input', id: 'rs-title', value: existing?.title ?? '', required: true, placeholder: '예: 인천 → 간사이 KE723' });
  const datetime = el('input', { class: 'input', id: 'rs-datetime', type: 'datetime-local', value: existing?.datetime ?? '' });
  const code = el('input', { class: 'input', id: 'rs-code', value: existing?.code ?? '', placeholder: '예약번호' });
  const note = el('textarea', { class: 'input', id: 'rs-note', rows: '3', placeholder: '좌석, 체크인 시간, 주소 등' });
  note.value = existing?.note ?? '';
  const linked = el('select', { class: 'input', id: 'rs-linked' },
    el('option', { value: '', text: '연결 안 함' }),
    ...state.places.map((p) => el('option', { value: p.id, selected: existing?.linkedPlaceId === p.id, text: placeLabel(state, p.id) })));
  const dialog = el('dialog', {});
  const form = el('form', { method: 'dialog' },
    el('h2', { text: existing ? '예약 편집' : '예약 추가' }),
    el('div', { class: 'dialog-body' },
      el('div', { class: 'form-grid' },
        el('div', { class: 'field' }, el('label', { for: 'rs-type', text: '종류' }), type),
        el('div', { class: 'field' }, el('label', { for: 'rs-datetime', text: '일시' }), datetime)),
      el('div', { class: 'field' }, el('label', { for: 'rs-title', text: '제목' }), title),
      el('div', { class: 'field' }, el('label', { for: 'rs-code', text: '예약번호' }), code),
      el('div', { class: 'field' }, el('label', { for: 'rs-note', text: '메모' }), note),
      el('div', { class: 'field' }, el('label', { for: 'rs-linked', text: '연결된 일정' }), linked)),
    el('div', { class: 'dialog-actions' },
      el('button', { type: 'button', class: 'btn', onClick: () => dialog.close() }, '취소'),
      el('button', { type: 'submit', class: 'btn btn-primary' }, existing ? '저장' : '추가')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = { type: type.value, title: title.value.trim(), datetime: datetime.value || null, code: code.value.trim(), note: note.value, linkedPlaceId: linked.value || null };
    if (!data.title) { toast('제목을 입력해 주세요', { kind: 'error' }); return; }
    try {
      if (existing) await updateReservation(tripId, existing.id, data); else await addReservation(tripId, data);
      dialog.close();
    } catch (err) { console.error(err); toast('저장하지 못했어요', { kind: 'error' }); }
  });
  dialog.addEventListener('close', () => dialog.remove());
  dialog.append(form); document.body.append(dialog); dialog.showModal(); title.focus();
}
```

- [ ] **Step 2: trip.js에 등록**

```js
import * as reservations from './reservations.js';
const TAB_VIEWS = { planner, checklist, reservations };
```

- [ ] **Step 3: planner.js에 예약 배지**

`import { watchReservations } from '../db.js'` 추가(기존 db import에 합침), `state`에 `reservations: []` 추가, `unsubs` 배열에 추가:
```js
    watchReservations(tripId, (r) => { state.reservations = r; redraw(); }),
```
`timelineItem`의 `tl-meta` 안 마지막에 추가:
```js
          state.reservations.some((r) => r.linkedPlaceId === p.id) ? el('span', { class: 'badge', text: '예약' }) : null,
```

- [ ] **Step 4: CSS 추가 (main.css 끝)**

```css
/* ---- reservations ---- */
.reservation-list { display: flex; flex-direction: column; gap: 16px; }
.reservation { padding: 20px 22px; display: flex; flex-direction: column; gap: 14px; }
.reservation-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.reservation-head > div:last-child { display: flex; align-items: center; gap: 4px; font-size: 13px; }
.reservation-head .btn-icon { width: 36px; height: 36px; color: var(--muted); }
.reservation-title { display: flex; align-items: center; gap: 10px; font-size: 16px; }
.reservation-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; font-size: 13px; }
.link-accent { color: var(--accent); font-weight: 500; }
```

- [ ] **Step 5: 브라우저 확인**

1. 예약 탭 → 빈 안내. "예약 추가" → 항공, `인천 → 간사이 KE723`, 일시 2026-10-10 09:05, 예약번호 `ABC123` → 추가 → 카드.
2. 식당 예약을 만들며 "연결된 일정"에서 Day 2 장소 선택 → 카드에 "Day 2 · n번 이름" 링크. 일정 탭으로 가면 그 장소에 "예약" 배지.
3. 편집으로 연결 해제 → 배지 사라짐. 삭제 → 확인 → 사라짐. 홈 카드의 "예약 n건" 갱신.

- [ ] **Step 6: 커밋**

```bash
git add js/views/reservations.js js/views/trip.js js/views/planner.js css/main.css
git commit -m "feat: 예약 탭과 일정 연결 배지

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: 모바일 레이아웃, 사진 폴더 안내, 배포 확인

**Files:**
- Modify: `css/main.css` (반응형 블록), `README.md`
- Create: `photos/README.md`

- [ ] **Step 1: 반응형 CSS 추가 (main.css 끝)**

```css
/* ---- responsive ---- */
@media (max-width: 900px) {
  .container { padding: 20px 16px; }
  .topbar { padding: 0 16px; }
  .topbar-email { display: none; }
  .page-head { flex-direction: column; align-items: stretch; }
  .page-head h1 { font-size: 30px; }
  .trips-grid { grid-template-columns: 1fr; }
  .trip-feature { flex-direction: column; }
  .trip-feature-cover { width: 100%; min-height: 160px; height: 160px; }
  .trip-feature-body { padding: 18px; }
  .trip-title { font-size: 24px; }
  .trip-stats { flex-wrap: wrap; gap: 12px 20px; }
  .card-delete { opacity: 1; }
  .trip-header { padding: 10px 16px; }
  .trip-header h1 { font-size: 20px; }
  .tabs { width: 100%; }
  .tab { flex-grow: 1; text-align: center; padding: 8px 0; }
  .planner { flex-direction: column; height: auto; min-height: 0; }
  .planner-map { height: 240px; flex-grow: 0; order: -1; }
  .planner-panel { width: 100%; border-right: 0; overflow: visible; padding: 0 16px 96px; }
  .sheet { width: 100%; }
  .sheet-body, .sheet-head, .sheet-foot { padding-left: 16px; padding-right: 16px; }
  .checklist-groups { grid-template-columns: 1fr; }
  .check-delete { opacity: 1; }
  .reservation-grid { grid-template-columns: 1fr; }
  dialog { padding: 20px 16px; }
  .form-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: photos/README.md**

```markdown
# 사진 폴더

- 여행별 폴더: `photos/<여행 ID>/` (여행 ID는 사이트 주소 `#/trip/<여기>` 부분)
- github.com 에서 이 폴더로 들어가 "Add file → Upload files"로 올린다.
- 사이트의 장소 편집 시트에서 파일명(예: `01.jpg`)만 적으면 표시된다.
- 여행 대표 사진은 같은 폴더에 올린 뒤 Firestore `trips/<id>.coverPhoto`에 파일명을 넣는다.
```

- [ ] **Step 3: README.md 교체**

```markdown
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
- 설계: `docs/superpowers/specs/2026-09-20-travel-planner-design.md`
```

- [ ] **Step 4: 모바일 폭 확인**

브라우저를 390px 폭(`resize_window` mobile)으로: 홈 카드 세로 배치, 플래너에서 지도가 위 240px, 아래 Day 탭·타임라인, 장소 추가 시트 전체 폭, 체크리스트 한 열. 데스크톱으로 되돌린다.

- [ ] **Step 5: 전체 테스트, 커밋, 푸시**

```powershell
$env:Path += ";C:\Program Files\nodejs"; npm test
```

```bash
git add css/main.css README.md photos/README.md
git commit -m "feat: 모바일 레이아웃과 사용 안내

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 6: GitHub Pages 배포 확인**

2분 뒤 `https://y1kk3love.github.io/Travel-Log/` 열기:
1. 로그인 팝업 동작 (승인된 도메인 설정 확인).
2. 여행 생성 → 장소 추가(검색 포함) → 드래그 정렬 → 체크 토글 → 예약 연결.
3. 브라우저 다른 탭에서 같은 주소를 열어 실시간 반영 확인.
4. 개발자 도구 Network를 Offline으로 → 상단 "오프라인" 배지, 일정이 계속 보임 → Online으로 → 오프라인 중 체크한 항목이 반영됨.
5. 다른 Google 계정으로 로그인하면 "접근 권한이 없는 계정이에요" 화면 (규칙 확인은 콘솔에서 `permission-denied` 로그).
