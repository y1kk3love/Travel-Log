// 열린 창(대화상자·시트·사진 확대)을 연 순서대로 쌓아 둔다.
// 안드로이드 뒤로가기는 맨 위 창부터 닫고, 열린 창이 없을 때만 화면을 이동한다.
export function createOverlayStack() {
  const stack = [];
  return {
    // close: 창을 닫는 함수. 돌려주는 핸들의 release() 는 창이 스스로 닫혔을 때 부른다(여러 번 불러도 됨).
    push(close) {
      const entry = {
        close,
        release() { const i = stack.indexOf(entry); if (i >= 0) stack.splice(i, 1); },
        isTop() { return stack[stack.length - 1] === entry; },
      };
      stack.push(entry);
      return entry;
    },
    closeTop() {
      const entry = stack.pop();
      if (!entry) return false;
      entry.close();
      return true;
    },
    get size() { return stack.length; },
  };
}
