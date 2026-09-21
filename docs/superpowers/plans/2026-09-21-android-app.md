# 안드로이드 앱 (Capacitor + GitHub Releases APK) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지금의 웹 코드를 그대로 안드로이드 APK 로 감싸고(Capacitor), 구글 지도 공유 받기·다음 목적지 로컬 알림·오프라인 내장을 붙여 GitHub Releases 에 버전별 APK 를 자동 배포한다.

**Architecture:** 웹 파일을 `dist/` 로 복사해 APK 에 내장한다. 네이티브 기능은 Capacitor 가 웹뷰에 주입하는 `window.Capacitor.registerPlugin()` 으로만 부르며(번들러 없음), 그 접근을 `js/native.js` 한 파일에 가둔다. 웹에서는 `native.*` 가 no-op 이라 기존 동작이 그대로다. 로그인만 앱에서 네이티브 구글 로그인 → Firebase `signInWithCredential` 로 우회한다. GitHub Actions 가 `v*` 태그에서 서명 APK 를 만들어 릴리스에 첨부한다.

**Tech Stack:** Capacitor 8.5 (`@capacitor/core`, `/android`, `/cli`, `/app` 8.1, `/local-notifications` 8.3), `@capacitor-firebase/authentication` 8.5, `@mindlib-capacitor/send-intent` 8.0, Firebase JS SDK 12.19 (gstatic CDN, 그대로), Node 24, GitHub Actions (ubuntu, JDK 17, Android SDK), Temurin JDK 17 (로컬, keytool 용).

**Spec:** `docs/superpowers/specs/2026-09-21-android-app-design.md`

> **구현 후 메모 (2026-09-21):** 안드로이드가 웹뷰에 주입하는 런타임에는 `registerPlugin` 이 없고 `Capacitor.Plugins.<이름>` 프록시만 있다 (registerPlugin 은 @capacitor/core 를 번들할 때만 생김). 실제 구현은 둘 다 지원한다(js/native.js). 공유 받기는 외부 send-intent 플러그인 대신 앱 자체 ShareActivity + SharePlugin 으로 바뀌었다.

## Global Constraints

- 웹 버전(GitHub Pages)은 이 작업으로 동작이 바뀌면 안 된다. 앱 전용 코드는 전부 `isNative()` 분기 뒤에 둔다.
- 번들러·트랜스파일러를 넣지 않는다. 브라우저 ES 모듈 그대로. npm 패키지는 Capacitor 네이티브 부분을 위해서만 설치한다.
- 비용 0원: Firebase Spark, Google Maps 무료 한도, 공개 저장소 Actions. 새 유료 서비스 금지.
- 패키지 이름 `io.github.y1kk3love.travellog`, 웹뷰 출처 `https://travellog.local`, 앱 이름 "여행 로그".
- 알림: 오늘·내일, 시각 있는 장소만, `출발 = 도착 − 도보 − 10분`, 최대 20개, id 는 placeId 해시.
- 새 버전 확인: 하루 1회, GitHub `releases/latest`, 실패는 무시.
- 서명 키 파일과 `dist/` 는 커밋하지 않는다. `google-services.json` 은 커밋한다(공개 가능 값).
- 테스트는 `npm test` (`node --test "tests/**/*.test.js"`). 순수 로직은 `js/lib/` 에 두고 테스트한다.

## Review Focus

1. 공유 텍스트가 링크만 있고 이름이 없을 때(`https://maps.app.goo.gl/x`) — 여행·Day 선택 후 장소 창이 열리고 "짧은 링크에는 좌표가 없어요" 안내가 떠야지, 빈 검색이나 예외가 나면 안 된다. → Task 5 테스트 `sharedTextFrom` + 수동 확인.
2. 알림 시각이 이미 지난 장소(예: 오늘 09:00 도착, 지금 11:00) — 예약하지 않아야 한다. 과거 시각을 예약하면 안드로이드가 즉시 울린다. → Task 6 테스트.
3. 웹(github.io)에서 `native.*` 를 부르면 예외 없이 no-op 이어야 한다. `window.Capacitor` 가 없을 때 `registerPlugin` 을 부르면 TypeError 가 난다. → Task 2 테스트 `tests/native.test.js`.
4. 버전 비교 `v1.10.0` 과 `v1.9.0` — 문자열 비교면 1.9 가 더 크다고 나온다. 숫자 비교여야 한다. → Task 7 테스트.
5. 태그 `v1.2.3` → `versionCode` 10203 처럼 항상 증가해야 한다. 같거나 작으면 기존 설치 위에 업데이트가 거부된다. → Task 8 테스트 `tests/android-version.test.js`.

---

### Task 1: 웹 파일을 `dist/` 로 모으는 빌드 스크립트

**Files:**
- Create: `scripts/build-web.js`
- Create: `tests/build-web.test.js`
- Modify: `.gitignore`, `package.json`

**Interfaces:**
- Produces: `node scripts/build-web.js [outDir]` — 기본 `dist/`. 복사 대상 목록을 `export const WEB_FILES` 로 노출(테스트용): `['index.html', 'manifest.webmanifest', 'favicon.svg', 'sw.js', 'css', 'js', 'icons']`. `photos/`, `tests/`, `docs/`, `android/`, `scripts/` 는 제외.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// tests/build-web.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildWeb, WEB_FILES } from '../scripts/build-web.js';

