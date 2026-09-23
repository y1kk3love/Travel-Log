// Firestore 는 쓰기를 먼저 기기 캐시에 반영하고, 약속(Promise)은 서버가 확인해야 끝난다.
// 오프라인이면 그 확인이 연결될 때까지 오지 않으므로, 화면은 잠깐만 기다리고 넘어간다.

// 서버 확인을 ms 동안만 기다린다. 그 안에 끝나면 'saved', 아니면 'queued'(연결되면 올라감).
// ms 안에 실패하면 그대로 던지고, 넘어간 뒤의 실패는 onLateError 로 알린다.
export function settleSoon(write, { ms = 1000, onLateError = () => {} } = {}) {
  let timer;
  let movedOn = false;
  const timeout = new Promise((resolve) => { timer = setTimeout(() => { movedOn = true; resolve('queued'); }, ms); });
  const done = Promise.resolve(write).then(
    () => 'saved',
    (err) => { if (movedOn) { onLateError(err); return 'queued'; } throw err; },
  );
  return Promise.race([done, timeout]).finally(() => clearTimeout(timer));
}

// 서버 읽기(primary)가 ms 안에 오지 않거나 실패하면 기기 캐시 읽기(fallback)로 넘어간다.
export function preferWithin(primary, fallback, ms) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const useFallback = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      Promise.resolve().then(fallback).then(resolve, reject);
    };
    const timer = setTimeout(useFallback, ms);
    Promise.resolve(primary).then(
      (value) => { if (settled) return; settled = true; clearTimeout(timer); resolve(value); },
      useFallback,
    );
  });
}
