// 초대 메시지: 초대한 사람이 자기 카카오톡·문자·메일로 직접 보낸다 (자동 메일은 보내지 않는다). 순수 로직, 테스트 대상.
import { formatRange } from './dates.js';

export const SITE_URL = 'https://y1kk3love.github.io/Travel-Log/';
export const APP_URL = 'https://github.com/y1kk3love/Travel-Log/releases/latest';

// trip 이 있으면 그 여행 초대(그 여행으로 바로 가는 주소), 없으면 사이트 초대
export function inviteMessage({ email, trip = null }) {
  const lines = trip
    ? [
      `[여행 로그] '${trip.title}' 여행(${formatRange(trip.startDate, trip.endDate)})에 초대했어요.`,
      `${email} 구글 계정으로 로그인하면 일정·예약·지출을 함께 보고 고칠 수 있어요.`,
      '',
      `웹: ${SITE_URL}#/trip/${trip.id}`,
    ]
    : [
      '[여행 로그] 여행 플래너 "여행 로그"에 초대했어요.',
      `${email} 구글 계정으로 로그인해 주세요.`,
      '',
      `웹: ${SITE_URL}`,
    ];
  lines.push(`안드로이드 앱: ${APP_URL}`);
  return { title: '여행 로그 초대', text: lines.join('\n') };
}

// 보내기: 앱(안드로이드 공유 창) → 브라우저 공유 창 → 복사 순서.
// ways: { native(msg) → 앱이 처리했으면 true, webShare(msg) | null, copy(text) }
// 반환: 'native' | 'shared' | 'cancelled'(공유 창을 닫음) | 'copied' | 'failed'
export async function shareInvite(message, { native, webShare, copy }) {
  try { if (await native?.(message)) return 'native'; } catch { /* 브라우저 방법으로 */ }
  if (webShare) {
    try { await webShare({ title: message.title, text: message.text }); return 'shared'; }
    catch (err) { if (err?.name === 'AbortError') return 'cancelled'; }
  }
  try { await copy(message.text); return 'copied'; }
  catch { return 'failed'; }
}
