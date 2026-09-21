// 메모 속 URL 을 찾아 글자와 링크 조각으로 나눈다 (순수 함수).
// 반환: [{ type: 'text', value }, { type: 'link', value: 'https://…', label: '표시용 짧은 주소' }, …]
const URL_RE = /(https?:\/\/[^\s<>"'）)\]]+|www\.[^\s<>"'）)\]]+)/g;

export function linkify(text) {
  const s = String(text ?? '');
  const parts = [];
  let last = 0;
  for (const m of s.matchAll(URL_RE)) {
    let url = m[0];
    // 문장 끝 마침표·쉼표는 링크에서 뺀다
    const trail = url.match(/[.,;:!?]+$/);
    if (trail) url = url.slice(0, -trail[0].length);
    if (m.index > last) parts.push({ type: 'text', value: s.slice(last, m.index) });
    const href = url.startsWith('www.') ? `https://${url}` : url;
    parts.push({ type: 'link', value: href, label: shortLabel(href) });
    last = m.index + url.length;
  }
  if (last < s.length) parts.push({ type: 'text', value: s.slice(last) });
  return parts;
}

// 표시용: 프로토콜과 www. 를 떼고 40자 넘으면 줄인다
export function shortLabel(href) {
  const bare = href.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  return bare.length > 40 ? `${bare.slice(0, 37)}…` : bare;
}

export function extractLinks(text) {
  return linkify(text).filter((p) => p.type === 'link').map((p) => p.value);
}
