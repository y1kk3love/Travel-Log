// 폰의 아래 시트: 머리 부분을 끌어 닫는다 (Vaul 방식). 높이의 25% 넘게 끌거나 아래로 휙 튕기면 닫히고, 아니면 제자리로.
// 손가락을 1:1 로 따라오고, 위로 끌면 고무줄처럼 버틴다. 끄는 만큼 배경 어둡기와 뒤 화면 줄어듦이 풀린다.
// 계산은 lib/gesture.js. 장소 창에서 떼어 낸 것으로, 다른 시트에도 그대로 쓸 수 있다.
import { rubberBand, velocity, shouldDismiss } from './lib/gesture.js';

// handle: 끄는 손잡이(시트 머리), sheet: 움직일 시트, overlay: 어두운 배경, backdrop: motion.js sheetBackdrop()
// isClosed(): 이미 닫혔나. onDismiss(settle): 닫을 만큼 끌었을 때 (settle 을 부르면 제자리로 돌아간다 — 닫기 전에 물어볼 때)
export function enableSwipeClose({ handle, sheet, overlay, backdrop, isClosed, onDismiss }) {
  let startY = null;
  let dy = 0;
  let samples = [];
  let height = 1;
  const follow = (offset) => {
    sheet.style.transform = `translateY(${offset}px)`;
    const shown = 1 - Math.min(Math.max(offset, 0) / height, 1); // 1 = 다 올라옴
    overlay.style.background = `rgba(0, 0, 0, ${(0.3 * shown).toFixed(3)})`;
    backdrop.drag(shown);
  };
  const settle = () => { // 제자리로 (transition 을 되살려 부드럽게)
    sheet.style.transition = ''; overlay.style.transition = '';
    sheet.style.transform = ''; overlay.style.background = '';
    backdrop.release(1);
  };
  handle.addEventListener('pointerdown', (e) => {
    if (isClosed() || !globalThis.matchMedia?.('(max-width: 900px)').matches || e.target.closest('button')) return;
    startY = e.clientY; dy = 0;
    samples = [{ t: e.timeStamp, y: e.clientY }];
    height = sheet.getBoundingClientRect().height || 1;
    sheet.style.transition = 'none'; overlay.style.transition = 'none';
    try { handle.setPointerCapture(e.pointerId); } catch { /* 합성 이벤트면 무시 */ }
  });
  handle.addEventListener('pointermove', (e) => {
    if (startY == null || isClosed()) return; // 끄는 도중에 닫혔으면(뒤로가기·화면 이동) 따라가지 않는다
    dy = e.clientY - startY;
    samples.push({ t: e.timeStamp, y: e.clientY });
    if (samples.length > 20) samples.shift();
    follow(dy >= 0 ? dy : rubberBand(dy, 40));
  });
  const end = (e) => {
    if (startY == null) return;
    startY = null;
    if (isClosed()) return;
    if (!shouldDismiss({ distance: dy, velocity: velocity(samples, 100, e.timeStamp), size: height })) { settle(); return; }
    onDismiss(settle);
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}
