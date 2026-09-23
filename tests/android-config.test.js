import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// 안드로이드 15+ 는 앱을 시스템 바 아래까지 펼친다. 여백은 Capacitor(SystemBars)가 한 곳에서만 주도록 맞춰 둔 설정을 지킨다.
// viewport-fit=cover 가 있으면 Capacitor 는 여백을 웹(CSS)에 넘기고, 우리 CSS 는 그걸 쓰지 않아 상단 바가 가려진다.
const read = (p) => fs.readFileSync(p, 'utf8');

test('index.html 은 viewport-fit=cover 를 쓰지 않는다 (시스템 바 여백을 Capacitor 가 네이티브로 준다)', () => {
  const viewport = read('index.html').match(/<meta name="viewport" content="([^"]*)"/)?.[1] ?? '';
  assert.ok(viewport.includes('width=device-width'));
  assert.ok(!viewport.includes('viewport-fit=cover'));
});

test('상태바·내비게이션 바 아이콘은 폰의 밝기 모드를 따른다 (앱도 다크 모드를 따르므로)', () => {
  const config = JSON.parse(read('capacitor.config.json'));
  assert.equal(config.plugins?.SystemBars?.style, 'DEFAULT');
  // Capacitor SystemBars 는 켤 때 한 번만 모드를 보고 그 값을 다시 쓴다 → 앱이 켜진 채로 모드를 바꾸면 MainActivity 가 맞춘다
  const main = read('android/app/src/main/java/io/github/y1kk3love/travellog/MainActivity.java');
  assert.match(main, /onConfigurationChanged/);
  assert.match(main, /UI_MODE_NIGHT_YES/);
  assert.match(main, /setAppearanceLightStatusBars/);
  assert.match(main, /setAppearanceLightNavigationBars/);
});

test('시스템 바 뒤 배경은 앱 배경색: 밝은 모드 #F2F2F7, 다크 모드 #000000 (CSS 의 bg 색)', () => {
  // windowBackground 는 참조(reference)만 받는 속성이라 색 값을 바로 쓰면 aapt2 가 빌드를 멈춘다 → 색 자원으로
  const styles = read('android/app/src/main/res/values/styles.xml');
  const appTheme = styles.match(/<style name="AppTheme\.NoActionBar"[\s\S]*?<\/style>/)?.[0] ?? '';
  assert.match(appTheme, /<item name="android:windowBackground">@color\/app_background<\/item>/);
  const colors = read('android/app/src/main/res/values/colors.xml');
  assert.match(colors, /<color name="app_background">#F2F2F7<\/color>/);
  const night = read('android/app/src/main/res/values-night/colors.xml');
  assert.match(night, /<color name="app_background">#000000<\/color>/);
  assert.match(read('css/main.css'), /prefers-color-scheme: dark\) \{\s*:root \{[^}]*--bg: #000000/);
});

test('MainActivity 는 여백을 직접 주지 않는다 (Capacitor 와 겹치면 키보드 여백이 두 배가 된다)', () => {
  const main = read('android/app/src/main/java/io/github/y1kk3love/travellog/MainActivity.java');
  assert.ok(!main.includes('setOnApplyWindowInsetsListener'));
});

test('안드로이드 XML 주석에는 -- 를 쓰지 않는다 (XML 규칙 위반이라 aapt2 가 리소스를 읽지 못해 빌드가 멈춘다)', () => {
  const dirs = ['android/app/src/main/res/values', 'android/app/src/main/res/values-night'];
  const files = dirs.filter((d) => fs.existsSync(d)).flatMap((dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.xml')).map((f) => `${dir}/${f}`))
    .concat('android/app/src/main/AndroidManifest.xml');
  for (const file of files) {
    for (const [, body] of read(file).matchAll(/<!--([\s\S]*?)-->/g)) {
      assert.ok(!body.includes('--'), `${file}: 주석 안에 -- 가 있음: ${body.trim().slice(0, 60)}`);
    }
  }
});

test('출발 알림을 제시간에 울리도록 USE_EXACT_ALARM 을 선언한다 (안드로이드 13+ 는 자동 허용, 스토어 밖 배포라 정책 심사 없음)', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /<uses-permission android:name="android\.permission\.USE_EXACT_ALARM"\s*\/>/);
});

test('오래된 WebView: 최소 버전보다 낮으면 안내 페이지를 띄운다 (빈 "불러오는 중…" 대신)', () => {
  const config = JSON.parse(read('capacitor.config.json'));
  assert.ok(config.android?.minWebViewVersion >= 85, '??= 같은 문법은 크롬 85 이상');
  const errorPath = config.server?.errorPath;
  assert.ok(errorPath && fs.existsSync(errorPath), 'server.errorPath 파일이 저장소에 있어야 한다');
  assert.match(read('scripts/build-web.js'), new RegExp(`'${errorPath.replace('.', '\.')}'`), '앱 빌드(dist)에 복사돼야 한다');
});

test('앱 백업에 로그인 정보·기기 캐시가 들어가지 않게 allowBackup=false', () => {
  assert.match(read('android/app/src/main/AndroidManifest.xml'), /android:allowBackup="false"/);
});

test('프로세스가 죽었다 살아나도 예전 공유가 다시 열리지 않는다', () => {
  const main = read('android/app/src/main/java/io/github/y1kk3love/travellog/MainActivity.java');
  assert.ok(main.includes('FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY') && main.includes('savedInstanceState != null'));
});

test('WebView 안내 페이지: WebView 가 새것인데 뜬 경우(불러오기 오류)는 다시 열기를 안내한다. 스크립트는 옛 문법만', () => {
  const page = read('webview-error.html');
  const script = page.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';
  assert.match(script, /Chrome\\\/\(\\d\+\)/, 'Chrome 버전을 읽는다');
  assert.match(script, /90/, 'minWebViewVersion 과 같은 기준');
  assert.ok(!/=>|\blet\b|\bconst\b|\?\.|\?\?|`/.test(script), '오래된 WebView 에서도 도는 문법만');
  assert.match(page, /다시 열어/);
});
