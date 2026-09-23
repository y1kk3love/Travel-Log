// 앱 전용: 내 여행 전부를 읽어 오늘·내일 알림을 다시 예약한다. 웹에서는 아무것도 하지 않는다.
import { isNative, notificationPermission, cancelAllNotifications, scheduleNotifications } from './native.js';
import { watchTrips, watchDays, watchPlaces } from './db.js';
import { planAlarms, tripsForAlarms } from './lib/alarms.js';

let status = 'unavailable';
export function alarmsStatus() { return status; }

// 구독을 한 번만 받고 끊는다. 캐시도 서버도 응답이 없으면(오프라인 첫 실행 등) 15초 뒤 포기한다.
// finally 는 executor 가 끝난 뒤 실행되므로 stop 이 항상 채워져 있다.
const once = (fn, ms = 15000) => {
  let stop = null;
  let giveUp = null;
  const result = new Promise((res, rej) => { stop = fn(res, rej); });
  const timeout = new Promise((_, rej) => { giveUp = setTimeout(() => rej(new Error('timeout')), ms); });
  return Promise.race([result, timeout]).finally(() => { clearTimeout(giveUp); stop?.(); });
};
let debounce = null;

export function refreshAlarms() {
  if (!isNative()) return;
  clearTimeout(debounce);
  debounce = setTimeout(async () => {
    try {
      status = await notificationPermission();
      if (status !== 'granted') return;
      const trips = tripsForAlarms(await once((cb, err) => watchTrips(cb, err))); // 오늘·내일에 걸친 여행만 장소를 읽는다
      const placesByTrip = {}, daysByTrip = {};
      await Promise.all(trips.map(async (t) => { // 여행마다 순서대로 기다리지 않고 한꺼번에 읽는다
        [placesByTrip[t.id], daysByTrip[t.id]] = await Promise.all([once((cb, err) => watchPlaces(t.id, cb, err)), once((cb, err) => watchDays(t.id, cb, err))]);
      }));
      const plan = planAlarms({ trips, placesByTrip, daysByTrip }, new Date());
      await cancelAllNotifications();
      await scheduleNotifications(plan);
      console.info(`알림 ${plan.length}개 예약`);
    } catch (err) { console.warn('refreshAlarms', err); }
  }, 2000);
}
