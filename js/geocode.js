const BASE_URL = 'https://nominatim.openstreetmap.org/search';
const MIN_INTERVAL_MS = 1000;
let lastRequestAt = 0;

export function parseNominatim(json) {
  if (!Array.isArray(json)) return [];
  return json
    .map((r) => ({
      name: String(r.name || String(r.display_name || '').split(',')[0]).trim(),
      address: String(r.display_name || ''),
      lat: Number(r.lat),
      lng: Number(r.lon),
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
}

export async function searchPlaces(q) {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
  const url = `${BASE_URL}?format=jsonv2&limit=5&accept-language=ko&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  return parseNominatim(await res.json());
}

export function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
