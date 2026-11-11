import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/boot-guard.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

// 가짜 창에서 boot-guard 를 돌린다. 반환: { fire(type, event), reloads, app, store, tick() }
function run({ store = {}, now = 1_000_000, storageBroken = false } = {}) {
  const listeners = {};
  const timers = [];
  const state = { reloads: 0, store, button: null };
  const app = {
    innerHTML: '',
    querySelector: () => ({ addEventListener: (_type, fn) => { state.button = fn; } }),
  };
  const window = {
    __tlBooted: false,
    addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); },
  };
  const context = {
    window,
    document: { getElementById: (id) => (id === 'app' ? app : null) },
    location: { reload: () => { state.reloads += 1; } },
    sessionStorage: {
      getItem: (k) => (storageBroken ? (() => { throw new Error('blocked'); })() : store[k] ?? null),
      setItem: (k, v) => { if (storageBroken) throw new Error('blocked'); store[k] = v; },
    },
    setTimeout: (fn) => { timers.push(fn); },
    Date: { now: () => now },
  };
  vm.runInNewContext(source, context);
  return {
    window, app, state,
    fire: (type, event = { target: window }) => (listeners[type] ?? []).forEach((fn) => fn(event)),
    tick: () => { while (timers.length) timers.shift()(); },
  };
}

test('boot-guard: 앱 모듈이 시작하지 못하면 한 번 스스로 다시 연다', () => {
  const g = run();
  g.fire('error');
  assert.equal(g.state.reloads, 0, '잠깐 기다렸다가');
  g.tick();
  assert.equal(g.state.reloads, 1);
  assert.equal(g.state.store['tl.bootRetryAt'], '1000000');
  g.fire('error'); g.tick();
  assert.equal(g.state.reloads, 1, '한 화면에서 두 번 다시 열지 않는다');
});

test('boot-guard: 다시 열고도 1분 안에 또 실패하면 계속 돌지 않고 안내와 "다시 열기" 버튼을 보여 준다', () => {
  const g = run({ store: { 'tl.bootRetryAt': String(1_000_000 - 5000) } });
  g.fire('error'); g.tick();
  assert.equal(g.state.reloads, 0);
  assert.match(g.app.innerHTML, /새 버전을 받는 중/);
  assert.match(g.app.innerHTML, /다시 열기/);
  g.state.button();
  assert.equal(g.state.reloads, 1, '버튼을 누르면 다시 연다');
});

test('boot-guard: 1분이 지난 뒤의 실패는 다시 한 번 스스로 연다', () => {
  const g = run({ store: { 'tl.bootRetryAt': String(1_000_000 - 61000) } });
  g.fire('error'); g.tick();
  assert.equal(g.state.reloads, 1);
});

test('boot-guard: 앱이 시작한 뒤의 오류와 사진 같은 다른 자원의 실패에는 끼어들지 않는다', () => {
  const g = run();
  g.fire('error', { target: { tagName: 'IMG' } }); g.tick();
  g.fire('error', { target: { tagName: 'LINK' } }); g.tick();
  assert.equal(g.state.reloads, 0);
  g.window.__tlBooted = true;
  g.fire('error'); g.fire('unhandledrejection'); g.tick();
  assert.equal(g.state.reloads, 0);
});

test('boot-guard: 모듈 파일을 못 받았을 때(script 요소의 오류)도 다시 연다', () => {
  const g = run();
  g.fire('error', { target: { tagName: 'SCRIPT' } }); g.tick();
  assert.equal(g.state.reloads, 1);
});

test('boot-guard: 다시 열었다는 걸 기억하지 못하는 기기에서는 스스로 다시 열지 않는다 (끝없이 도는 것 방지)', () => {
  const g = run({ storageBroken: true });
  g.fire('error'); g.tick();
  assert.equal(g.state.reloads, 0);
  assert.match(g.app.innerHTML, /다시 열기/);
});

test('index.html: boot-guard 는 보통 스크립트로 앱 모듈보다 먼저 오고, 앱은 시작하면 표시를 남긴다', () => {
  const guard = html.indexOf('<script src="js/boot-guard.js"></script>');
  const app = html.indexOf('<script type="module" src="js/app.js"></script>');
  assert.ok(guard > 0 && guard < app);
  assert.match(fs.readFileSync('js/app.js', 'utf8'), /window\.__tlBooted = true;/);
  assert.ok(!/\b(import|export)\b\s/.test(source.replace(/\/\/.*$/gm, '')), 'boot-guard 는 모듈 문법을 쓰지 않는다 (모듈 묶음이 깨져도 돌아야 한다)');
});
