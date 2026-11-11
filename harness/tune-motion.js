// 화면 전환(홈 ↔ 여행) 조절 창 — 확인용 화면(harness)에만 뜬다.
// 막대를 움직이면 css/main.css 의 --nav-* 변수를 바로 바꾼다. 홈의 여행 카드를 눌렀다가 "‹ 내 여행"으로 돌아오며 느낌을 본다.
// 마음에 드는 값이 나오면 "값 복사"로 복사해 알려 주면 그 값을 css 의 기본값으로 넣는다. 값은 이 브라우저에만 기억된다.
const KEY = 'tl.tune.nav';
const DEFAULTS = { dur: 1000, fade: 0.15, blur: 16, shift: 60 }; // css/main.css 의 --nav-* 기본값과 같게
const CONTROLS = [
  { key: 'dur', label: '들어오는 시간', min: 200, max: 1200, step: 20, show: (v) => `${(v / 1000).toFixed(2)}초`, apply: (v) => ['--nav-dur', `${v}ms`] },
  { key: 'fade', label: '뒤 화면 흐림', min: 0, max: 1, step: 0.05, show: (v) => `불투명도 ${Number(v).toFixed(2)}`, apply: (v) => ['--nav-fade', String(v)] },
  { key: 'blur', label: '뒤 화면 블러', min: 0, max: 16, step: 1, show: (v) => `${v}px`, apply: (v) => ['--nav-blur', `${v}px`] },
  { key: 'shift', label: '뒤 화면이 밀리는 거리', min: 0, max: 60, step: 2, show: (v) => `${v}%`, apply: (v) => ['--nav-shift', `-${v}%`] },
];

let values = { ...DEFAULTS };
try { values = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { /* 기억 못 해도 됨 */ }

const root = document.documentElement;
const panel = document.createElement('div');
panel.id = 'tune-motion';
panel.innerHTML = `<style>
  #tune-motion { position: fixed; left: 12px; bottom: 12px; z-index: 5000; width: 248px; padding: 12px; border-radius: 12px; background: rgba(20, 20, 22, .92); color: #fff;
    font: 12px/1.4 system-ui, sans-serif; box-shadow: 0 8px 24px rgba(0, 0, 0, .3); view-transition-name: tune-motion; }
  #tune-motion.closed .tm-body { display: none; }
  #tune-motion.closed { width: auto; }
  #tune-motion header { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-weight: 700; }
  #tune-motion label { display: block; margin-top: 10px; }
  #tune-motion label span { display: flex; justify-content: space-between; }
  #tune-motion input[type=range] { width: 100%; margin: 4px 0 0; }
  #tune-motion button { border: 0; border-radius: 8px; padding: 6px 10px; background: rgba(255, 255, 255, .16); color: #fff; font: inherit; cursor: pointer; }
  #tune-motion .tm-row { display: flex; gap: 6px; margin-top: 12px; }
  #tune-motion .tm-row button { flex: 1; }
  #tune-motion output { opacity: .75; }
  #tune-motion .tm-note { margin-top: 8px; opacity: .7; }
</style>
<header><span>화면 전환 조절</span><button type="button" data-act="toggle">접기</button></header>
<div class="tm-body"></div>`;
const body = panel.querySelector('.tm-body');

function apply() {
  for (const c of CONTROLS) { const [name, value] = c.apply(values[c.key]); root.style.setProperty(name, value); }
  try { localStorage.setItem(KEY, JSON.stringify(values)); } catch { /* 기억 못 해도 됨 */ }
}

const outputs = {};
for (const c of CONTROLS) {
  const label = document.createElement('label');
  const head = document.createElement('span');
  const out = document.createElement('output');
  head.append(c.label, out);
  const input = document.createElement('input');
  Object.assign(input, { type: 'range', min: String(c.min), max: String(c.max), step: String(c.step), value: String(values[c.key]) });
  const sync = () => { out.textContent = c.show(values[c.key]); };
  input.addEventListener('input', () => { values[c.key] = Number(input.value); sync(); apply(); });
  outputs[c.key] = { input, sync };
  sync();
  label.append(head, input);
  body.append(label);
}

const summary = () => `들어오는 시간 ${(values.dur / 1000).toFixed(2)}초, 뒤 화면 불투명도 ${Number(values.fade).toFixed(2)}, 블러 ${values.blur}px, 밀리는 거리 ${values.shift}%`;
const row = document.createElement('div');
row.className = 'tm-row';
row.innerHTML = '<button type="button" data-act="copy">값 복사</button><button type="button" data-act="reset">처음 값으로</button>';
const note = document.createElement('div');
note.className = 'tm-note';
note.textContent = '여행 카드를 눌렀다가 "‹ 내 여행"으로 돌아오며 보세요';
body.append(row, note);

panel.addEventListener('click', async (e) => {
  const act = e.target.closest('button')?.dataset.act;
  if (act === 'toggle') { const closed = panel.classList.toggle('closed'); e.target.textContent = closed ? '화면 전환 조절' : '접기'; }
  if (act === 'reset') { values = { ...DEFAULTS }; for (const c of CONTROLS) { outputs[c.key].input.value = String(values[c.key]); outputs[c.key].sync(); } apply(); }
  if (act === 'copy') {
    try { await navigator.clipboard.writeText(summary()); note.textContent = `복사했어요: ${summary()}`; }
    catch { note.textContent = summary(); }
  }
});

// 주소에 ?tune 이 있을 때만 뜬다 (http://localhost:8080/harness/?tune#/). 화면 테스트와 평소 확인에는 끼어들지 않는다
if (new URLSearchParams(location.search).has('tune')) {
  apply();
  document.body.append(panel);
  // 다른 곳(대화)에서 지금 값을 읽을 수 있게
  window.__tuneMotion = { get values() { return { ...values }; }, summary };
}
