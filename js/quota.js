// 하루 한도를 다 썼을 때 알아보기 쉬운 토스트를 띄운다 (API 종류별로 세션에 한 번만).
// 한도를 넘어도 청구는 없고 그 기능만 잠시 멈추므로, 무엇이 왜 안 되는지와 언제 풀리는지를 알려준다.
import { toast } from './ui.js';
import { isQuotaError, quotaResetLabel } from './lib/quota.js';

export const QUOTA_KINDS = {
  routes: { label: '도보 경로', fallback: '그동안 구간은 직선으로 표시돼요' },
  places: { label: '장소 검색', fallback: '그동안 OpenStreetMap 검색으로 대신해요' },
  details: { label: '장소 상세', fallback: '검색 결과의 위치를 가져올 수 없어요. 좌표나 링크를 붙여넣어 주세요' },
  map: { label: '지도 표시', fallback: '지도가 잠시 표시되지 않아요' },
};

const STORE_PREFIX = 'tl.quota.';

function markHit(kind) {
  try { sessionStorage.setItem(STORE_PREFIX + kind, String(Date.now())); } catch { /* 저장 공간이 없으면 무시 */ }
}

// 오늘 세션에서 한도 초과가 감지된 종류 목록 (사용량 창에 표시)
export function quotaHits() {
  const out = [];
  for (const kind of Object.keys(QUOTA_KINDS)) {
    try { const at = sessionStorage.getItem(STORE_PREFIX + kind); if (at) out.push({ kind, label: QUOTA_KINDS[kind].label, at: Number(at) }); }
    catch { /* 무시 */ }
  }
  return out;
}

const shown = new Set();

// 한도 초과면 토스트를 띄우고 true, 아니면 false
export function notifyQuota(kind, err = null) {
  if (err != null && !isQuotaError(err)) return false;
  markHit(kind);
  if (shown.has(kind)) return true;
  shown.add(kind);
  const info = QUOTA_KINDS[kind] ?? { label: kind, fallback: '' };
  toast(`오늘 구글 ${info.label} 무료 한도를 다 썼어요. ${quotaResetLabel()}에 다시 채워져요. ${info.fallback}`.trim(), { kind: 'error', ms: 8000 });
  return true;
}
