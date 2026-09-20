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
