// 장소 창의 "장소 검색" 칸: 이름·주소 검색, 구글 지도 링크·좌표 붙여넣기, 공유로 받은 글 처리.
// 고른 위치는 draft(lat·lng·address·placeId)에 적고 onDirty 로 알린다. 장소 창(place-sheet.js)에서 떼어 낸 것.
import { el, toast, icon } from '../ui.js';
import { searchPlaces, debounce } from '../geocode.js';
import { isSearchable, createQueryCache, pickSearchSource } from '../lib/place-search.js';
import { createPlaceSearch } from '../places.js';
import { notifyQuota, isQuotaHit } from '../quota.js';
import { parseCoordsInput, parseShareText, googleMapsSearchUrl, googleMapsPlaceUrl, googleMapsDirectionsUrl, parseMapsLink, linkPlaceName } from '../lib/coords.js';
import { resolveMapsLink } from '../native.js';
import { resolveShortLink, relayResolver } from '../lib/short-link.js';
import { MAPS_LINK_RELAY } from '../firebase-config.js';

// draft: { lat, lng, address, placeId } (여기서 고친다). name: 이름 입력칸 (비어 있으면 고른 장소 이름을 채운다)
// near: 검색 결과를 우선 보여줄 기준 좌표. 반환: { field, search, draw, applyShared }
export function createLocationField({ draft, name, near = null, onDirty }) {
  const placeSearch = createPlaceSearch();
  const search = el('input', { class: 'input', id: 'ps-search', type: 'search', placeholder: '장소 이름이나 주소로 검색', autocomplete: 'off', enterkeyhint: 'search' });
  const results = el('div', { class: 'search-results', hidden: true });
  const location = el('p', { class: 'muted ps-location' });

  function draw() {
    location.textContent = draft.lat != null ? `위치 설정됨 · ${draft.address ?? `${draft.lat.toFixed(4)}, ${draft.lng.toFixed(4)}`}` : '위치 없음 · 검색해서 고르면 지도에 표시돼요';
    googleBtn.replaceChildren(icon('map'), draft.placeId || draft.lat != null ? 'Google 지도에서 보기' : 'Google 지도에서 찾기');
    // 위치가 있으면 현재 위치에서 이 장소까지 길찾기 (Google 지도 앱이 열린다)
    directionsBtn.hidden = draft.lat == null;
    if (draft.lat != null) directionsBtn.href = googleMapsDirectionsUrl({ to: { lat: draft.lat, lng: draft.lng, placeId: draft.placeId } });
  }
  const setLocation = ({ lat, lng, address, placeId = null }) => {
    draft.lat = lat; draft.lng = lng; draft.address = address; draft.placeId = placeId;
    onDirty();
    results.hidden = true; search.value = '';
    draw();
  };

  // 구글 지도 링크를 적용한다. 핀 좌표가 있으면 바로, 장소 ID(장소 키에서 만든 것)만 있으면 위치 확인 1건으로 위치를 받는다.
  // 둘 다 안 되면(한도·오프라인) 이름으로 검색해 고르게 한다. title: 공유 글 첫 줄의 깔끔한 이름 (없으면 링크 속 이름)
  async function applyLink(link, title = linkPlaceName(link.name)) {
    if (title && !name.value.trim()) name.value = title;
    if (link.lat != null) {
      setLocation({ lat: link.lat, lng: link.lng, placeId: link.placeId, address: title ? `구글 지도 링크 · ${title}` : `붙여넣은 좌표 ${link.lat.toFixed(5)}, ${link.lng.toFixed(5)}` });
      toast(title ? `'${title}' 위치를 가져왔어요` : '좌표를 가져왔어요. 이름을 적어 주세요');
      return;
    }
    if (link.placeId && !isQuotaHit('details')) {
      location.textContent = '위치 확인 중…';
      try {
        setLocation(await placeSearch.byId(link.placeId));
        toast(title ? `'${title}' 위치를 가져왔어요` : '위치를 가져왔어요. 이름을 적어 주세요');
        return;
      } catch (err) {
        console.error(err);
        notifyQuota('details', err);
        draw();
      }
    }
    searchByName(title);
  }

  // 링크에서 위치를 바로 못 받았을 때: 이름으로 검색해 결과에서 고르게 한다
  function searchByName(title) {
    if (title) {
      search.value = title;
      toast(`'${title}'(으)로 검색했어요. 결과에서 골라 주세요`, { ms: 4000 });
      doSearch(title, { explicit: true });
    } else {
      search.value = '';
      toast('링크에서 위치를 찾지 못했어요. 장소 이름으로 검색해 주세요', { kind: 'error', ms: 5000 });
    }
  }

  // 구글 지도 앱이 공유한 짧은 링크: 앱은 네이티브로, 웹은 중계(Apps Script)로 따라가 긴 주소(핀 좌표나 장소 키)를 받는다. 안 되면 이름 검색.
  let resolvingLink = null; // 붙여넣기와 검색이 같은 링크를 두 번 따라가지 않게
  async function applyShortLink(share) {
    if (resolvingLink === share.link) return;
    resolvingLink = share.link;
    if (share.name && !name.value.trim()) name.value = share.name;
    location.textContent = '공유 링크 여는 중…';
    const long = await resolveShortLink(share.link, [resolveMapsLink, relayResolver(MAPS_LINK_RELAY)]);
    resolvingLink = null;
    const link = long ? parseMapsLink(long) : null;
    if (link && (link.lat != null || link.placeId)) { await applyLink(link, share.name ?? linkPlaceName(link.name)); return; }
    draw();
    searchByName(share.name);
  }

  // Google 지도 링크나 "위도, 경도"를 붙여넣으면 검색 대신 위치를 바로 채운다 (처리했으면 true)
  function applyPastedCoords(text) {
    const link = parseMapsLink(text);
    if (link && (link.lat != null || link.placeId)) { applyLink(link); return true; }
    const coords = parseCoordsInput(text);
    if (coords) {
      setLocation({ lat: coords.lat, lng: coords.lng, address: `붙여넣은 좌표 ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` });
      toast('좌표를 가져왔어요. 이름을 적어 주세요');
      if (!name.value.trim()) name.focus();
      return true;
    }
    const share = parseShareText(text);
    if (!share) return false;
    applyShortLink(share);
    return true;
  }

  function pickResult(r) {
    if (!name.value.trim()) name.value = r.name;
    setLocation({ lat: r.lat, lng: r.lng, address: r.address, placeId: r.placeId ?? null });
  }

  const resultButton = (title, sub, onClick) => el('button', { type: 'button', class: 'search-result', onClick },
    el('strong', { text: title }), el('span', { class: 'muted', text: sub }));

  // Google 자동완성 결과: 누르면 그때 위치·주소를 받아온다 (위치 확인 1건)
  function googleResult(r) {
    const btn = resultButton(r.name, r.address, async () => {
      btn.disabled = true;
      location.textContent = '위치 확인 중…';
      try { pickResult(await placeSearch.resolve(r)); }
      catch (err) {
        console.error(err);
        btn.disabled = false; draw();
        if (notifyQuota('details', err)) {
          // 오늘 위치 확인 한도를 다 썼다: 같은 이름으로 OpenStreetMap 에서 다시 찾는다 (이후 검색도 OpenStreetMap)
          search.value = r.name; doSearch(r.name, { explicit: true });
        } else toast('위치를 가져오지 못했어요. 다시 골라 주세요', { kind: 'error' });
      }
    });
    return btn;
  }
  const osmResult = (r) => resultButton(r.name, r.address, () => pickResult(r));
  // OpenStreetMap(Nominatim)은 입력할 때마다 찾는 자동완성을 금지한다: 엔터나 이 버튼을 눌러야 찾는다
  const osmPrompt = (query) => resultButton(`'${query}' 찾기`, '오늘은 구글 검색을 쓸 수 없어 OpenStreetMap 에서 찾아요. 엔터를 누르거나 여기를 눌러 주세요',
    () => doSearch(query, { explicit: true }));

  function showResults(items, { osm = false } = {}) {
    results.replaceChildren(...(items.length ? items : [el('p', { class: 'muted', text: '검색 결과가 없어요' })]),
      ...(osm && items.length ? [el('p', { class: 'muted search-credit', text: '검색 © OpenStreetMap 기여자' })] : []));
    results.hidden = false;
  }

  let searchSeq = 0; // 늦게 도착한 이전 검색 응답이 최신 결과를 덮지 않도록
  const cache = createQueryCache(); // 이 창에서 받은 결과 (지웠다 다시 치기·같은 말 다시 검색은 요청하지 않는다)
  // 붙여넣기는 paste(바로 처리)와 input(0.6초 뒤 검색) 두 이벤트로 온다. paste 에서 처리한 링크는 검색 쪽에서 다시 처리하지 않는다
  // (안 그러면 같은 링크를 두 번 따라가 안내가 두 번 뜬다). 같은 링크를 다시 붙여넣으면 paste 가 다시 처리한다.
  let handledText = null;
  const handlePasted = (text) => { if (!applyPastedCoords(text)) return false; handledText = String(text).trim(); return true; };

  // explicit: 엔터·버튼·링크 이름처럼 사용자가 "찾아 줘"라고 한 검색. 아니면 입력 중 자동 검색
  async function doSearch(q, { explicit = false } = {}) {
    const seq = ++searchSeq;
    const query = String(q ?? '').trim();
    if (query.length < 2) { results.hidden = true; return; }
    if (query === handledText) return; // paste 에서 이미 처리한 링크
    if (applyPastedCoords(q)) return;
    const runOsm = async () => {
      let found = cache.get('osm', query);
      if (!found) {
        try { found = await searchPlaces(query); cache.set('osm', query, found); }
        catch (err) {
          console.error(err);
          if (seq === searchSeq) toast('검색에 실패했어요. 잠시 후 다시 시도해 주세요', { kind: 'error' });
          return;
        }
      }
      if (seq === searchSeq) showResults(found.map(osmResult), { osm: true });
    };
    // 오늘 구글 자동완성이나 위치 확인 한도를 다 썼으면 처음부터 OpenStreetMap (구글 결과는 골라도 위치를 못 받는다)
    if (pickSearchSource({ placesHit: isQuotaHit('places'), detailsHit: isQuotaHit('details') }) === 'osm') {
      if (explicit || cache.get('osm', query)) await runOsm();
      else showResults([osmPrompt(query)]);
      return;
    }
    if (!explicit && !isSearchable(query)) return; // "센소ㅈ" 처럼 아직 치는 중이면 지난 결과를 그대로 둔다
    let found = cache.get('google', query);
    if (!found) {
      try { found = await placeSearch.suggest(query, { near }); cache.set('google', query, found); }
      catch (err) {
        // 구글 검색이 안 되면(하루 한도 초과, 네트워크) OpenStreetMap 으로. 입력 중이면 엔터를 기다린다
        console.warn('places search', err);
        notifyQuota('places', err);
        if (seq !== searchSeq) return;
        if (explicit) await runOsm();
        else showResults([osmPrompt(query)]);
        return;
      }
    }
    if (seq === searchSeq) showResults(found.map(googleResult));
  }
  const runSearch = debounce((q) => doSearch(q), 600);
  search.addEventListener('input', () => runSearch(search.value));
  // 검색칸의 엔터는 장소 저장이 아니라 바로 검색 (한글 조합을 확정하는 엔터는 확정만)
  search.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!e.isComposing) doSearch(search.value, { explicit: true });
  });
  search.addEventListener('paste', () => setTimeout(() => handlePasted(search.value), 0));

  // 이미 위치가 정해진 장소면 Google 지도의 그 장소 페이지(사진·평점·영업시간)를 바로 연다
  const googleBtn = el('a', {
    class: 'btn btn-sm', target: '_blank', rel: 'noopener', href: googleMapsSearchUrl(''),
    onClick: (e) => {
      const q = name.value.trim() || search.value.trim();
      e.currentTarget.href = draft.placeId || draft.lat != null
        ? googleMapsPlaceUrl({ placeId: draft.placeId, name: q, lat: draft.lat, lng: draft.lng })
        : googleMapsSearchUrl(search.value.trim() || q);
    },
  }, icon('map'), 'Google 지도에서 찾기');
  const directionsBtn = el('a', { class: 'btn btn-sm', target: '_blank', rel: 'noopener', href: '#', hidden: true, title: '현재 위치에서 여기까지' }, '여기로 길찾기');
  const hint = el('p', { class: 'muted ps-hint', text: 'Google 지도 앱에서 "공유"로 복사한 내용을 붙여넣으면 그 이름으로 검색해요. 주소창의 긴 링크나 "위도, 경도"는 바로 핀이 찍혀요.' });

  const field = el('div', { class: 'field' },
    el('div', { class: 'ps-search-head' }, el('label', { for: 'ps-search', text: '장소 검색' }), el('div', { class: 'ps-head-actions' }, directionsBtn, googleBtn)),
    search, results, location, hint);
  draw();

  return {
    field, search, draw,
    // 공유로 받은 글: 좌표·짧은 링크면 그대로 처리, 아니면(그냥 장소 이름 등) 그 글로 검색
    applyShared(text) { search.value = text; setTimeout(() => { if (!handlePasted(text)) doSearch(text, { explicit: true }); }, 0); },
  };
}
