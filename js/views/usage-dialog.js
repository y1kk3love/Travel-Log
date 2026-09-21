import { el, openModal } from '../ui.js';
import { quotaHits } from '../quota.js';
import { quotaResetLabel } from '../lib/quota.js';

// 사이트 주인용: Google 지도 API 하루 한도와 콘솔 바로가기.
// 실제 사용량은 브라우저에서 읽을 수 없어(Cloud 콘솔 로그인 필요) 콘솔 링크로 안내한다.
const PROJECT = 'travel-log-maps';
const CONSOLE = `https://console.cloud.google.com/google/maps-apis/quotas?project=${PROJECT}&hl=ko`;
const BILLING = `https://console.cloud.google.com/billing?project=${PROJECT}&hl=ko`;
const LIMITS = [
  ['지도 로드 (Maps JavaScript)', '320 / 일', '10,000 / 월'],
  ['장소 자동완성 (Places)', '320 / 일', '10,000 / 월'],
  ['장소 상세 (위치·주소만)', '320 / 일', '10,000 / 월'],
  ['도보 경로 (Routes)', '320 / 일', '10,000 / 월'],
];

export function openUsageDialog() {
  const dialog = el('dialog', { class: 'usage-dialog' });
  const link = (href, text) => el('a', { class: 'btn btn-sm', href, target: '_blank', rel: 'noopener', text });
  const hits = quotaHits();
  const status = hits.length
    ? el('p', { class: 'usage-status usage-status-hit', text: `오늘 한도를 다 쓴 항목: ${hits.map((h) => h.label).join(', ')} · ${quotaResetLabel()}에 초기화돼요` })
    : el('p', { class: 'usage-status', text: '이 기기에서 오늘 한도 초과가 감지된 항목은 없어요' });
  dialog.append(el('form', { method: 'dialog' },
    el('h2', { text: 'Google 지도 API 사용량' }),
    el('div', { class: 'dialog-body' },
      status,
      el('p', { class: 'muted ps-hint', text: '하루 한도를 월 무료 범위보다 훨씬 낮게 걸어 두어 넘어도 청구되지 않고 그 기능만 잠시 멈춰요. 오늘 얼마나 썼는지는 콘솔의 할당량 페이지에서 API를 고르면 "현재 사용량"에 나와요.' }),
      el('table', { class: 'usage-table' },
        el('thead', {}, el('tr', {}, el('th', { text: 'API' }), el('th', { text: '하루 한도' }), el('th', { text: '무료 범위' }))),
        el('tbody', {}, ...LIMITS.map(([a, b, c]) => el('tr', {}, el('td', { text: a }), el('td', { text: b }), el('td', { text: c }))))),
      el('div', { class: 'usage-links' }, link(CONSOLE, '할당량·사용량 보기'), link(BILLING, '결제 계정 보기'))),
    el('div', { class: 'dialog-actions' }, el('button', { type: 'submit', class: 'btn btn-primary' }, '닫기'))));
  openModal(dialog);
}
