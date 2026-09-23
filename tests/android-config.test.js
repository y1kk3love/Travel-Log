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

test('상태바·내비게이션 바 아이콘은 밝은 배경용(어두운 아이콘)으로 고정한다 (다크 모드 폰에서도)', () => {
  const config = JSON.parse(read('capacitor.config.json'));
  assert.equal(config.plugins?.SystemBars?.style, 'LIGHT');
});

test('시스템 바 뒤 배경은 앱 배경색 #F2F2F7 (다크 모드 폰에서도 검게 나오지 않게)', () => {
  // windowBackground 는 참조(reference)만 받는 속성이라 색 값을 바로 쓰면 aapt2 가 빌드를 멈춘다 → 색 자원으로
  const styles = read('android/app/src/main/res/values/styles.xml');
  const appTheme = styles.match(/<style name="AppTheme\.NoActionBar"[\s\S]*?<\/style>/)?.[0] ?? '';
  assert.match(appTheme, /<item name="android:windowBackground">@color\/app_background<\/item>/);
  const colors = read('android/app/src/main/res/values/colors.xml');
  assert.match(colors, /<color name="app_background">#F2F2F7<\/color>/);
});

test('MainActivity 는 여백을 직접 주지 않는다 (Capacitor 와 겹치면 키보드 여백이 두 배가 된다)', () => {
  const main = read('android/app/src/main/java/io/github/y1kk3love/travellog/MainActivity.java');
  assert.ok(!main.includes('setOnApplyWindowInsetsListener'));
});

test('안드로이드 XML 주석에는 -- 를 쓰지 않는다 (XML 규칙 위반이라 aapt2 가 리소스를 읽지 못해 빌드가 멈춘다)', () => {
  const dir = 'android/app/src/main/res/values';
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.xml')).map((f) => `${dir}/${f}`).concat('android/app/src/main/AndroidManifest.xml');
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
