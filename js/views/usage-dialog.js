import { el, openModal } from '../ui.js';
import { quotaHits } from '../quota.js';
import { quotaResetLabel } from '../lib/quota.js';
import { alarmsStatus } from '../alarms.js';
import { appVersion, isNative } from '../native.js';
import { estimateStorage } from '../db.js';
import { firebaseConfig } from '../firebase-config.js';
import { formatBytes, storagePercent, STORAGE_LIMIT_BYTES } from '../lib/firestore-size.js';

// 사이트 주인용: Google 지도 API 하루 한도와 콘솔 바로가기.
// 실제 사용량은 브라우저에서 읽을 수 없어(Cloud 콘솔 로그인 필요) 콘솔 링크로 안내한다.
const PROJECT = 'travel-log-maps';
const CONSOLE = `https://console.cloud.google.com/google/maps-apis/quotas?project=${PROJECT}&hl=ko`;
const BILLING = `https://console.cloud.google.com/billing?project=${PROJECT}&hl=ko`;
const LIMITS = [
  ['지도 로드 (Maps JavaScript)', '320 / 일', '10,000 / 월'],
  ['장소 자동완성 (Places)', '320 / 일', '10,000 / 월'],
  ['장소 상세 (위치·주소만)', '32 / 일', '1,000 / 월 (최고 등급)'],
  ['도보 경로 (Routes)', '32 / 일', '1,000 / 월 (최고 등급)'],
];

// Firebase 저장 용량: 정확한 사용량은 콘솔에만 있어서, 우리 문서 크기를 직접 합산해 근사치를 보여 준다 (하루 1회 기억)
const FIREBASE_USAGE = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/usage`;
const STORAGE_CACHE = 'tl.storage.estimate';
function readStorageCache() {
  try { const c = JSON.parse(localStorage.getItem(STORAGE_CACHE) || 'null'); return c && Date.now() - c.at < 24 * 3600 * 1000 ? c : null; } catch { return null; }
}
function storageSection(link) {
  const status = el('p', { class: 'usage-status' });
  const bar = el('div', { class: 'progress' }, el('div', { style: { width: '0%' } }));
  const show = (c) => {
    const pct = storagePercent(c.bytes);
    status.textContent = `약 ${formatBytes(c.bytes)} / ${formatBytes(STORAGE_LIMIT_BYTES)} (${pct}%) · 문서 ${c.docs}개 · ${new Date(c.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })} 기준`;
    bar.firstChild.style.width = `${Math.min(100, pct)}%`;
    status.classList.toggle('usage-status-hit', pct >= 80);
  };
  const cached = readStorageCache();
  if (cached) show(cached); else status.textContent = '아직 계산하지 않았어요. 일정·장소 같은 작은 문서는 읽어 합산하고, 사진·서류는 크기 합계만 물어봐요 (읽기 수백 건).';
  const calcBtn = el('button', {
    type: 'button', class: 'btn btn-sm', text: cached ? '다시 계산' : '저장 용량 계산',
    onClick: async () => {
      calcBtn.disabled = true; status.textContent = '계산 중…';
      try {
        const r = await estimateStorage();
        const c = { ...r, at: Date.now() };
        try { localStorage.setItem(STORAGE_CACHE, JSON.stringify(c)); } catch { /* 저장 못 해도 됨 */ }
        show(c); calcBtn.textContent = '다시 계산';
      } catch (err) { console.error(err); status.textContent = '계산하지 못했어요 (오프라인이거나 권한 문제)'; }
      calcBtn.disabled = false;
    },
  });
  return el('div', { class: 'usage-storage' },
    status, bar,
    el('p', { class: 'muted ps-hint', text: '무료 한도는 저장 1 GiB, 읽기 5만·쓰기 2만/일. 읽기·쓰기 횟수는 다른 기기 사용까지 포함되어 앱에서는 알 수 없고 콘솔에서만 보여요.' }),
    el('div', { class: 'usage-links' }, calcBtn, link(FIREBASE_USAGE, 'Firebase 사용량 보기')));
}

// 안드로이드 앱에서만: 앱 버전과 알림 상태 (웹에서는 아무것도 붙이지 않는다)
function appInfo() {
  if (!isNative()) return null;
  const box = el('div', { class: 'usage-app muted' });
  const status = alarmsStatus();
  if (status === 'denied') box.append(el('p', { text: '다음 목적지 알림이 꺼져 있어요. 폰 설정 → 앱 → 여행 로그 → 알림에서 켜 주세요.' }));
  else if (status === 'granted') box.append(el('p', { text: '다음 목적지 알림 켜짐 (출발 10분 전)' }));
  appVersion().then((v) => { if (v) box.append(el('p', { text: `앱 버전 ${v}` })); });
  return box;
}

export function openUsageDialog() {
  const dialog = el('dialog', { class: 'usage-dialog' });
  const link = (href, text) => el('a', { class: 'btn btn-sm', href, target: '_blank', rel: 'noopener', text });
  const hits = quotaHits();
  const status = hits.length
    ? el('p', { class: 'usage-status usage-status-hit', text: `오늘 한도를 다 쓴 항목: ${hits.map((h) => h.label).join(', ')} · ${quotaResetLabel()}에 초기화돼요` })
    : el('p', { class: 'usage-status', text: '이 기기에서 오늘 한도 초과가 감지된 항목은 없어요' });
  dialog.append(el('form', { method: 'dialog' },
    el('h2', { text: '사용량과 한도' }),
    el('h3', { class: 'usage-sub', text: 'Google 지도 API' }),
    el('div', { class: 'dialog-body' },
      status,
      el('p', { class: 'muted ps-hint', text: '하루 한도를 월 무료 범위보다 낮게 걸어 두어 넘어도 청구되지 않고 그 기능만 잠시 멈춰요. 장소 상세·도보 경로는 키가 악용돼 가장 비싼 등급으로 불려도 무료 범위를 넘지 않게 32건으로, 앱이 쓰지 않는 기능은 0으로 막았어요. 오늘 얼마나 썼는지는 콘솔의 할당량 페이지에서 API를 고르면 "현재 사용량"에 나와요.' }),
      el('table', { class: 'usage-table' },
        el('thead', {}, el('tr', {}, el('th', { text: 'API' }), el('th', { text: '하루 한도' }), el('th', { text: '무료 범위' }))),
        el('tbody', {}, ...LIMITS.map(([a, b, c]) => el('tr', {}, el('td', { text: a }), el('td', { text: b }), el('td', { text: c }))))),
      el('div', { class: 'usage-links' }, link(CONSOLE, '할당량·사용량 보기'), link(BILLING, '결제 계정 보기')),
      el('h3', { class: 'usage-sub', text: 'Firebase 저장 용량' }),
      storageSection(link),
      appInfo()),
    el('div', { class: 'dialog-actions' }, el('button', { type: 'submit', class: 'btn btn-primary' }, '닫기'))));
  openModal(dialog);
}
