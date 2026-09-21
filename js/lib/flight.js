// 편명 파싱과 항공사 이름 (순수 함수). 외부 API 없이 편명만으로 알 수 있는 정보만 다룬다.
const AIRLINES = {
  KE: '대한항공', OZ: '아시아나항공', LJ: '진에어', '7C': '제주항공', TW: '티웨이항공', ZE: '이스타항공',
  BX: '에어부산', RS: '에어서울', YP: '에어프레미아', RF: '에어로케이',
  JL: '일본항공(JAL)', NH: '전일본공수(ANA)', MM: '피치항공', GK: '젯스타재팬', IJ: '스프링재팬', BC: '스카이마크',
  CA: '중국국제항공', MU: '중국동방항공', CZ: '중국남방항공', HU: '하이난항공', '3U': '쓰촨항공',
  CX: '캐세이퍼시픽', HX: '홍콩항공', UO: '홍콩익스프레스', CI: '중화항공', BR: '에바항공', JX: '스타럭스항공',
  VN: '베트남항공', VJ: '비엣젯항공', QH: '뱀부항공', TG: '타이항공', SQ: '싱가포르항공', TR: '스쿠트',
  MH: '말레이시아항공', AK: '에어아시아', D7: '에어아시아X', PR: '필리핀항공', '5J': '세부퍼시픽',
  GA: '가루다인도네시아', JQ: '젯스타', '3K': '젯스타아시아', QF: '콴타스', NZ: '에어뉴질랜드',
  UA: '유나이티드항공', DL: '델타항공', AA: '아메리칸항공', AC: '에어캐나다', HA: '하와이안항공',
  LH: '루프트한자', AF: '에어프랑스', KL: 'KLM', BA: '영국항공', TK: '터키항공', LX: '스위스항공', AY: '핀에어',
  EK: '에미레이트항공', QR: '카타르항공', EY: '에티하드항공', SU: '아에로플로트', FJ: '피지항공',
};

export function parseFlightNumber(text) {
  const s = String(text ?? '').toUpperCase().replace(/[\s-]+/g, '');
  const m = s.match(/^([A-Z0-9]{2})(\d{1,4})$/);
  if (!m) return null;
  const airline = m[1];
  if (!/[A-Z]/.test(airline)) return null; // 두 글자 모두 숫자면 항공사 코드가 아니다
  const number = String(Number(m[2]));
  return { airline, number, iata: `${airline}${number}` };
}

export function airlineName(code) {
  return AIRLINES[String(code ?? '').toUpperCase()] ?? null;
}

export function flightradarUrl(iata) {
  return `https://www.flightradar24.com/data/flights/${String(iata).toLowerCase()}`;
}

// 자주 가는 공항: 도시·공항 이름(한국어) → IATA 코드. 코드를 직접 쓰면 그대로.
const AIRPORTS = {
  인천: 'ICN', 김포: 'GMP', 제주: 'CJU', 부산: 'PUS', 김해: 'PUS', 대구: 'TAE', 청주: 'CJJ', 무안: 'MWX',
  도쿄: 'NRT', 나리타: 'NRT', 하네다: 'HND', 오사카: 'KIX', 간사이: 'KIX', 이타미: 'ITM', 후쿠오카: 'FUK', 나고야: 'NGO', 주부: 'NGO',
  삿포로: 'CTS', 신치토세: 'CTS', 오키나와: 'OKA', 나하: 'OKA', 센다이: 'SDJ', 히로시마: 'HIJ', 구마모토: 'KMJ', 가고시마: 'KOJ', 오이타: 'OIT', 다카마쓰: 'TAK', 마쓰야마: 'MYJ', 기타큐슈: 'KKJ',
  타이베이: 'TPE', 타오위안: 'TPE', 쑹산: 'TSA', 가오슝: 'KHH', 홍콩: 'HKG', 마카오: 'MFM',
  상하이: 'PVG', 푸동: 'PVG', 베이징: 'PEK', 다낭: 'DAD', 하노이: 'HAN', 호치민: 'SGN', 나트랑: 'CXR', 방콕: 'BKK', 수완나품: 'BKK', 돈므앙: 'DMK', 푸켓: 'HKT', 치앙마이: 'CNX',
  싱가포르: 'SIN', 창이: 'SIN', 쿠알라룸푸르: 'KUL', 세부: 'CEB', 마닐라: 'MNL', 발리: 'DPS', 덴파사르: 'DPS', 괌: 'GUM', 사이판: 'SPN', 하와이: 'HNL', 호놀룰루: 'HNL',
  파리: 'CDG', 런던: 'LHR', 프랑크푸르트: 'FRA', 로마: 'FCO', 시드니: 'SYD', 로스앤젤레스: 'LAX', 뉴욕: 'JFK', 밴쿠버: 'YVR',
};

export function airportCode(text) {
  const s = String(text ?? '').trim();
  if (!s) return null;
  if (/^[A-Za-z]{3}$/.test(s)) return s.toUpperCase();
  const key = s.replace(/\s*(국제)?공항$/, '');
  return AIRPORTS[key] ?? null;
}

// 제목 "인천 → 후쿠오카 · 제주항공 7C1403" → { from: '인천', to: '후쿠오카' }. 화살표(→, ->, ➜)나 " - " 로 나눈다.
export function parseRoute(title) {
  const s = String(title ?? '').split(/\s[·|]\s/)[0].trim();
  const m = s.match(/^(.+?)\s*(?:→|->|➜|⇒|~|\s-\s)\s*(.+)$/);
  if (!m) return null;
  const clean = (t) => t.trim().split(/\s+/)[0].replace(/[,·]+$/, '');
  const from = clean(m[1]);
  const to = clean(m[2]);
  return from && to ? { from, to } : null;
}

// 출발·도착 일시(YYYY-MM-DDTHH:MM)로 "1시간 30분". 둘 중 하나가 없거나 도착이 더 이르면 null.
export function flightDuration(departure, arrival) {
  const a = Date.parse(departure ?? ''), b = Date.parse(arrival ?? '');
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  const min = Math.round((b - a) / 60000);
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h}시간 ${m}분` : `${h}시간`) : `${m}분`;
}

// 예약 창 자동완성용: [{ code, label: '인천 (ICN)' }] 코드순. 같은 코드의 이름들은 하나로 묶는다 (오사카·간사이 (KIX)).
export function airportSuggestions() {
  const byCode = new Map();
  for (const [name, code] of Object.entries(AIRPORTS)) {
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(name);
  }
  return [...byCode.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([code, names]) => ({ code, label: `${names.join('·')} (${code})` }));
}

// 제목 자동 생성: "인천 → 오사카 · 진에어 LJ313". 빈 조각은 뺀다.
export function flightTitle({ from = '', to = '', airline = null, iata = null } = {}) {
  const route = [String(from ?? '').trim(), String(to ?? '').trim()];
  const routeText = route[0] || route[1] ? `${route[0]} → ${route[1]}`.trim() : '';
  const flightText = [airline, iata].filter(Boolean).join(' ');
  return [routeText, flightText].filter(Boolean).join(' · ');
}
