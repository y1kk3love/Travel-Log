import { dayList } from './dates.js';

// 여행 기간 변경 계획 (순수 함수).
// days: [{id, date, order}] (order 오름차순). 반환: { redate: [{id,date,order}], add: [{date,order}], remove: [id] } 또는 종료일<시작일이면 null.
// 기존 Day는 순서대로 새 시작일부터 다시 날짜를 받고(장소 유지), 남는 날짜는 추가, 넘치는 Day는 제거 대상이 된다.
export function planScheduleChange(days, newStart, newEnd) {
  const target = dayList(newStart, newEnd);
  if (target.length === 0) return null;
  const sorted = [...days].sort((a, b) => a.order - b.order);
  const redate = [];
  const remove = [];
  sorted.forEach((d, i) => {
    if (i < target.length) {
      if (d.date !== target[i].date || d.order !== i) redate.push({ id: d.id, date: target[i].date, order: i });
    } else {
      remove.push(d.id);
    }
  });
  const add = target.slice(sorted.length).map((t) => ({ date: t.date, order: t.order }));
  return { redate, add, remove };
}