test('buildWeb: 웹 파일만 outDir 로 복사하고 테스트·문서·안드로이드는 뺀다', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-dist-'));
  const copied = buildWeb(out);
  assert.ok(fs.existsSync(path.join(out, 'index.html')));
  assert.ok(fs.existsSync(path.join(out, 'js', 'app.js')));
  assert.ok(fs.existsSync(path.join(out, 'icons', 'icon-512.png')));
  assert.ok(!fs.existsSync(path.join(out, 'tests')));
  assert.ok(!fs.existsSync(path.join(out, 'docs')));
  assert.ok(!fs.existsSync(path.join(out, 'android')));
  assert.deepEqual(copied, WEB_FILES);
  fs.rmSync(out, { recursive: true, force: true });
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/build-web.test.js`
Expected: FAIL — `Cannot find module '../scripts/build-web.js'`

- [ ] **Step 3: 스크립트 작성**

```js
// scripts/build-web.js
// 웹 파일을 dist/ 로 모은다 (Capacitor 의 webDir). 번들 없이 그대로 복사.
//   node scripts/build-web.js [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WEB_FILES = ['index.html', 'manifest.webmanifest', 'favicon.svg', 'sw.js', 'css', 'js', 'icons'];

export function buildWeb(outDir = path.join(ROOT, 'dist')) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of WEB_FILES) {
    fs.cpSync(path.join(ROOT, name), path.join(outDir, name), { recursive: true });
  }
  return WEB_FILES;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = buildWeb(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
  console.log(`dist 준비: ${out.join(', ')}`);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/build-web.test.js`
Expected: PASS

- [ ] **Step 5: gitignore 와 npm 스크립트**

`.gitignore` 에 추가:
```
dist/
*.keystore
*.jks
android/app/release/
```
`package.json` 의 `scripts` 에 추가: `"build:web": "node scripts/build-web.js"`.

- [ ] **Step 6: 전체 테스트 후 커밋**

Run: `npm test` → 전부 PASS
```bash
git add scripts/build-web.js tests/build-web.test.js .gitignore package.json
git commit -m "build: 웹 파일을 dist/ 로 모으는 스크립트 (Capacitor webDir)"
```

---

### Task 2: Capacitor 안드로이드 프로젝트와 `js/native.js`

**Files:**
- Create: `capacitor.config.json`, `js/native.js`, `tests/native.test.js`, `android/**` (생성됨)
- Modify: `package.json`, `js/app.js:1-10` (서비스 워커 분기)

**Interfaces:**
- Produces (`js/native.js`):
  - `isNative(): boolean`
  - `plugin(name): object|null` — `window.Capacitor.registerPlugin(name)` 또는 null
  - `appVersion(): Promise<string|null>` — App 플러그인 `getInfo().version`
  - `onResume(cb): () => void` — App 플러그인 `resume` 리스너, 웹이면 no-op 해제 함수
- Consumes: Task 1 의 `dist/`

- [ ] **Step 1: 실패하는 테스트 작성 (웹 환경에서 no-op)**

```js
// tests/native.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { isNative, plugin, appVersion, onResume } from '../js/native.js';

test('native: Capacitor 가 없으면(웹) 전부 조용히 no-op', async () => {
  assert.equal(isNative(), false);
  assert.equal(plugin('LocalNotifications'), null);
  assert.equal(await appVersion(), null);
  const off = onResume(() => {});
  assert.equal(typeof off, 'function');
  off();
});

test('native: Capacitor 가 있으면 registerPlugin 으로 플러그인을 얻는다', async () => {
  globalThis.window = { Capacitor: { isNativePlatform: () => true, registerPlugin: (name) => ({ name, getInfo: async () => ({ version: '1.2.3' }) }) } };
  assert.equal(isNative(), true);
  assert.equal(plugin('App').name, 'App');
  assert.equal(await appVersion(), '1.2.3');
  delete globalThis.window;
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/native.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: `js/native.js` 작성**

```js
// 네이티브(안드로이드 앱) 기능 접근을 이 파일에만 둔다. 웹에서는 전부 no-op.
// Capacitor 는 앱 웹뷰에 window.Capacitor 를 주입한다. 번들러가 없으므로 registerPlugin 으로 플러그인 프록시를 얻는다.
const cap = () => (typeof window !== 'undefined' ? window.Capacitor : undefined);

export function isNative() {
  return !!cap()?.isNativePlatform?.();
}

const cache = new Map();
export function plugin(name) {
  const c = cap();
  if (!c?.registerPlugin) return null;
  if (!cache.has(name)) cache.set(name, c.registerPlugin(name));
  return cache.get(name);
}

export async function appVersion() {
  const app = plugin('App');
  if (!app) return null;
  try { return (await app.getInfo()).version ?? null; } catch { return null; }
}

// 앱이 앞으로 돌아올 때 (공유 인텐트·알림 탭 처리용)
export function onResume(cb) {
  const app = plugin('App');
  if (!app?.addListener) return () => {};
  const handle = app.addListener('resume', cb);
  return () => { Promise.resolve(handle).then((h) => h?.remove?.()); };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/native.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Capacitor 설치와 설정**

```bash
npm install @capacitor/core@8 @capacitor/android@8 @capacitor/app@8 @capacitor/local-notifications@8 @capacitor-firebase/authentication@8 @mindlib-capacitor/send-intent@8
npm install --save-dev @capacitor/cli@8
```
(`@capacitor-firebase/authentication` 이 peer 로 `firebase` npm 을 끌어오지만 앱 코드는 CDN SDK 를 그대로 쓴다. 설치만 되고 사용하지 않는다.)

`capacitor.config.json` 생성:
```json
{
  "appId": "io.github.y1kk3love.travellog",
  "appName": "여행 로그",
  "webDir": "dist",
  "server": { "androidScheme": "https", "hostname": "travellog.local" },
  "android": { "allowMixedContent": false },
  "plugins": {
    "FirebaseAuthentication": { "skipNativeAuth": false, "providers": ["google.com"] },
    "LocalNotifications": { "smallIcon": "ic_stat_icon", "iconColor": "#B4502B" }
  }
}
```

`package.json` `scripts` 에 추가: `"cap:sync": "node scripts/build-web.js && npx cap sync android"`.

- [ ] **Step 6: 안드로이드 프로젝트 생성**

```bash
node scripts/build-web.js
npx cap add android
npx cap sync android
```
Expected: `android/` 폴더 생성, `android/app/src/main/assets/public/index.html` 존재. (로컬에 Android SDK 가 없어도 이 단계는 된다. 빌드는 CI 에서 한다.)
확인: `ls android/app/src/main/assets/public/js/app.js`

- [ ] **Step 7: 서비스 워커는 앱에서 건너뛰기**

`js/app.js` 의 서비스 워커 등록 블록을 다음으로 교체:
```js
import { isNative } from './native.js';
// 홈 화면 앱(PWA): 서비스 워커는 파일 캐시만 담당한다. 안드로이드 앱은 파일이 APK 안에 있어 등록하지 않는다.
if ('serviceWorker' in navigator && !isNative()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch((err) => console.warn('service worker 등록 실패', err));
  });
}
```

- [ ] **Step 8: 알림 아이콘 리소스**

`android/app/src/main/res/drawable/ic_stat_icon.xml` 생성 (흰색 비행기, 상태 표시줄용):
```xml
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp" android:viewportWidth="64" android:viewportHeight="64">
  <group android:rotation="45" android:pivotX="32" android:pivotY="32">
    <path android:fillColor="#FFFFFF"
        android:pathData="M50 40v-4L34 26V15c0-1.66-1.34-3-3-3s-3 1.34-3 3v11L12 36v4l16-5v11l-4 3v3l7-2 7 2v-3l-4-3V35z"/>
  </group>
</vector>
```

- [ ] **Step 9: 웹 회귀 확인과 커밋**

Run: `npm test` → PASS. 로컬 서버(`npx http-server -p 8080 -c-1 .`)에서 홈·일정이 전과 같이 뜨는지, 콘솔에 `native` 관련 오류가 없는지 확인.
```bash
git add capacitor.config.json js/native.js tests/native.test.js js/app.js package.json package-lock.json android
git commit -m "feat(android): Capacitor 프로젝트 추가, js/native.js (웹에서는 no-op)"
```

---

### Task 3: 서명 키 생성과 SHA-1 확인 (로컬, 한 번)

**Files:**
- Create (커밋 안 함): `C:\Users\y1kk3\travel-log-release.keystore`
- Create: `docs/android-signing.md` (키 보관·복구 안내, 지문은 적어도 됨)

**Interfaces:**
- Produces: keystore 파일, 별칭 `travel-log`, SHA-1/SHA-256 지문 (Task 4 Firebase 등록, Task 8 Secrets 에 사용)

- [ ] **Step 1: JDK 설치 (keytool)**

PowerShell:
```powershell
winget install --id EclipseAdoptium.Temurin.17.JDK -e --accept-package-agreements --accept-source-agreements
```
새 셸에서 `keytool -help` 가 동작하는지 확인. PATH 에 없으면 `C:\Program Files\Eclipse Adoptium\jdk-17*\bin\keytool.exe` 를 직접 쓴다.

- [ ] **Step 2: 키 생성**

비밀번호는 사용자가 정한다(이 문서에 적지 않는다). 저장소 밖 경로에 만든다.
```powershell
keytool -genkeypair -v -keystore "$HOME\travel-log-release.keystore" -alias travel-log -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Travel Log, OU=y1kk3love, O=y1kk3love, L=Seoul, C=KR"
```

- [ ] **Step 3: 지문 확인**

```powershell
keytool -list -v -keystore "$HOME\travel-log-release.keystore" -alias travel-log
```
Expected: `SHA1:` 과 `SHA256:` 줄. 두 값을 Task 4 에서 쓴다.

- [ ] **Step 4: 안내 문서 작성과 커밋**

`docs/android-signing.md`:
```markdown
# 안드로이드 서명 키

- 파일: `~/travel-log-release.keystore` (저장소 밖, 커밋 금지), 별칭 `travel-log`
- 이 키로 서명한 APK 만 기존 설치 위에 업데이트할 수 있다. 키를 잃으면 사용자가 앱을 지우고 다시 설치해야 한다.
- 백업: 키 파일과 비밀번호를 비밀번호 관리자 또는 외부 드라이브에 따로 보관한다.
- GitHub Secrets: `ANDROID_KEYSTORE_BASE64`(파일 base64), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`(=travel-log), `ANDROID_KEY_PASSWORD`
- SHA-1 지문은 Firebase 콘솔(안드로이드 앱)에 등록되어 있다. 키를 바꾸면 지문도 다시 등록한다.
```
```bash
git add docs/android-signing.md
git commit -m "docs: 안드로이드 서명 키 보관 안내"
```

---

### Task 4: 네이티브 구글 로그인

**Files:**
- Modify: `js/auth.js`, `js/native.js`, `android/build.gradle`, `android/app/build.gradle`, `android/variables.gradle`
- Create: `android/app/google-services.json` (Firebase 콘솔에서 내려받음)

**Interfaces:**
- Consumes: Task 3 의 SHA-1 지문, Task 2 의 `plugin()`
- Produces (`js/native.js`): `googleIdToken(): Promise<string|null>` — 네이티브 구글 로그인 후 ID 토큰, 취소면 null; `nativeSignOut(): Promise<void>`

- [ ] **Step 1: Firebase 콘솔에 안드로이드 앱 등록**

브라우저 창(Firebase 콘솔 로그인 상태)에서: 프로젝트 설정 → 내 앱 → 앱 추가 → Android.
- 패키지 이름: `io.github.y1kk3love.travellog`
- 앱 닉네임: `여행 로그 Android`
- 디버그 서명 인증서 SHA-1: Task 3 의 SHA-1
- 등록 후 `google-services.json` 다운로드 → `android/app/google-services.json` 에 저장. SDK 추가 단계는 건너뛴다(아래 gradle 에서 처리).
- 프로젝트 설정 → 내 앱 → 이 안드로이드 앱 → "디지털 지문 추가" 로 SHA-256 도 추가.
- Authentication → Sign-in method → Google 이 이미 켜져 있는지 확인(웹에서 쓰고 있음). 설정 → 승인된 도메인에 `travellog.local` 추가.

확인: `node -e "const j=require('./android/app/google-services.json');console.log(j.client[0].client_info.android_client_info.package_name)"` → `io.github.y1kk3love.travellog`

- [ ] **Step 2: gradle 설정**

`android/build.gradle` 의 `buildscript { dependencies { ... } }` 안에 추가:
```gradle
        classpath 'com.google.gms:google-services:4.4.2'
```
`android/app/build.gradle` 맨 아래(기존 `apply from: 'capacitor.build.gradle'` 다음)에 추가:
```gradle
apply plugin: 'com.google.gms.google-services'
```
`android/variables.gradle` 의 `ext { ... }` 안에 추가:
```gradle
    rgcfaIncludeGoogle = true
    androidxCredentialsVersion = '1.3.0'
```
Run: `npx cap sync android` → 오류 없이 끝나야 한다.

- [ ] **Step 3: `js/native.js` 에 로그인 함수 추가**

```js
// 앱 안 웹뷰에서는 구글 OAuth 팝업이 막혀서(disallowed_useragent) 네이티브 로그인으로 ID 토큰만 받는다.
export async function googleIdToken() {
  const fa = plugin('FirebaseAuthentication');
  if (!fa) return null;
  try {
    const result = await fa.signInWithGoogle();
    return result?.credential?.idToken ?? null;
  } catch (err) {
    if (/cancel/i.test(String(err?.message ?? err))) return null;
    throw err;
  }
}

export async function nativeSignOut() {
  const fa = plugin('FirebaseAuthentication');
  if (!fa) return;
  try { await fa.signOut(); } catch (err) { console.warn('native signOut', err); }
}
```

- [ ] **Step 4: `js/auth.js` 분기**

```js
import { GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut as firebaseSignOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { auth } from './firebase.js';
import { OWNER_UID } from './firebase-config.js';
import { isNative, googleIdToken, nativeSignOut } from './native.js';

export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

// 웹: 팝업 (리디렉트는 authDomain 불일치로 결과를 잃는다). 앱: 네이티브 구글 로그인 → 같은 Firebase 계정으로 signInWithCredential.
export async function signIn() {
  if (isNative()) {
    const idToken = await googleIdToken();
    if (!idToken) return; // 취소
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return;
  }
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
    if (err.code === 'auth/popup-blocked') {
      const e = new Error('팝업이 차단됐어요. 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요');
      e.code = err.code;
      throw e;
    }
    throw err;
  }
}

export async function signOut() {
  await nativeSignOut();
  return firebaseSignOut(auth);
}

export function isOwner(user) {
  return !!user && OWNER_UID !== '' && user.uid === OWNER_UID;
}
```

- [ ] **Step 5: 웹 회귀 확인과 커밋**

Run: `npm test` → PASS. 로컬 서버에서 로그아웃 → 로그인 버튼이 전처럼 팝업을 여는지 확인(팝업 클릭은 사용자가).
```bash
git add js/auth.js js/native.js android/build.gradle android/app/build.gradle android/variables.gradle android/app/google-services.json
git commit -m "feat(android): 네이티브 구글 로그인 → Firebase signInWithCredential"
```

---

### Task 5: 구글 지도 공유 받기

**Files:**
- Create: `js/lib/share.js`, `tests/share.test.js`, `js/views/share.js`
- Modify: `js/native.js`, `js/router.js`, `js/app.js`, `js/views/planner.js`, `android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Produces (`js/lib/share.js`): `sharedTextFrom(result): string|null` — send-intent 결과 `{title, description, url, type}` 를 하나의 텍스트로. 텍스트가 없으면 null.
- Produces (`js/native.js`): `takeSharedText(): Promise<string|null>` — 대기 중인 공유 텍스트를 꺼내고 인텐트를 닫는다. `onShareReceived(cb)` — 앱이 이미 켜져 있을 때 `sendIntentReceived` 이벤트.
- Produces (`js/router.js`): 라우트 `{ name: 'share' }` (`#/share`).
- Produces (모듈 상태 `js/share-state.js` 대신 `js/views/share.js` 내부 export): `setPendingShare(text)`, `takePendingShare(): string|null`.
- Consumes: `openPlaceSheet` 의 검색창 붙여넣기 흐름(`place-sheet.js` 의 `applyPastedCoords`), planner 의 `ctx.placeId` 처럼 `ctx.sharedText` 를 받는다.

- [ ] **Step 1: 실패하는 테스트**

```js
// tests/share.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedTextFrom } from '../js/lib/share.js';

test('sharedTextFrom: 제목·설명·URL 을 합쳐 한 텍스트로 (중복·빈 값 제거)', () => {
  assert.equal(sharedTextFrom({ title: '센소지 · 도쿄', url: 'https://maps.app.goo.gl/abc', type: 'text/plain' }), '센소지 · 도쿄\nhttps://maps.app.goo.gl/abc');
  assert.equal(sharedTextFrom({ title: 'https://maps.app.goo.gl/abc', url: 'https://maps.app.goo.gl/abc' }), 'https://maps.app.goo.gl/abc');
  assert.equal(sharedTextFrom({ description: '35.71, 139.79' }), '35.71, 139.79');
});

test('sharedTextFrom: 텍스트가 아니거나 비어 있으면 null', () => {
  assert.equal(sharedTextFrom(null), null);
  assert.equal(sharedTextFrom({ type: 'image/jpeg', url: 'content://x' }), null);
  assert.equal(sharedTextFrom({ title: '   ' }), null);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/share.test.js` → FAIL (module not found)

- [ ] **Step 3: `js/lib/share.js`**

```js
// send-intent 플러그인 결과를 붙여넣기 로직이 이해하는 한 덩어리 텍스트로 (순수 함수)
export function sharedTextFrom(result) {
  if (!result || typeof result !== 'object') return null;
  if (result.type && !/^text\//.test(result.type)) return null;
  const parts = [];
  for (const key of ['title', 'description', 'url']) {
    const v = String(result[key] ?? '').trim();
    if (v && !parts.includes(v)) parts.push(v);
  }
  return parts.length ? parts.join('\n') : null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/share.test.js` → PASS

- [ ] **Step 5: `js/native.js` 에 공유 함수 추가**

```js
import { sharedTextFrom } from './lib/share.js';

// 공유 시트로 들어온 텍스트를 꺼낸다 (없으면 null). 꺼낸 뒤 인텐트 액티비티를 닫는다.
export async function takeSharedText() {
  const si = plugin('SendIntent');
  if (!si) return null;
  try {
    const result = await si.checkSendIntentReceived();
    const text = sharedTextFrom(result);
    if (text) si.finish?.().catch?.(() => {});
    return text;
  } catch { return null; }
}

// 앱이 이미 켜진 채로 공유가 들어올 때
export function onShareReceived(cb) {
  if (!isNative() || typeof window === 'undefined') return () => {};
  const handler = () => cb();
  window.addEventListener('sendIntentReceived', handler);
  return () => window.removeEventListener('sendIntentReceived', handler);
}
```

- [ ] **Step 6: AndroidManifest 인텐트 필터**

`android/app/src/main/AndroidManifest.xml` 의 `<application>` 안, 기존 `MainActivity` 다음에 추가:
```xml
        <activity
            android:name="de.mindlib.sendIntent.SendIntentActivity"
            android:label="@string/app_name"
            android:exported="true"
            android:theme="@style/AppTheme.NoActionBar">
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="text/plain" />
            </intent-filter>
        </activity>
```
(사진·파일 공유는 받지 않는다: `text/plain` 만.)

- [ ] **Step 7: 라우터에 `share` 추가**

`js/router.js` 의 `parseHash` 를 다음으로:
```js
export function parseHash(hash) {
  const parts = String(hash || '').replace(/^#/, '').split('/').filter(Boolean);
  if (parts[0] === 'share') return { name: 'share' };
  if (parts[0] === 'trip' && parts[1]) {
    const tab = TABS.includes(parts[2]) ? parts[2] : 'planner';
    const route = { name: 'trip', tripId: parts[1], tab };
    if (tab === 'planner' && parts[2] === 'planner' && parts[3]) route.placeId = parts[3];
    return route;
  }
  return { name: 'trips' };
}
```
`tests/router.test.js` 에 한 줄 추가: `assert.deepEqual(parseHash('#/share'), { name: 'share' });`

- [ ] **Step 8: 공유 화면 `js/views/share.js`**

```js
import { el, clear, toast, icon } from '../ui.js';
import { topbar } from './topbar.js';
import { watchTrips, watchDays } from '../db.js';
import { tripStatus, formatStatus, formatRange, formatShort, toDateStr } from '../lib/dates.js';
import { navigate } from '../router.js';

// 공유로 들어온 텍스트는 메모리에만 둔다 (라우트를 오가도 유지, 새로고침이면 사라짐)
let pending = null;
export function setPendingShare(text) { pending = text; }
export function takePendingShare() { const t = pending; pending = null; return t; }
export function peekPendingShare() { return pending; }
// 장소 창을 열 때 planner 가 꺼내 쓴다: { tripId, dayId(null=보관함), text }
let target = null;
export function takeShareTarget() { const t = target; target = null; return t; }

export function render(container) {
  const text = peekPendingShare();
  const main = el('main', { class: 'container share-page' });
  container.append(topbar({ backHref: '#/' }), main);
  if (!text) { toast('공유된 내용이 없어요'); navigate('/'); return () => {}; }
  let unsubDays = null;
  const unsub = watchTrips((trips) => drawTrips(main, trips, text), (err) => { console.error(err); toast('여행 목록을 불러오지 못했어요', { kind: 'error' }); });

  function drawTrips(root, trips, sharedText) {
    clear(root);
    const today = toDateStr(new Date());
    const sorted = [...trips].map((t) => ({ ...t, status: tripStatus(t.startDate, t.endDate, today) }))
      .sort((a, b) => (a.status.kind === 'after') - (b.status.kind === 'after') || a.startDate.localeCompare(b.startDate));
    root.append(
      el('div', { class: 'page-head' }, el('div', {}, el('h2', { class: 'checklist-title', text: '어느 여행에 넣을까요?' }),
        el('p', { class: 'muted', text: sharedText.split('\n')[0].slice(0, 60) }))),
      el('div', { class: 'share-list' }, ...sorted.map((t) => el('button', { class: 'card share-trip', onClick: () => drawDays(root, t, sharedText) },
        el('strong', { text: t.title }), el('span', { class: 'muted', text: `${formatRange(t.startDate, t.endDate)} · ${formatStatus(t.status)}` })))));
  }

  function drawDays(root, trip, sharedText) {
    if (unsubDays) unsubDays();
    unsubDays = watchDays(trip.id, (days) => {
      clear(root);
      const go = (dayId) => { target = { tripId: trip.id, dayId, text: sharedText }; takePendingShare(); navigate(`/trip/${trip.id}`); };
      root.append(
        el('div', { class: 'page-head' }, el('div', {}, el('h2', { class: 'checklist-title', text: trip.title }), el('p', { class: 'muted', text: '어느 날에 넣을까요?' })),
          el('button', { class: 'btn btn-sm', onClick: () => drawTrips(root, [trip], sharedText) }, icon('back'), '여행 다시 고르기')),
        el('div', { class: 'share-list' },
          ...days.map((d, i) => el('button', { class: 'card share-trip', onClick: () => go(d.id) }, el('strong', { text: `Day ${i + 1}` }), el('span', { class: 'muted', text: formatShort(d.date) }))),
          el('button', { class: 'card share-trip', onClick: () => go(null) }, el('strong', { text: '보관함' }), el('span', { class: 'muted', text: '날짜 미정' }))));
    });
  }
  return () => { unsub(); if (unsubDays) unsubDays(); };
}
```
CSS(`css/main.css` 끝에):
```css
.share-list { display: flex; flex-direction: column; gap: 10px; }
.share-trip { text-align: left; padding: 14px 18px; display: flex; flex-direction: column; gap: 4px; cursor: pointer; }
```

- [ ] **Step 9: `js/app.js` 진입 처리와 planner 연결**

`js/app.js`: `startRouter({ trips: tripsView, trip: tripView, share: shareView }, app)` 로 뷰 등록(`import * as shareView from './views/share.js'`). `renderApp(user)` 안, 라우터 시작 후:
```js
  // 공유 시트로 열렸으면 여행 선택 화면으로 (앱 전용)
  const goShare = async () => {
    const text = await takeSharedText();
    if (text) { setPendingShare(text); navigate('/share'); }
  };
  goShare();
  onShareReceived(goShare);
  onResume(goShare);
```
(`takeSharedText`, `onShareReceived`, `onResume` 은 `./native.js`, `setPendingShare` 는 `./views/share.js`, `navigate` 는 `./router.js` 에서 import.)

`js/views/planner.js` 의 `mount` 끝부분(리스너 등록 뒤)에:
```js
  // 공유 화면에서 넘어왔으면 장소 추가 창을 열고 공유 텍스트를 검색창에 붙여넣는다
  const share = takeShareTarget();
  if (share && share.tripId === tripId) {
    state.selectedDayId = share.dayId ?? state.selectedDayId;
    setTimeout(() => openSheet({ dayId: share.dayId, sharedText: share.text }), 300);
  }
```
`openSheet` 는 `sharedText` 를 `openPlaceSheet({ ..., sharedText })` 로 넘기고, `place-sheet.js` 는 마지막 줄 근처에서:
```js
  if (sharedText) { search.value = sharedText; setTimeout(() => applyPastedCoords(sharedText), 0); }
```
(`openPlaceSheet` 시그니처에 `sharedText = null` 추가. `takeShareTarget` 는 `./share.js` 에서 import.)

- [ ] **Step 10: 테스트·회귀 확인·커밋**

Run: `npm test` → PASS. 로컬 서버에서 `#/share` 로 직접 가면 "공유된 내용이 없어요" 토스트 후 홈으로 가는지 확인. 브라우저 콘솔에서 `(await import('./js/views/share.js')).setPendingShare('센소지 · 도쿄\nhttps://maps.app.goo.gl/x'); location.hash='#/share'` 로 여행→Day 선택→장소 창에 "센소지" 검색이 뜨는지 확인.
```bash
git add js/lib/share.js tests/share.test.js js/views/share.js js/native.js js/router.js tests/router.test.js js/app.js js/views/planner.js js/views/place-sheet.js css/main.css android/app/src/main/AndroidManifest.xml
git commit -m "feat(android): 구글 지도 공유 받기 → 여행·Day 선택 → 장소 추가"
```

---

### Task 6: 다음 목적지 로컬 알림

**Files:**
- Create: `js/lib/alarms.js`, `tests/alarms.test.js`, `js/alarms.js`
- Modify: `js/native.js`, `js/app.js`, `js/views/planner.js`, `js/views/usage-dialog.js`

**Interfaces:**
- Produces (`js/lib/alarms.js`):
  - `planAlarms({ trips, placesByTrip, daysByTrip }, now: Date) → [{ id, tripId, placeId, at: number(ms), title, body }]`
  - `alarmId(placeId): number` — 안정적 양의 정수 해시
- Produces (`js/native.js`): `scheduleNotifications(list)`, `cancelAllNotifications()`, `onNotificationTap(cb)` — 웹이면 no-op.
- Produces (`js/alarms.js`): `refreshAlarms()` — 로그인한 사용자의 여행 전부를 읽어 예약을 다시 만든다(디바운스 2초). `alarmsStatus()` → `'granted'|'denied'|'unavailable'`.
- Consumes: `estimateTimes`, `routeBetween` (`js/lib/timeline.js`), `distanceKm/walkMinutes/hasCoords` (`js/lib/geo.js`), `toDateStr/addDays` (`js/lib/dates.js`).

- [ ] **Step 1: 실패하는 테스트**

```js
// tests/alarms.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { planAlarms, alarmId } from '../js/lib/alarms.js';

const now = new Date('2026-09-21T09:00:00+09:00');
const trip = { id: 't1', title: '도쿄', startDate: '2026-09-20', endDate: '2026-09-23' };
const days = [{ id: 'd1', date: '2026-09-21', order: 0 }, { id: 'd2', date: '2026-09-22', order: 1 }, { id: 'd0', date: '2026-09-20', order: -1 }];
const places = [
  { id: 'p1', dayId: 'd1', name: '우에노', time: '08:30', lat: 35.7141, lng: 139.7774, order: 0 },          // 지남
  { id: 'p2', dayId: 'd1', name: '센소지', time: '10:00', lat: 35.7148, lng: 139.7967, order: 1 },          // 도보 ~24분 → 09:26
  { id: 'p3', dayId: 'd1', name: '메모', category: 'note', time: '11:00', order: 2 },                        // 제외
  { id: 'p4', dayId: 'd2', name: '스카이트리', time: '13:00', lat: 35.7101, lng: 139.8107, order: 0 },      // 내일 첫 장소 → 12:50
  { id: 'p5', dayId: 'd0', name: '어제', time: '10:00', lat: 35.7, lng: 139.7, order: 0 },                  // 어제 → 제외
];

test('planAlarms: 오늘·내일, 시각 있는 장소만, 출발 = 도착 − 도보 − 10분, 지난 것 제외', () => {
  const out = planAlarms({ trips: [trip], placesByTrip: { t1: places }, daysByTrip: { t1: days } }, now);
  assert.deepEqual(out.map((a) => [a.placeId, new Date(a.at).toISOString()]), [
    ['p2', new Date('2026-09-21T09:26:00+09:00').toISOString()],
    ['p4', new Date('2026-09-22T12:50:00+09:00').toISOString()],
  ]);
  assert.equal(out[0].title, '곧 출발: 센소지');
  assert.match(out[0].body, /10:00 도착 예정 · 도보 \d+분/);
  assert.equal(out[1].body, '13:00 예정');
  assert.equal(out[0].tripId, 't1');
});

test('planAlarms: 저장된 구글 도보 시간이 있으면 그걸 쓰고, 20개를 넘지 않는다', () => {
  const p1 = { ...places[0], time: '09:30' }; // 아직 안 지남
  const p2 = { ...places[1], time: '10:00' };
  p1.routeToNext = { key: `${p1.lat.toFixed(5)},${p1.lng.toFixed(5)}>${p2.lat.toFixed(5)},${p2.lng.toFixed(5)}`, encoded: 'x', seconds: 15 * 60, meters: 1000, at: now.getTime() };
  const out = planAlarms({ trips: [trip], placesByTrip: { t1: [p1, p2] }, daysByTrip: { t1: days } }, now);
  assert.equal(new Date(out.find((a) => a.placeId === 'p2').at).toISOString(), new Date('2026-09-21T09:35:00+09:00').toISOString());
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, dayId: 'd2', name: `m${i}`, time: `${String(8 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`, lat: 35.7, lng: 139.8, order: i }));
  assert.equal(planAlarms({ trips: [trip], placesByTrip: { t1: many }, daysByTrip: { t1: days } }, now).length, 20);
});

test('alarmId: 같은 placeId 는 같은 양의 정수, 다른 id 는 다르다', () => {
  assert.equal(alarmId('abc'), alarmId('abc'));
  assert.notEqual(alarmId('abc'), alarmId('abd'));
  assert.ok(Number.isInteger(alarmId('abc')) && alarmId('abc') > 0 && alarmId('abc') < 2 ** 31);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/alarms.test.js` → FAIL (module not found)

- [ ] **Step 3: `js/lib/alarms.js`**

```js
// 다음 목적지 알림 계산 (순수 함수). 오늘·내일 Day 의 시각 있는 장소마다 "출발 시각"을 만든다.
import { estimateTimes, routeBetween } from './timeline.js';
import { hasCoords, distanceKm, walkMinutes } from './geo.js';
import { toDateStr, addDays } from './dates.js';

const LEAD_MIN = 10;
const MAX_ALARMS = 20;

export function alarmId(placeId) {
  let h = 2166136261;
  for (const ch of String(placeId)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return (h % 2147483646) + 1;
}

function atLocal(dateStr, hhmm) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

export function planAlarms({ trips, placesByTrip, daysByTrip }, now = new Date()) {
  const today = toDateStr(now);
  const tomorrow = addDays(today, 1);
  const out = [];
  for (const trip of trips) {
    const days = (daysByTrip[trip.id] ?? []).filter((d) => d.date === today || d.date === tomorrow);
    for (const day of days) {
      const places = (placesByTrip[trip.id] ?? []).filter((p) => p.dayId === day.id).sort((a, b) => a.order - b.order);
      const times = estimateTimes(places, now.getTime());
      let prev = null;
      places.forEach((p, i) => {
        if (p.category === 'note') return;
        const t = times[i]?.time;
        if (!t) { prev = p; return; }
        let walk = 0;
        if (prev && hasCoords(prev) && hasCoords(p)) {
          const route = routeBetween(prev, p, now.getTime());
          walk = route && Number.isFinite(route.seconds) ? Math.ceil(route.seconds / 60) : (distanceKm(prev, p) > 0.01 ? walkMinutes(distanceKm(prev, p)) : 0);
        }
        const at = atLocal(day.date, t) - (walk + LEAD_MIN) * 60000;
        if (at > now.getTime()) {
          out.push({
            id: alarmId(p.id), tripId: trip.id, placeId: p.id, at,
            title: `곧 출발: ${p.name || '(이름 없음)'}`,
            body: prev && walk > 0 ? `${t} 도착 예정 · 도보 ${walk}분` : `${t} 예정`,
          });
        }
        prev = p;
      });
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, MAX_ALARMS);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/alarms.test.js` → PASS (3 tests). `lib/dates.js` 에 `addDays(dateStr, n)` 가 있는지 확인(있음: `db.js` 가 import 함).

- [ ] **Step 5: `js/native.js` 알림 함수**

```js
export async function notificationPermission() {
  const ln = plugin('LocalNotifications');
  if (!ln) return 'unavailable';
  try {
    let { display } = await ln.checkPermissions();
    if (display === 'prompt' || display === 'prompt-with-rationale') ({ display } = await ln.requestPermissions());
    return display === 'granted' ? 'granted' : 'denied';
  } catch { return 'unavailable'; }
}

export async function cancelAllNotifications() {
  const ln = plugin('LocalNotifications');
  if (!ln) return;
  try {
    const { notifications } = await ln.getPending();
    if (notifications?.length) await ln.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
  } catch (err) { console.warn('cancel notifications', err); }
}

// list: planAlarms() 결과
export async function scheduleNotifications(list) {
  const ln = plugin('LocalNotifications');
  if (!ln || !list.length) return;
  await ln.schedule({
    notifications: list.map((a) => ({
      id: a.id, title: a.title, body: a.body,
      schedule: { at: new Date(a.at), allowWhileIdle: true },
      extra: { tripId: a.tripId, placeId: a.placeId },
    })),
  });
}

export function onNotificationTap(cb) {
  const ln = plugin('LocalNotifications');
  if (!ln?.addListener) return () => {};
  const handle = ln.addListener('localNotificationActionPerformed', (e) => cb(e?.notification?.extra ?? {}));
  return () => { Promise.resolve(handle).then((h) => h?.remove?.()); };
}
```

- [ ] **Step 6: `js/alarms.js` (예약 갱신)**

```js
// 앱 전용: 내 여행 전부를 읽어 오늘·내일 알림을 다시 예약한다. 웹에서는 아무것도 하지 않는다.
import { isNative, notificationPermission, cancelAllNotifications, scheduleNotifications } from './native.js';
import { watchTrips, watchDays, watchPlaces } from './db.js';
import { planAlarms } from './lib/alarms.js';

let status = 'unavailable';
export function alarmsStatus() { return status; }

const once = (fn) => new Promise((res, rej) => { const stop = fn((v) => { stop(); res(v); }, rej); });
let timer = null;

export function refreshAlarms() {
  if (!isNative()) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      status = await notificationPermission();
      if (status !== 'granted') return;
      const trips = await once((cb, err) => watchTrips(cb, err));
      const placesByTrip = {}, daysByTrip = {};
      for (const t of trips) {
        [placesByTrip[t.id], daysByTrip[t.id]] = await Promise.all([once((cb, err) => watchPlaces(t.id, cb, err)), once((cb, err) => watchDays(t.id, cb, err))]);
      }
      const plan = planAlarms({ trips, placesByTrip, daysByTrip }, new Date());
      await cancelAllNotifications();
      await scheduleNotifications(plan);
      console.info(`알림 ${plan.length}개 예약`);
    } catch (err) { console.warn('refreshAlarms', err); }
  }, 2000);
}
```

- [ ] **Step 7: 호출 지점**

- `js/app.js` `renderApp(user)` 안: `refreshAlarms();` 와 `onNotificationTap(({ tripId, placeId }) => { if (tripId) navigate(placeId ? \`/trip/${tripId}/planner/${placeId}\` : \`/trip/${tripId}\`); });` 그리고 `onResume(() => refreshAlarms())`.
- `js/views/planner.js`: `watchPlaces` 와 `watchDays` 콜백 끝에 `refreshAlarms();` 한 줄씩(웹이면 즉시 return).
- `js/views/usage-dialog.js`: 본문 끝에 상태 한 줄 — `alarmsStatus()` 가 `'denied'` 면 "알림이 꺼져 있어요. 폰 설정 → 앱 → 여행 로그 → 알림에서 켜 주세요", `'granted'` 면 "다음 목적지 알림 켜짐", `'unavailable'`(웹) 이면 표시 안 함. 앱 버전도 여기 표시: `appVersion().then((v) => v && versionEl.textContent = \`앱 버전 ${v}\`)`.

- [ ] **Step 8: 테스트·커밋**

Run: `npm test` → PASS. 로컬 서버에서 일정 화면이 전처럼 뜨고 콘솔 오류가 없는지 확인.
```bash
git add js/lib/alarms.js tests/alarms.test.js js/alarms.js js/native.js js/app.js js/views/planner.js js/views/usage-dialog.js
git commit -m "feat(android): 다음 목적지 로컬 알림 (출발 = 도착 − 도보 − 10분, 오늘·내일)"
```

---

### Task 7: 새 버전 확인 배너

**Files:**
- Create: `js/lib/version.js`, `tests/version.test.js`, `js/update-check.js`
- Modify: `js/app.js`, `css/main.css`

**Interfaces:**
- Produces (`js/lib/version.js`): `parseVersion('v1.2.3') → [1,2,3]|null`, `isNewer(a, b) → boolean` (a 가 b 보다 새로움), `pickApk(assets) → url|null` (`.apk` 로 끝나는 첫 자산의 `browser_download_url`).
- Produces (`js/update-check.js`): `checkForUpdate()` — 앱에서만, 하루 1회, 배너 DOM 을 `#app` 위에 붙인다.
- Consumes: `appVersion()` (Task 2).

- [ ] **Step 1: 실패하는 테스트**

```js
// tests/version.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVersion, isNewer, pickApk } from '../js/lib/version.js';

test('parseVersion / isNewer: 숫자 비교 (1.10.0 > 1.9.0), v 접두어 허용', () => {
  assert.deepEqual(parseVersion('v1.2.3'), [1, 2, 3]);
  assert.deepEqual(parseVersion('1.2'), [1, 2, 0]);
  assert.equal(parseVersion('abc'), null);
  assert.equal(isNewer('v1.10.0', '1.9.0'), true);
  assert.equal(isNewer('1.9.0', 'v1.10.0'), false);
  assert.equal(isNewer('1.0.0', '1.0.0'), false);
  assert.equal(isNewer('x', '1.0.0'), false);
});

test('pickApk: 릴리스 자산에서 .apk 를 고른다', () => {
  assert.equal(pickApk([{ name: 'notes.txt', browser_download_url: 'a' }, { name: 'travel-log-1.0.0.apk', browser_download_url: 'b' }]), 'b');
  assert.equal(pickApk([]), null);
});
```

- [ ] **Step 2: 실패 확인** — Run: `node --test tests/version.test.js` → FAIL

- [ ] **Step 3: `js/lib/version.js`**

```js
export function parseVersion(s) {
  const m = String(s ?? '').trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  return m ? [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)] : null;
}

export function isNewer(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] > y[i]; }
  return false;
}

export function pickApk(assets) {
  return (assets ?? []).find((a) => /\.apk$/i.test(a.name ?? ''))?.browser_download_url ?? null;
}
```

- [ ] **Step 4: 통과 확인** — Run: `node --test tests/version.test.js` → PASS

- [ ] **Step 5: `js/update-check.js`**

```js
// 앱 전용: GitHub 최신 릴리스와 앱 버전을 비교해 새 버전 배너를 띄운다. 하루 1회, 실패는 무시.
import { isNative, appVersion } from './native.js';
import { isNewer, pickApk } from './lib/version.js';
import { el } from './ui.js';

const API = 'https://api.github.com/repos/y1kk3love/Travel-Log/releases/latest';
const STAMP = 'tl.update.checkedAt';
const SKIP = 'tl.update.skip';

export async function checkForUpdate() {
  if (!isNative()) return;
  try {
    const last = Number(localStorage.getItem(STAMP) || 0);
    if (Date.now() - last < 24 * 3600 * 1000) return;
    localStorage.setItem(STAMP, String(Date.now()));
    const res = await fetch(API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return;
    const rel = await res.json();
    const current = await appVersion();
    if (!current || !isNewer(rel.tag_name, current)) return;
    if (sessionStorage.getItem(SKIP) === rel.tag_name) return;
    const url = pickApk(rel.assets) ?? rel.html_url;
    const banner = el('div', { class: 'update-banner' },
      el('span', { text: `새 버전 ${rel.tag_name}이 나왔어요` }),
      el('a', { class: 'btn btn-sm btn-primary', href: url, target: '_blank', rel: 'noopener', text: '받기' }),
      el('button', { class: 'btn btn-sm btn-ghost', onClick: () => { sessionStorage.setItem(SKIP, rel.tag_name); banner.remove(); } }, '다음에'));
    document.body.prepend(banner);
  } catch (err) { console.warn('update check', err); }
}
```
CSS: `.update-banner { position: sticky; top: 0; z-index: 900; display: flex; align-items: center; gap: 10px; padding: 8px 16px; background: var(--accent); color: var(--accent-ink); font-size: 14px; } .update-banner span { flex-grow: 1; }`

- [ ] **Step 6: 호출** — `js/app.js` `renderApp` 에서 `checkForUpdate();`.

- [ ] **Step 7: 테스트·커밋**

Run: `npm test` → PASS.
```bash
git add js/lib/version.js tests/version.test.js js/update-check.js js/app.js css/main.css
git commit -m "feat(android): 새 버전 확인 배너 (GitHub 최신 릴리스, 하루 1회)"
```

---

### Task 8: 서명 빌드와 GitHub Actions 릴리스

**Files:**
- Create: `scripts/android-version.js`, `tests/android-version.test.js`, `.github/workflows/android-release.yml`
- Modify: `android/app/build.gradle` (signingConfigs), `README.md`

**Interfaces:**
- Produces: `versionCodeFor('v1.2.3') → 10203`, `applyAndroidVersion(tag, gradlePath)` — `versionName "1.2.3"`, `versionCode 10203` 으로 치환.
- Consumes: Task 3 의 키·비밀번호(Secrets), Task 1 의 `build-web`.

- [ ] **Step 1: 실패하는 테스트**

```js
// tests/android-version.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { versionCodeFor, applyAndroidVersion } from '../scripts/android-version.js';

test('versionCodeFor: major*10000 + minor*100 + patch, 항상 증가', () => {
  assert.equal(versionCodeFor('v1.2.3'), 10203);
  assert.equal(versionCodeFor('1.0.0'), 10000);
  assert.ok(versionCodeFor('v1.10.0') > versionCodeFor('v1.9.9'));
  assert.throws(() => versionCodeFor('v1.2.345'), /patch/);
  assert.throws(() => versionCodeFor('nope'), /형식/);
});

test('applyAndroidVersion: build.gradle 의 versionName/versionCode 를 바꾼다', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tl-gradle-')), 'build.gradle');
  fs.writeFileSync(f, 'android {\n    defaultConfig {\n        versionCode 1\n        versionName "1.0"\n    }\n}\n');
  applyAndroidVersion('v2.3.4', f);
  const s = fs.readFileSync(f, 'utf8');
  assert.match(s, /versionCode 20304/);
  assert.match(s, /versionName "2\.3\.4"/);
});
```

- [ ] **Step 2: 실패 확인** — Run: `node --test tests/android-version.test.js` → FAIL

- [ ] **Step 3: `scripts/android-version.js`**

```js
// 태그(v1.2.3)에서 안드로이드 versionName/versionCode 를 정해 build.gradle 에 적는다. CI 가 부른다.
//   node scripts/android-version.js v1.2.3
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function versionCodeFor(tag) {
  const m = String(tag).trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!m) throw new Error(`태그 형식이 vX.Y.Z 가 아니에요: ${tag}`);
  const [major, minor, patch] = m.slice(1).map(Number);
  if (minor > 99 || patch > 99) throw new Error('minor/patch 는 99 까지');
  return major * 10000 + minor * 100 + patch;
}

export function applyAndroidVersion(tag, gradlePath) {
  const name = String(tag).trim().replace(/^v/, '');
  const code = versionCodeFor(tag);
  let s = fs.readFileSync(gradlePath, 'utf8');
  s = s.replace(/versionCode \d+/, `versionCode ${code}`).replace(/versionName "[^"]*"/, `versionName "${name}"`);
  fs.writeFileSync(gradlePath, s);
  return { name, code };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const gradle = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'android', 'app', 'build.gradle');
  console.log(applyAndroidVersion(process.argv[2], gradle));
}
```

- [ ] **Step 4: 통과 확인** — Run: `node --test tests/android-version.test.js` → PASS

- [ ] **Step 5: gradle 서명 설정**

`android/app/build.gradle` 의 `android { ... }` 안에 추가(`buildTypes` 앞):
```gradle
    signingConfigs {
        release {
            def ksPath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (ksPath) {
                storeFile file(ksPath)
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
```
그리고 `buildTypes { release { ... } }` 안에 `signingConfig signingConfigs.release` 추가.

- [ ] **Step 6: 워크플로**

`.github/workflows/android-release.yml`:
```yaml
name: Android release
on:
  push:
    tags: ['v*']
permissions:
  contents: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: 17 }
      - uses: android-actions/setup-android@v3
      - run: npm ci
      - run: npm test
      - run: node scripts/build-web.js
      - run: npx cap sync android
      - run: node scripts/android-version.js "${GITHUB_REF_NAME}"
      - name: Decode keystore
        run: echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > "$RUNNER_TEMP/release.keystore"
      - name: Build signed APK
        working-directory: android
        env:
          ANDROID_KEYSTORE_PATH: ${{ runner.temp }}/release.keystore
          ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          ANDROID_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
        run: chmod +x gradlew && ./gradlew assembleRelease --no-daemon
      - name: Rename APK
        run: cp android/app/build/outputs/apk/release/app-release.apk "travel-log-${GITHUB_REF_NAME#v}.apk"
      - uses: softprops/action-gh-release@v2
        with:
          files: travel-log-*.apk
          generate_release_notes: true
```

- [ ] **Step 7: Secrets 등록**

PowerShell 로 base64:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\travel-log-release.keystore")) | Set-Clipboard
```
GitHub 저장소 → Settings → Secrets and variables → Actions → New repository secret 로 4개 등록: `ANDROID_KEYSTORE_BASE64`(클립보드), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` = `travel-log`, `ANDROID_KEY_PASSWORD`. (비밀번호 입력은 사용자가 직접 한다. `gh` CLI 가 있으면 `gh secret set NAME` 도 가능.)

- [ ] **Step 8: README 설치 안내**

`README.md` 에 섹션 추가:
```markdown
## 안드로이드 앱

- 최신 APK: https://github.com/y1kk3love/Travel-Log/releases/latest → `travel-log-X.Y.Z.apk`
- 설치: 폰에서 APK 다운로드 → 열기 → "알 수 없는 앱 설치 허용"(처음 한 번) → 설치. 업데이트는 새 APK 를 같은 방법으로 설치하면 덮어써진다.
- 앱에서만 되는 것: 구글 지도 앱의 "공유 → 여행 로그", 다음 목적지 출발 알림, 인터넷 없이 앱 열기.
- 릴리스 만들기: `git tag v1.0.1 && git push origin v1.0.1` → Actions 가 APK 를 만들어 릴리스에 붙인다. 서명 키는 `docs/android-signing.md`.
```

- [ ] **Step 9: 커밋과 첫 릴리스**

Run: `npm test` → PASS.
```bash
git add scripts/android-version.js tests/android-version.test.js .github/workflows/android-release.yml android/app/build.gradle README.md
git commit -m "ci: 태그마다 서명 APK 를 만들어 GitHub Releases 에 첨부"
git push origin main
git tag -a v1.0.0 -m "첫 안드로이드 앱: 공유 받기, 출발 알림, 오프라인 내장"
git push origin v1.0.0
```
Actions 탭에서 워크플로 성공 확인 → Releases 에 `travel-log-1.0.0.apk` 가 붙었는지 확인. 실패하면 로그를 읽고 고쳐 `v1.0.1` 로 다시.

---

### Task 9: 콘솔 마무리와 폰 검증

**Files:**
- Modify: 없음 (콘솔 설정과 수동 확인). 결과는 `docs/android-signing.md` 끝에 "검증 완료 v1.0.0, 날짜" 한 줄.

- [ ] **Step 1: Google Maps 키 리퍼러 추가**

Google Cloud 콘솔 → travel-log-maps → 사용자 인증 정보 → `travel-log-web` 키 → 웹사이트 제한사항에 `https://travellog.local/*` 추가 → 저장.

- [ ] **Step 2: 폰 설치와 로그인**

릴리스 APK 를 안드로이드 폰에 설치 → 앱 열기 → "Google로 로그인" → 계정 선택 창(네이티브)이 뜨고 홈에 여행 카드가 보이는지.
실패 시 흔한 원인: SHA-1 미등록(`DEVELOPER_ERROR`), `google-services.json` 의 패키지 이름 불일치.

- [ ] **Step 3: 공유 받기**

구글 지도 앱에서 아무 장소 → 공유 → "여행 로그" → 여행 선택 → Day 선택 → 장소 추가 창에 이름으로 검색 결과가 뜨는지 → 저장.

- [ ] **Step 4: 알림**

일정에서 시간 있는 장소를 오늘 Day 로 옮기고 시각을 지금 + 20분으로 → 앱을 완전히 닫음 → 10분 뒤 "곧 출발: …" 알림이 오는지 → 알림을 누르면 그 여행의 일정이 열리는지. 확인 후 장소를 되돌린다.

- [ ] **Step 5: 오프라인**

비행기 모드 → 앱 열기 → 홈과 일정이 보이는지(지도 타일은 비어 있어도 됨) → 장소 메모를 고치고 비행기 모드 해제 → 웹에서 반영됐는지.

- [ ] **Step 6: 웹 회귀**

`https://y1kk3love.github.io/Travel-Log/` 에서 로그인·일정·검색이 전과 같은지.

- [ ] **Step 7: 기록과 커밋**

`docs/android-signing.md` 끝에 `- 검증 완료: v1.0.0 (YYYY-MM-DD) 로그인·공유·알림·오프라인·웹 회귀 OK` 추가.
```bash
git add docs/android-signing.md
git commit -m "docs: v1.0.0 폰 검증 기록"
git push origin main
```
