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
