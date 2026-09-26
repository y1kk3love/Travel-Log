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

// 동행 추가·내보내기와 여행 삭제: 그 여행을 만든 사람이거나 관리자(사이트 주인)
export function canManageTrip(trip, user, isSiteOwner) {
  return !!user && (isTripOwner(trip, user) || !!isSiteOwner);
}

// 관리자가 동행이 아닌 여행을 보고 있나 ("관리자로 보는 중" 표시). 관리자는 동행 목록에 들어가지 않는다
export function isAdminViewing(trip, user, isSiteOwner) {
  if (!isSiteOwner || !user) return false;
  const me = String(user.email ?? '').toLowerCase();
  return !(trip?.memberEmails ?? []).some((m) => String(m).toLowerCase() === me);
}

// 대표 사진·여행 정보(제목·기간)를 고칠 수 있나: 그 여행을 만든 사람이거나 사이트 주인
export function canEditTripInfo(trip, user, isSiteOwner) {
  return !!user && (isTripOwner(trip, user) || !!isSiteOwner);
}

// 새 여행을 만들 수 있나: 사이트 주인이거나, 초대 목록(allowedUsers) 항목에 canCreate 가 켜진 계정
export function canCreateTrips({ isSiteOwner, allowed }) {
  return !!isSiteOwner || allowed?.canCreate === true;
}

// 초대 관리에서 새로 추가한 계정의 기본값: 동행으로만 참여하고, 여행 만들기는 사이트 주인이 따로 켠다
export const NEW_INVITE = Object.freeze({ canCreate: false });
