import { hasCoords } from './geo.js';
import { diffDays } from './dates.js';

// WMO 날씨 코드 → 한글 (Open-Meteo)
const LABELS = [
  [[0], '맑음'], [[1], '대체로 맑음'], [[2], '구름 조금'], [[3], '흐림'],
  [[45, 48], '안개'], [[51, 53, 55, 56, 57], '이슬비'], [[61, 63, 65, 66, 67], '비'],
  [[71, 73, 75, 77], '눈'], [[80, 81, 82], '소나기'], [[85, 86], '눈 소나기'], [[95, 96, 99], '뇌우'],
];
export function weatherLabel(code) {
  const hit = LABELS.find(([codes]) => codes.includes(code));
  return hit ? hit[1] : '날씨';
}

// 그 날 첫 좌표 장소 → 없으면 (주어진 순서에서) 첫 좌표 장소 → 없으면 null
export function pickDayLocation(places, dayId) {
  const pick = places.find((p) => p.dayId === dayId && hasCoords(p)) ?? places.find((p) => hasCoords(p));
  return pick ? { lat: pick.lat, lng: pick.lng } : null;
}

// Open-Meteo 예보는 오늘부터 16일. 오늘 이후 15일 안의 날짜만 조회한다.
export const FORECAST_DAYS = 15;
export function forecastWindow(dates, today) {
  return dates.filter((d) => { const n = diffDays(today, d); return n >= 0 && n <= FORECAST_DAYS; });
}
