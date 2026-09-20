// 닉네임 관련 순수 함수.
const MAX_LEN = 20;

export function normalizeNickname(text) {
  const s = String(text ?? '').trim();
  if (!s || s.length > MAX_LEN) return null;
  return s;
}

// 아바타 대체용 첫 글자
export function initialFor(name) {
  const s = String(name ?? '').trim();
  return s ? [...s][0].toUpperCase() : '?';
}

// 표시 이름: 닉네임이 있으면 닉네임, 없으면 이메일의 @ 앞부분
export function displayNameFor(profile, email) {
  const nick = String(profile?.nickname ?? '').trim();
  if (nick) return nick;
  return String(email ?? '').split('@')[0];
}
