// 체크리스트 계산 (순수 함수, 테스트 대상).
// 항목은 두 가지: 함께 챙기는 것(한 명이 체크하면 끝, done)과 각자 챙기는 것(personal: true, 사람마다 doneBy 에 이메일).
// 각자 항목의 done 은 "동행 모두가 체크했다"로 맞춰 둔다 (홈 화면의 완료 수와 옛 앱이 done 만 보기 때문).

const lower = (s) => String(s ?? '').toLowerCase();

// 지금 동행 가운데 이 항목을 체크한 사람들
export function checkedMembers(item, members) {
  const by = new Set((item?.doneBy ?? []).map(lower));
  return members.filter((m) => by.has(lower(m)));
}

// 내 화면에서 이 항목이 체크돼 보이나
export function isDoneFor(item, email) {
  if (!item?.personal) return !!item?.done;
  return (item.doneBy ?? []).map(lower).includes(lower(email));
}

// 각자 항목을 내가 체크·해제한 뒤, 동행 모두가 체크한 상태가 되나 (문서의 done 값)
export function allCheckedAfter(item, members, email, checked) {
  const by = new Set((item?.doneBy ?? []).map(lower));
  if (checked) by.add(lower(email)); else by.delete(lower(email));
  return members.length > 0 && members.every((m) => by.has(lower(m)));
}

// "3/8" 처럼 보여 줄 숫자. 함께 챙기는 항목이면 null
export function personalProgress(item, members) {
  if (!item?.personal) return null;
  return { done: checkedMembers(item, members).length, total: members.length };
}

// 새 여행의 기본 항목 가운데 사람마다 따로 챙겨야 하는 것
const PERSONAL_DEFAULTS = ['여권 유효기간 확인', '유심 / 이심 구매', '보조 배터리', '돼지코 어댑터', '상비약'];
export function isPersonalByDefault(text) {
  return PERSONAL_DEFAULTS.includes(text);
}
