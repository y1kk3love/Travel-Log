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
