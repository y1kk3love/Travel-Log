import { el, toast, confirmDialog, icon, photoPath, openLightbox, overlays, CATEGORY_LABELS, CATEGORY_ORDER, onSubmit, isTouchDevice } from '../ui.js';
import { addPlace, updatePlace, deletePlace, movePlaceToDay, watchPhotos, addPhoto, deletePhoto } from '../db.js';
import { searchPlaces, debounce } from '../geocode.js';
import { createPlaceSearch } from '../places.js';
import { notifyQuota, isQuotaHit } from '../quota.js';
import { extractLinks, shortLabel } from '../lib/text.js';
import { parseCoordsInput, parseShareText, googleMapsSearchUrl, googleMapsPlaceUrl, googleMapsDirectionsUrl, parseMapsLink } from '../lib/coords.js';
import { compressImage, bytesToObjectUrl } from '../photo.js';
import { imageFilesFrom } from '../lib/clipboard.js';
import { formatShort } from '../lib/dates.js';

// kind: 'place'(기본) 또는 'note'(장소 없는 메모 항목). days를 주면 기존 항목을 다른 Day로 옮길 수 있다.
// near: 검색 결과를 우선 보여줄 기준 좌표 (보통 그 날의 마지막 장소)
// sharedText: 앱의 공유 시트로 받은 텍스트 (검색창에 붙여넣은 것처럼 처리)
export function openPlaceSheet({ tripId, dayId, dayIndex, place = null, kind = 'place', days = [], near = null, sharedText = null }) {
  const placeSearch = createPlaceSearch();
  const noteMode = kind === 'note' || place?.category === 'note';
  const draft = {
    name: place?.name ?? '', time: place?.time ?? '', stayMinutes: place?.stayMinutes ?? '',
    category: place?.category ?? (noteMode ? 'note' : 'sight'), memo: place?.memo ?? '',
    lat: place?.lat ?? null, lng: place?.lng ?? null, address: place?.address ?? null,
    placeId: place?.placeId ?? null, // 구글 장소 ID (검색으로 고른 장소만)
    photos: [...(place?.photos ?? [])],
  };

  const search = el('input', { class: 'input', id: 'ps-search', type: 'search', placeholder: '장소 이름이나 주소로 검색', autocomplete: 'off' });
  const results = el('div', { class: 'search-results', hidden: true });
  const name = el('input', { class: 'input', id: 'ps-name', value: draft.name, required: true, placeholder: noteMode ? '예: 점심 먹기, 12시까지 공항으로' : '장소 이름' });
  // 날짜 선택: 장소는 "보관함(날짜 미정)"에 둘 수도 있다. 메모 항목은 기존 것만 다른 Day 로 옮긴다.
  const currentDayId = place ? (place.dayId ?? null) : (dayId ?? null);
  const showDaySelect = noteMode ? (place && days.length > 1) : days.length > 0;
  const daySelect = showDaySelect ? el('select', { class: 'input', id: 'ps-day' },
    ...(noteMode ? [] : [el('option', { value: '', selected: currentDayId == null, text: '보관함 (날짜 미정)' })]),
    ...days.map((d, i) => el('option', { value: d.id, selected: d.id === currentDayId, text: `Day ${i + 1} · ${formatShort(d.date)}` }))) : null;
  const chosenDayId = () => (daySelect ? (daySelect.value || null) : currentDayId);
  const time = el('input', { class: 'input', id: 'ps-time', type: 'time', value: draft.time });
  const stay = el('input', { class: 'input', id: 'ps-stay', type: 'number', min: '0', step: '5', value: draft.stayMinutes, placeholder: '분' });
  const memo = el('textarea', { class: 'input', id: 'ps-memo', rows: '3', placeholder: '메모 (링크를 넣으면 바로 열 수 있어요)' });
  memo.value = draft.memo;
  // 메모 속 링크를 버튼으로 (블로그 글, 예약 페이지 등)
  const memoLinks = el('div', { class: 'memo-links' });
  function drawMemoLinks() {
    memoLinks.replaceChildren(...extractLinks(memo.value).map((href) => el('a', { class: 'btn btn-sm', href, target: '_blank', rel: 'noopener', text: shortLabel(href) })));
  }
  memo.addEventListener('input', drawMemoLinks);
  drawMemoLinks();
  const location = el('p', { class: 'muted ps-location' });
  const photoList = el('div', { class: 'photo-list' });
  const fileInput = el('input', { type: 'file', id: 'ps-photo', accept: 'image/*', multiple: true, class: 'visually-hidden' });
  const uploadBtn = el('button', { type: 'button', class: 'btn btn-sm', onClick: () => fileInput.click() }, icon('plus'), '사진 올리기');
  const photoStatus = el('span', { class: 'muted ps-photo-status' });
  const categoryRow = el('div', { class: 'chips' });

  // 저장된 사진(Firestore)과 아직 저장 전인 사진(새 장소일 때 대기열)
  let savedPhotos = [];
  let pendingPhotos = [];
  let dirty = false; // 저장하지 않은 편집이 있나 (닫을 때 물어본다)
  const markDirty = () => { dirty = true; };
  const objectUrls = new Set();
  let unsubPhotos = null;
  const urlFor = (bytes) => { const u = bytesToObjectUrl(bytes); objectUrls.add(u); return u; };
  const revokeAll = () => { objectUrls.forEach((u) => URL.revokeObjectURL(u)); objectUrls.clear(); };

  function drawLocation() {
    location.textContent = draft.lat != null ? `위치 설정됨 · ${draft.address ?? `${draft.lat.toFixed(4)}, ${draft.lng.toFixed(4)}`}` : '위치 없음 · 검색해서 고르면 지도에 표시돼요';
    googleBtn.replaceChildren(icon('map'), draft.placeId || draft.lat != null ? 'Google 지도에서 보기' : 'Google 지도에서 찾기');
    // 위치가 있으면 현재 위치에서 이 장소까지 길찾기 (Google 지도 앱이 열린다)
    directionsBtn.hidden = draft.lat == null;
    if (draft.lat != null) directionsBtn.href = googleMapsDirectionsUrl({ to: { lat: draft.lat, lng: draft.lng, placeId: draft.placeId } });
  }

  function drawCategories() {
    categoryRow.replaceChildren(...CATEGORY_ORDER.map((key) => el('button', {
      type: 'button', class: `chip${draft.category === key ? ' active' : ''}`, 'aria-pressed': String(draft.category === key),
      onClick: () => { draft.category = key; markDirty(); drawCategories(); },
    }, CATEGORY_LABELS[key])));
  }

  function photoChip(src, label, onRemove) {
    return el('div', { class: 'photo-chip' },
      el('button', { type: 'button', class: 'photo-open', 'aria-label': `${label} 크게 보기`, onClick: () => openLightbox(src) }, el('img', { src, alt: '' })),
      el('button', { type: 'button', class: 'photo-remove', 'aria-label': `${label} 삭제`, onClick: onRemove }, icon('close')));
  }

  function drawPhotos() {
    revokeAll();
    const saved = savedPhotos.map((p, i) => photoChip(urlFor(p.bytes), `사진 ${i + 1}`, async () => {
      if (!(await confirmDialog('이 사진을 삭제할까요?'))) return;
      await deletePhoto(tripId, p.id, place.id).catch((err) => { console.error(err); toast('삭제하지 못했어요', { kind: 'error' }); });
    }));
    const pending = pendingPhotos.map((p, i) => photoChip(urlFor(p.bytes), `대기 중 사진 ${i + 1}`, () => {
      pendingPhotos = pendingPhotos.filter((x) => x !== p); markDirty(); drawPhotos();
    }));
    // 예전 방식(GitHub photos 폴더 파일명)으로 남아 있는 사진은 그대로 보여 준다.
    const legacy = draft.photos.map((file) => el('div', { class: 'photo-chip' },
      el('img', { src: photoPath(tripId, file), alt: '', onError: (e) => { e.target.replaceWith(el('span', { class: 'photo-missing', text: file })); } }),
      el('button', { type: 'button', class: 'photo-remove', 'aria-label': `${file} 제거`, onClick: () => { draft.photos = draft.photos.filter((f) => f !== file); drawPhotos(); } }, icon('close'))));
    photoList.replaceChildren(...saved, ...pending, ...legacy);
    photoStatus.textContent = pendingPhotos.length ? `저장하면 사진 ${pendingPhotos.length}장이 함께 올라가요` : '';
  }

  // 하나씩 올리고, 올라간 사진은 대기 목록에서 뺀다 (중간에 실패해 다시 저장하면 남은 것만 올린다)
  async function uploadPhotos(placeId, items) {
    const list = [...items];
    for (let i = 0; i < list.length; i++) {
      photoStatus.textContent = `사진 올리는 중 ${i + 1} / ${list.length}`;
      await addPhoto(tripId, { placeId, bytes: list[i].bytes, width: list[i].width, height: list[i].height });
      pendingPhotos = pendingPhotos.filter((x) => x !== list[i]);
    }
    photoStatus.textContent = '';
  }
  let createdId = null; // 새 장소를 만든 뒤 사진 올리기가 실패하면, 다시 저장할 때 또 만들지 않고 이 장소를 고친다

  async function handleFiles(files) {
    if (!files.length) return;
    const compressed = [];
    for (let i = 0; i < files.length; i++) {
      photoStatus.textContent = `사진 줄이는 중 ${i + 1} / ${files.length}`;
      try { compressed.push(await compressImage(files[i])); }
      catch (err) { console.error(err); toast(`${files[i].name}은(는) 열 수 없는 사진이에요`, { kind: 'error' }); }
    }
    if (!compressed.length) { photoStatus.textContent = ''; return; }
    if (place) {
      try { await uploadPhotos(place.id, compressed); toast(`사진 ${compressed.length}장을 올렸어요`); }
      catch (err) { console.error(err); photoStatus.textContent = ''; toast('사진을 올리지 못했어요', { kind: 'error' }); }
    } else {
      pendingPhotos = [...pendingPhotos, ...compressed]; markDirty();
      drawPhotos();
    }
  }

  fileInput.addEventListener('change', () => {
    const files = [...fileInput.files];
    fileInput.value = '';
    handleFiles(files);
  });

  // 클립보드 사진: 시트가 열린 동안 Ctrl+V(폰은 붙여넣기)로 들어오는 이미지 파일을 받는다.
  const onPaste = (e) => {
    const files = imageFilesFrom(e.clipboardData?.files);
    if (!files.length) return;
    e.preventDefault();
    handleFiles(files);
  };
  document.addEventListener('paste', onPaste);

  // 버튼으로 클립보드 읽기 (Chrome·Safari: 권한 요청이 뜰 수 있음)
  const clipboardBtn = el('button', {
    type: 'button', class: 'btn btn-sm',
    onClick: async () => {
      if (!navigator.clipboard?.read) { toast(isTouchDevice() ? '이 기기에서는 복사한 사진을 읽을 수 없어요. 사진 추가로 골라 주세요' : '이 브라우저는 클립보드 읽기를 지원하지 않아요. Ctrl+V로 붙여넣어 보세요', { kind: 'error', ms: 4000 }); return; }
      try {
        const items = await navigator.clipboard.read();
        const files = [];
        for (const item of items) {
          const type = item.types.find((t) => t.startsWith('image/'));
          if (type) files.push(new File([await item.getType(type)], `clipboard.${type.split('/')[1] || 'png'}`, { type }));
        }
        if (!files.length) { toast('클립보드에 사진이 없어요'); return; }
        await handleFiles(files);
      } catch (err) {
        console.error(err);
        toast(err?.name === 'NotAllowedError' ? (isTouchDevice() ? '복사한 사진에 접근할 수 없어요. 사진 추가로 골라 주세요' : '클립보드 접근이 거부됐어요. Ctrl+V로 붙여넣어 보세요') : '클립보드를 읽지 못했어요', { kind: 'error', ms: 4000 });
      }
    },
  }, '클립보드에서 붙여넣기');

  if (place) {
    unsubPhotos = watchPhotos(tripId, place.id, (photos) => { savedPhotos = photos; drawPhotos(); },
      (err) => { console.error(err); toast('사진을 불러오지 못했어요', { kind: 'error' }); });
  }

  // Google 지도 링크나 "위도, 경도"를 붙여넣으면 검색 대신 좌표를 바로 채운다.
  // 앱 '공유'의 짧은 링크에는 좌표가 없으므로, 같이 복사된 이름으로 검색을 돌린다.
  function applyPastedCoords(text) {
    // 긴 구글 지도 링크: 이름·좌표·장소 ID 를 한 번에. 좌표가 없고 장소 ID 만 있으면 이름으로 검색해 고르게 한다
    const link = parseMapsLink(text);
    if (link && (link.lat != null || link.placeId)) {
      if (link.name && !name.value.trim()) name.value = link.name;
      if (link.lat != null) {
        draft.lat = link.lat; draft.lng = link.lng; draft.placeId = link.placeId; markDirty();
        draft.address = link.name ? `구글 지도 링크 · ${link.name}` : `붙여넣은 좌표 ${link.lat.toFixed(5)}, ${link.lng.toFixed(5)}`;
        results.hidden = true; search.value = '';
        drawLocation();
        toast(link.name ? `'${link.name}' 위치를 가져왔어요` : '좌표를 가져왔어요. 이름을 적어 주세요');
      } else {
        search.value = link.name;
        toast(`'${link.name}'(으)로 검색했어요. 결과에서 골라 주세요`, { ms: 4000 });
        runSearch(link.name);
      }
      return true;
    }
    const coords = parseCoordsInput(text);
    if (coords) {
      draft.lat = coords.lat; draft.lng = coords.lng; draft.placeId = null; markDirty();
      draft.address = `붙여넣은 좌표 ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
      results.hidden = true; search.value = '';
      drawLocation();
      toast('좌표를 가져왔어요. 이름을 적어 주세요');
      if (!name.value.trim()) name.focus();
      return true;
    }
    const share = parseShareText(text);
    if (!share) return false;
    if (share.name) {
      search.value = share.name;
      if (!name.value.trim()) name.value = share.name;
      toast(`짧은 공유 링크에는 좌표가 없어서 '${share.name}'(으)로 검색했어요. 결과에서 골라 주세요`, { ms: 4500 });
      runSearch(share.name);
    } else {
      search.value = '';
      toast('이 짧은 링크에는 좌표가 없어요. 장소 이름으로 검색하거나, 링크를 연 뒤 주소창의 긴 주소를 붙여넣어 주세요', { kind: 'error', ms: 6000 });
    }
    return true;
  }

  function pickResult(r) {
    draft.lat = r.lat; draft.lng = r.lng; draft.address = r.address; draft.placeId = r.placeId ?? null; markDirty();
    if (!name.value.trim()) name.value = r.name;
    results.hidden = true; search.value = '';
    drawLocation();
  }

  // Google 자동완성 결과: 누르면 그때 위치·주소를 받아온다 (상세 조회 1건)
  function googleResult(r) {
    const btn = el('button', {
      type: 'button', class: 'search-result',
      onClick: async () => {
        btn.disabled = true;
        location.textContent = '위치 확인 중…';
        try { pickResult(await placeSearch.resolve(r)); }
        catch (err) {
          console.error(err);
          btn.disabled = false; drawLocation();
          if (notifyQuota('details', err)) {
            // 오늘 장소 상세 한도를 다 썼다: 같은 이름으로 OpenStreetMap 에서 다시 찾는다 (이후 검색도 OpenStreetMap)
            search.value = r.name; lastQuery = null; runSearch(r.name);
          } else toast('위치를 가져오지 못했어요. 다시 골라 주세요', { kind: 'error' });
        }
      },
    }, el('strong', { text: r.name }), el('span', { class: 'muted', text: r.address }));
    return btn;
  }

  let searchSeq = 0; // 늦게 도착한 이전 검색 응답이 최신 결과를 덮지 않도록
  let lastQuery = null; // 같은 검색어로는 다시 요청하지 않는다 (붙여넣기 두 번, 글자 지웠다 다시 치기)
  const runSearch = debounce(async (q) => {
    const seq = ++searchSeq;
    const query = q.trim();
    if (query.length < 2) { results.hidden = true; lastQuery = null; return; }
    if (applyPastedCoords(q)) return;
    if (query === lastQuery) { results.hidden = results.childElementCount === 0; return; }
    lastQuery = query;
    let items = null;
    const osmItems = async () => (await searchPlaces(query)).map((r) => el('button', { type: 'button', class: 'search-result', onClick: () => pickResult(r) },
      el('strong', { text: r.name }), el('span', { class: 'muted', text: r.address })));
    try {
      // 오늘 장소 상세 한도를 다 썼으면 Google 결과는 골라도 위치를 못 받으니 처음부터 OpenStreetMap 으로
      items = isQuotaHit('details') ? await osmItems() : (await placeSearch.suggest(query, { near })).map(googleResult);
    } catch (err) {
      // Google 검색이 안 되면(하루 한도 초과, 네트워크) OpenStreetMap 으로 대신 찾는다
      console.warn('places search', err);
      notifyQuota('places', err);
      try {
        items = await osmItems();
      } catch (err2) {
        console.error(err2);
        if (seq === searchSeq) toast('검색에 실패했어요. 잠시 후 다시 시도해 주세요', { kind: 'error' });
        return;
      }
    }
    if (seq !== searchSeq) return;
    results.replaceChildren(...(items.length ? items : [el('p', { class: 'muted', text: '검색 결과가 없어요' })]));
    results.hidden = false;
  }, 600);
  search.addEventListener('input', () => runSearch(search.value));
  search.addEventListener('paste', () => setTimeout(() => applyPastedCoords(search.value), 0));
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
  const overlay = el('div', { class: 'sheet-overlay' });
  let sheetHead = null;
  const form = el('form', { class: 'sheet' });
  const onKey = (e) => { if (e.key === 'Escape' && sheetEntry.isTop()) requestClose(); }; // 위에 확인 창·사진이 떠 있으면 그것만 닫힌다
  form.addEventListener('input', (e) => { if (e.target !== search) markDirty(); }); // 검색어 입력은 편집이 아니다
  form.addEventListener('change', (e) => { if (e.target !== search && e.target !== fileInput) markDirty(); });
  let closed = false;
  // 바로 닫기 (저장 뒤, 다른 장소를 열 때, 화면을 떠날 때). 아래로 내려가며 사라진다
  function close() {
    if (closed) return;
    closed = true;
    sheetEntry.release();
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('paste', onPaste);
    if (unsubPhotos) unsubPhotos();
    overlay.classList.remove('open');
    overlay.classList.add('closing');
    setTimeout(() => { overlay.remove(); revokeAll(); }, 320);
  }
  // 사용자가 닫을 때 (바깥·닫기·취소·Esc·뒤로가기·아래로 쓸기): 저장 안 한 편집이 있으면 한 번 묻는다
  async function requestClose() {
    if (closed) return;
    if (dirty && !(await confirmDialog('고친 내용을 저장하지 않고 닫을까요?', { okText: '닫기', cancelText: '계속 편집', danger: true }))) {
      if (!closed) { sheetEntry.release(); sheetEntry = overlays.push(() => requestClose()); } // 뒤로가기로 또 닫을 수 있게 다시 쌓는다
      form.style.transform = '';
      return;
    }
    close();
  }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) requestClose(); });
  let sheetEntry = overlays.push(() => requestClose()); // 안드로이드 뒤로가기로 닫힌다
  document.addEventListener('keydown', onKey);

  onSubmit(form, async (e) => { // 저장 중 연타 막기
    e.preventDefault();
    const data = noteMode
      ? { name: name.value.trim(), time: time.value || null, stayMinutes: null, category: 'note', memo: memo.value, lat: null, lng: null, address: null, photos: [] }
      : {
        name: name.value.trim(), time: time.value || null,
        stayMinutes: stay.value === '' ? null : Number(stay.value),
        category: draft.category, memo: memo.value,
        lat: draft.lat, lng: draft.lng, address: draft.address, placeId: draft.placeId, photos: draft.photos,
      };
    if (!data.name) { toast(noteMode ? '메모 내용을 입력해 주세요' : '장소 이름을 입력해 주세요', { kind: 'error' }); name.focus(); return; }
    try {
      const target = chosenDayId();
      const moved = place && target !== (place.dayId ?? null);
      if (place) {
        await updatePlace(tripId, place.id, data);
        if (moved) await movePlaceToDay(tripId, place.id, target);
      } else if (createdId) {
        await updatePlace(tripId, createdId, { ...data, dayId: target });
        if (pendingPhotos.length) await uploadPhotos(createdId, pendingPhotos);
      } else {
        createdId = await addPlace(tripId, { dayId: target, ...data });
        if (pendingPhotos.length) await uploadPhotos(createdId, pendingPhotos);
      }
      toast(place ? (moved ? (target ? '다른 날로 옮겼어요' : '보관함으로 옮겼어요') : '저장했어요')
        : (noteMode ? '메모를 추가했어요' : (target ? '일정에 추가했어요' : '보관함에 담았어요')));
      close();
    } catch (err) {
      console.error(err);
      toast('저장하지 못했어요', { kind: 'error' });
    }
  });

  const dayField = daySelect ? el('div', { class: 'field' }, el('label', { for: 'ps-day', text: noteMode ? '날짜 (다른 Day로 옮기기)' : '날짜' }), daySelect) : null;
  const where = currentDayId == null ? '보관함' : `Day ${dayIndex + 1}`;
  const title = place ? (noteMode ? '메모 편집' : '장소 편집') : `${noteMode ? '메모' : '장소'} 추가 · ${where}`;
  const body = noteMode
    ? el('div', { class: 'sheet-body' },
      el('div', { class: 'field' }, el('label', { for: 'ps-name', text: '메모 내용' }), name),
      el('div', { class: 'field' }, el('label', { for: 'ps-time', text: '시간 (선택)' }), time),
      dayField,
      el('div', { class: 'field' }, el('label', { for: 'ps-memo', text: '자세한 내용 (선택)' }), memo))
    : el('div', { class: 'sheet-body' },
      el('div', { class: 'field' },
        el('div', { class: 'ps-search-head' }, el('label', { for: 'ps-search', text: '장소 검색' }), el('div', { class: 'ps-head-actions' }, directionsBtn, googleBtn)),
        search, results, location, hint),
      el('div', { class: 'field' }, el('label', { for: 'ps-name', text: '이름' }), name),
      el('div', { class: 'form-grid' },
        el('div', { class: 'field' }, el('label', { for: 'ps-time', text: '시간' }), time),
        el('div', { class: 'field' }, el('label', { for: 'ps-stay', text: '머무는 시간(분)' }), stay)),
      dayField,
      el('div', { class: 'field' }, el('label', { text: '분류' }), categoryRow),
      el('div', { class: 'field' }, el('label', { for: 'ps-memo', text: '메모' }), memo, memoLinks),
      el('div', { class: 'field' },
        el('div', { class: 'ps-search-head' }, el('label', { for: 'ps-photo', text: '사진' }), el('div', { class: 'ps-photo-actions' }, uploadBtn, clipboardBtn)),
        photoList, fileInput, photoStatus,
        el('p', { class: 'muted ps-hint', text: isTouchDevice() ? '긴 변 1280px로 줄여서 저장돼요.' : '긴 변 1280px로 줄여서 저장돼요. 복사한 사진은 Ctrl+V로도 붙여넣을 수 있어요.' })));
  form.append(
    sheetHead = el('div', { class: 'sheet-head' },
      el('h2', { text: title }),
      el('button', { type: 'button', class: 'btn btn-icon', 'aria-label': '닫기', onClick: () => requestClose() }, icon('close'))),
    body,
    el('div', { class: 'sheet-foot' },
      place ? el('button', {
        type: 'button', class: 'btn btn-danger',
        onClick: async () => {
          if (!(await confirmDialog(`'${place.name}'을(를) 일정에서 삭제할까요?`))) return;
          try { await deletePlace(tripId, place.id); toast('삭제했어요'); close(); }
          catch (err) { console.error(err); toast('삭제하지 못했어요', { kind: 'error' }); }
        },
      }, '삭제') : el('span'),
      el('div', { class: 'sheet-foot-right' },
        el('button', { type: 'button', class: 'btn', onClick: () => requestClose() }, '취소'),
        el('button', { type: 'submit', class: 'btn btn-primary' }, place ? '저장' : (noteMode ? '메모 추가' : '추가')))));

  drawLocation(); drawCategories(); drawPhotos();
  overlay.append(form);
  document.body.append(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  enableSwipeClose(sheetHead);
  // 새로 추가할 때만 입력칸에 커서 (있는 장소를 보려고 열었을 때 키보드가 화면 절반을 가리지 않게)
  if (!place) (noteMode ? name : search).focus();

  // 폰(아래 시트): 머리 부분을 아래로 끌어 닫는다. 조금만 끌면 제자리로
  function enableSwipeClose(handle) {
    let startY = null;
    let dy = 0;
    handle.addEventListener('pointerdown', (e) => {
      if (!globalThis.matchMedia?.('(max-width: 900px)').matches || e.target.closest('button')) return;
      startY = e.clientY; dy = 0;
      form.style.transition = 'none';
      try { handle.setPointerCapture(e.pointerId); } catch { /* 합성 이벤트면 무시 */ }
    });
    handle.addEventListener('pointermove', (e) => {
      if (startY == null) return;
      dy = Math.max(0, e.clientY - startY);
      form.style.transform = `translateY(${dy}px)`;
    });
    const end = () => {
      if (startY == null) return;
      startY = null;
      form.style.transition = '';
      if (dy < 90) { form.style.transform = ''; return; }
      if (dirty) { requestClose(); return; } // 물어보는 동안은 끌던 자리에, 계속 편집하면 제자리로
      form.style.transform = 'translateY(100%)';
      close();
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }
  // 공유로 받은 텍스트: 좌표·짧은 링크면 그대로 처리, 아니면(그냥 장소 이름 등) 그 텍스트로 검색
  if (sharedText && !noteMode) { search.value = sharedText; setTimeout(() => { if (!applyPastedCoords(sharedText)) runSearch(sharedText); }, 0); }
  return close;
}
