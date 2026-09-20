// Open-Meteo 일별 예보 (무료, 키 없음). 같은 위치·기간은 세션 안에서 한 번만 받는다.
const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const cache = new Map();

// 반환: { 'YYYY-MM-DD': { code, tmax, tmin } }
export async function fetchDailyForecast(lat, lng, startDate, endDate) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}:${startDate}:${endDate}`;
  if (cache.has(key)) return cache.get(key);
  const url = `${BASE_URL}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${startDate}&end_date=${endDate}`;
  const promise = fetch(url).then(async (res) => {
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const json = await res.json();
    const out = {};
    (json.daily?.time ?? []).forEach((date, i) => {
      out[date] = { code: json.daily.weather_code[i], tmax: Math.round(json.daily.temperature_2m_max[i]), tmin: Math.round(json.daily.temperature_2m_min[i]) };
    });
    return out;
  });
  cache.set(key, promise);
  promise.catch(() => cache.delete(key));
  return promise;
}
