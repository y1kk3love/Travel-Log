// Google 지도 API "하루 한도 초과" 판별 (순수 함수, 테스트 대상)
// Routes REST 는 HTTP 429, Places JS 라이브러리는 RESOURCE_EXHAUSTED / OVER_QUERY_LIMIT 류 메시지로 온다.
const QUOTA_RE = /429|RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT|quota|rate ?limit|too many requests/i;

export function isQuotaError(err) {
  if (err == null) return false;
  if (typeof err === 'number') return err === 429;
  const text = [err.status, err.code, err.message, err.name, typeof err === 'string' ? err : ''].filter((v) => v != null).join(' ');
  return QUOTA_RE.test(text);
}

// 한도는 미국 태평양 시간 자정에 초기화된다 (한국 시간으로 오후 4시, 서머타임이면 오후 4시 / 아니면 오후 5시)
export function quotaResetLabel(now = new Date()) {
  const pacific = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false, timeZoneName: 'short' })
    .formatToParts(now);
  const tz = pacific.find((p) => p.type === 'timeZoneName')?.value ?? '';
  return tz === 'PDT' ? '한국 시간 오후 4시' : '한국 시간 오후 5시';
}

// 두 시각이 한도 기준으로 같은 날인가 (한도는 미국 태평양 시간 자정마다 초기화)
const pacificDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' });
export function sameQuotaDay(a, b) {
  return pacificDate.format(new Date(a)) === pacificDate.format(new Date(b));
}
