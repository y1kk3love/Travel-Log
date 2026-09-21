// 환율: open.er-api.com (키·카드 없음, 하루 1회 갱신). 실패하면 null 을 돌려주고 사용자가 직접 적는다.
import { invertRates } from './lib/expenses.js';

const URL = 'https://open.er-api.com/v6/latest/KRW';
let cache = null;

// 반환: { JPY: 9.12, USD: 1380.5, ... } (외화 1단위당 원화) 또는 null
export async function fetchKrwRates() {
  if (cache) return cache;
  try {
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`rates ${res.status}`);
    const json = await res.json();
    if (json.result !== 'success' || !json.rates) throw new Error('rates format');
    cache = invertRates(json.rates);
    return cache;
  } catch (err) {
    console.warn('환율을 받지 못했어요', err);
    return null;
  }
}
