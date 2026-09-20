const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n) => String(n).padStart(2, '0');

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDateStr(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(str, n) {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function diffDays(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

export function dayList(start, end) {
  const n = diffDays(start, end);
  if (Number.isNaN(n) || n < 0) return [];
  return Array.from({ length: n + 1 }, (_, i) => ({ date: addDays(start, i), order: i }));
}

export function weekdayKo(str) {
  return WEEKDAYS[parseDate(str).getDay()];
}

export function formatShort(str) {
  const d = parseDate(str);
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${weekdayKo(str)})`;
}

export function formatRange(start, end) {
  const s = parseDate(start);
  const e = parseDate(end);
  const nights = diffDays(start, end);
  const sStr = `${s.getFullYear()}.${pad(s.getMonth() + 1)}.${pad(s.getDate())}`;
  const eStr = s.getFullYear() === e.getFullYear()
    ? `${pad(e.getMonth() + 1)}.${pad(e.getDate())}`
    : `${e.getFullYear()}.${pad(e.getMonth() + 1)}.${pad(e.getDate())}`;
  return `${sStr} – ${eStr} · ${nights}박 ${nights + 1}일`;
}

export function tripStatus(start, end, today) {
  const toStart = diffDays(today, start);
  if (toStart > 0) return { kind: 'before', days: toStart };
  if (diffDays(today, end) >= 0) return { kind: 'during', days: Math.abs(toStart) };
  return { kind: 'after', days: Math.abs(diffDays(today, end)) };
}

export function formatStatus(status) {
  if (status.kind === 'before') return `D-${status.days}`;
  if (status.kind === 'during') return status.days === 0 ? 'D-Day' : '여행 중';
  return '지난 여행';
}
