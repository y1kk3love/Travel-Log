// 앱 전용: 내 여행 전부를 읽어 오늘·내일 알림을 다시 예약한다. 웹에서는 아무것도 하지 않는다.
import { isNative, notificationPermission, cancelAllNotifications, scheduleNotifications } from './native.js';
import { watchTrips, watchDays, watchPlaces } from './db.js';
import { planAlarms } from './lib/alarms.js';

let status = 'unavailable';
export function alarmsStatus() { return status; }

const once = (fn) => new Promise((res, rej) => { const stop = fn((v) => { stop(); res(v); }, rej); });
let timer = null;

export function refreshAlarms() {
  if (!isNative()) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      status = await notificationPermission();
      if (status !== 'granted') return;
      const trips = await once((cb, err) => watchTrips(cb, err));
      const placesByTrip = {}, daysByTrip = {};
      for (const t of trips) {
        [placesByTrip[t.id], daysByTrip[t.id]] = await Promise.all([once((cb, err) => watchPlaces(t.id, cb, err)), once((cb, err) => watchDays(t.id, cb, err))]);
      }
      const plan = planAlarms({ trips, placesByTrip, daysByTrip }, new Date());
      await cancelAllNotifications();
      await scheduleNotifications(plan);
      console.info(`알림 ${plan.length}개 예약`);
    } catch (err) { console.warn('refreshAlarms', err); }
  }, 2000);
}
