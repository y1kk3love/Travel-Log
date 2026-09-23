// 실행 중에 다시 불리면 새로 실행하지 않고 진행 중인 것을 돌려준다 (저장 버튼 연타로 두 번 저장되지 않게).
export function singleFlight(fn) {
  let running = null;
  return (...args) => {
    if (running) return running;
    running = Promise.resolve()
      .then(() => fn(...args))
      .finally(() => { running = null; });
    return running;
  };
}
