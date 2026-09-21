export function moveItem(list, from, to) {
  const next = list.slice();
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function reorderUpdates(items, from, to) {
  const moved = moveItem(items, from, to);
  return moved
    .map((item, index) => ({ id: item.id, order: index }))
    .filter((u) => items.find((item) => item.id === u.id).order !== u.order);
}

export function nextOrder(items) {
  if (!items.length) return 0;
  return Math.max(...items.map((item) => item.order)) + 1;
}

// 시각(HH:MM)에 맞는 자리의 order. 시각이 없는 항목은 바로 앞의 시각 있는 항목에 딸린 것으로 본다.
// 같은 시각이면 그 뒤, 모두 이르면 맨 앞(첫 order − 1), 모두 늦으면 끝+1, 빈 날이면 0.
export function orderForTime(items, time) {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const first = sorted.findIndex((p) => p.time && p.time > time);
  if (first < 0) return nextOrder(sorted);
  if (first === 0) return sorted[0].order - 1;
  return (sorted[first - 1].order + sorted[first].order) / 2;
}
