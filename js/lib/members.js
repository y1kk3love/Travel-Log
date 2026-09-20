// 동행(멤버) 관련 순수 함수.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(text) {
  const s = String(text ?? '').trim().toLowerCase();
  return EMAIL_RE.test(s) ? s : null;
}

// 홈 목록용: 시작일 내림차순, 같은 날은 제목순. 원본은 건드리지 않는다.
export function sortTripsByStart(trips) {
  return [...trips].sort((a, b) => b.startDate.localeCompare(a.startDate) || a.title.localeCompare(b.title));
}

export function isTripOwner(trip, user) {
  return !!user && !!trip?.ownerUid && trip.ownerUid === user.uid;
}
