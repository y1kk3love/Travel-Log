// 해시 라우트 판정 (순수 함수). 앱의 뒤로가기 처리에서 "홈이면 종료 확인, 아니면 뒤로" 를 가르는 데 쓴다.
export function isHomeHash(hash) {
  const h = String(hash ?? '').replace(/^#/, '');
  return h === '' || h === '/';
}
