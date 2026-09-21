import { el, toast, confirmDialog, icon, photoPath, CATEGORY_LABELS, CATEGORY_ORDER } from '../ui.js';
import { addPlace, updatePlace, deletePlace, movePlaceToDay, watchPhotos, addPhoto, deletePhoto } from '../db.js';
import { searchPlaces, debounce } from '../geocode.js';
import { createPlaceSearch } from '../places.js';
import { parseCoordsInput, googleMapsSearchUrl } from '../lib/coords.js';
import { compressImage, bytesToObjectUrl } from '../photo.js';
import { imageFilesFrom } from '../lib/clipboard.js';
import { formatShort } from '../lib/dates.js';

// kind: 'place'(기본) 또는 'note'(장소 없는 메모 항목). days를 주면 기존 항목을 다른 Day로 옮길 수 있다.
// near: 검색 결과를 우선 보여줄 기준 좌표 (보통 그 날의 마지막 장소)
export function openPlaceSheet({ tripId, dayId, dayIndex, place = null, kind = 'place', days = [], near = null }) {
  const placeSearch = createPlaceSearch();
  const noteMode = kind === 'note' || place?.category === 'note';
  const draft = {
    name: place?.name ?? '', time: place?.time ?? '', stayMinutes: place?.stayMinutes ?? '',
    category: place?.category ?? (noteMode ? 'note' : 'sight'), memo: place?.memo ?? '',
    lat: place?.lat ?? null, lng: place?.lng ?? null, address: place?.address ?? null,
    photos: [...(place?.photos ?? [])],
  };

  const search = el('input', { class: 'input', id: 'ps-search', type: 'search', placeholder: '장소 이름이나 주소로 검색', autocomplete: 'off' });
  const results = el('div', { class: 'search-results', hidden: true });
  const name = el('input', { class: 'input', id: 'ps-name', value: draft.name, required: true, placeholder: noteMode ? '예: 점심 먹기, 12시까지 공항으로' : '장소 이름' });
  // 기존 항목만 다른 Day로 옮길 수 있다
  const daySelect = place && days.length > 1 ? el('select', { class: 'input', id: 'ps-day' },
    ...days.map((d, i) => el('option', { value: d.id, selected: d.id === place.dayId, text: `Day ${i + 1} · ${formatShort(d.date)}` }))) : null;
  const time = el('input', { class: 'input', id: 'ps-time', type: 'time', value: draft.time });
  const stay = el('input', { class: 'input', id: 'ps-stay', type: 'number', min: '0', step: '5', value: draft.stayMinutes, placeholder: '분' });
  const memo = el('textarea', { class: 'input', id: 'ps-memo', rows: '3', placeholder: '메모' });
  memo.value = draft.memo;
  const location = el('p', { class: 'muted ps-location' });
  const photoList = el('div', { class: 'photo-list' });
  const fileInput = el('input', { type: 'file', id: 'ps-photo', accept: 'image/*', multiple: true, class: 'visually-hidden' });
  const uploadBtn = el('button', { type: 'button', class: 'btn btn-sm', onClick: () => fileInput.click() }, icon('plus'), '사진 올리기');
  const photoStatus = el('span', { class: 'muted ps-photo-status' });
  const categoryRow = el('div', { class: 'chips' });

  // 저장된 사진(Firestore)과 아직 저장 전인 사진(새 장소일 때 대기열)
  let savedPhotos = [];
  let pendingPhotos = [];
  const objectUrls = new Set();
  let unsubPhotos = null;
  const urlFor = (bytes) => { const u = bytesToObjectUrl(bytes); objectUrls.add(u); return u; };
  const revokeAll = () => { objectUrls.forEach((u) => URL.revokeObjectURL(u)); objectUrls.clear(); };

  function drawLocation() {
    location.textContent = draft.lat != null ? `위치 설정됨 · ${draft.address ?? `${draft.lat.toFixed(4)}, ${draft.lng.toFixed(4)}`}` : '위치 없음 · 검색해서 고르면 지도에 표시돼요';
  }

  function drawCategories() {
    categoryRow.replaceChildren(...CATEGORY_ORDER.map((key) => el('button', {
      type: 'button', class: `chip${draft.category === key ? ' active' : ''}`,
      onClick: () => { draft.category = key; drawCategories(); },
    }, CATEGORY_LABELS[key])));
  }

  function openLightbox(src) {
    const box = el('div', { class: 'lightbox', onClick: () => box.remove() },
      el('img', { src, alt: '' }),
      el('button', { type: 'button', class: 'btn btn-icon lightbox-close', 'aria-label': '닫기' }, icon('close')));
    document.body.append(box);
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
      pendingPhotos = pendingPhotos.filter((x) => x !== p); drawPhotos();
    }));
    // 예전 방식(GitHub photos 폴더 파일명)으로 남아 있는 사진은 그대로 보여 준다.
    const legacy = draft.photos.map((file) => el('div', { class: 'photo-chip' },
      el('img', { src: photoPath(tripId, file), alt: '', onError: (e) => { e.target.replaceWith(el('span', { class: 'photo-missing', text: file })); } }),
      el('button', { type: 'button', class: 'photo-remove', 'aria-label': `${file} 제거`, onClick: () => { draft.photos = draft.photos.filter((f) => f !== file); drawPhotos(); } }, icon('close'))));
    photoList.replaceChildren(...saved, ...pending, ...legacy);
    photoStatus.textContent = pendingPhotos.length ? `저장하면 사진 ${pendingPhotos.length}장이 함께 올라가요` : '';
  }

  async function uploadPhotos(placeId, items) {
    for (let i = 0; i < items.length; i++) {
      photoStatus.textContent = `사진 올리는 중 ${i + 1} / ${items.length}`;
      await addPhoto(tripId, { placeId, bytes: items[i].bytes, width: items[i].width, height: items[i].height });
    }
    photoStatus.textContent = '';
  }

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
      pendingPhotos = [...pendingPhotos, ...compressed];
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
      if (!navigator.clipboard?.read) { toast('이 브라우저는 클립보드 읽기를 지원하지 않아요. Ctrl+V로 붙여넣어 보세요', { kind: 'error', ms: 4000 }); return; }
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
        toast(err?.name === 'NotAllowedError' ? '클립보드 접근이 거부됐어요. Ctrl+V로 붙여넣어 보세요' : '클립보드를 읽지 못했어요', { kind: 'error', ms: 4000 });
      }
    },
  }, '클립보드에서 붙여넣기');

  if (place) {
    unsubPhotos = watchPhotos(tripId, place.id, (photos) => { savedPhotos = photos; drawPhotos(); },
      (err) => { console.error(err); toast('사진을 불러오지 못했어요', { kind: 'error' }); });
  }

  // Google 지도 링크나 "위도, 경도"를 붙여넣으면 검색 대신 좌표를 바로 채운다.
  function applyPastedCoords(text) {
    const coords = parseCoordsInput(text);
    if (!coords) return false;
    draft.lat = coords.lat; draft.lng = coords.lng;
    draft.address = `붙여넣은 좌표 ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
    results.hidden = true; search.value = '';
    drawLocation();
    toast('좌표를 가져왔어요. 이름을 적어 주세요');
    if (!name.value.trim()) name.focus();
    return true;
  }

  function pickResult(r) {
    draft.lat = r.lat; draft.lng = r.lng; draft.address = r.address;
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
          toast('위치를 가져오지 못했어요. 다시 골라 주세요', { kind: 'error' });
        }
      },
    }, el('strong', { text: r.name }), el('span', { class: 'muted', text: r.address }));
    return btn;
  }

  let searchSeq = 0; // 늦게 도착한 이전 검색 응답이 최신 결과를 덮지 않도록
  const runSearch = debounce(async (q) => {
    const seq = ++searchSeq;
    const query = q.trim();
    if (query.length < 2) { results.hidden = true; return; }
    if (applyPastedCoords(q)) return;
    let items = null;
    try {
      items = (await placeSearch.suggest(query, { near })).map(googleResult);
    } catch (err) {
      // Google 검색이 안 되면(하루 한도 초과, 네트워크) OpenStreetMap 으로 대신 찾는다
      console.warn('places autocomplete', err);
      try {
        items = (await searchPlaces(query)).map((r) => el('button', { type: 'button', class: 'search-result', onClick: () => pickResult(r) },
          el('strong', { text: r.name }), el('span', { class: 'muted', text: r.address })));
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
  const googleBtn = el('a', {
    class: 'btn btn-sm', target: '_blank', rel: 'noopener', href: googleMapsSearchUrl(''),
    onClick: (e) => { e.currentTarget.href = googleMapsSearchUrl(search.value.trim() || name.value.trim()); },
  }, icon('pin'), 'Google 지도에서 찾기');
  const hint = el('p', { class: 'muted ps-hint', text: 'Google 지도에서 찾은 장소의 공유 링크나 "위도, 경도"를 검색창에 붙여넣으면 핀이 찍혀요.' });
  const overlay = el('div', { class: 'sheet-overlay' });
  const form = el('form', { class: 'sheet' });
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('paste', onPaste);
    if (unsubPhotos) unsubPhotos();
    revokeAll();
  }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = noteMode
      ? { name: name.value.trim(), time: time.value || null, stayMinutes: null, category: 'note', memo: memo.value, lat: null, lng: null, address: null, photos: [] }
      : {
        name: name.value.trim(), time: time.value || null,
        stayMinutes: stay.value === '' ? null : Number(stay.value),
        category: draft.category, memo: memo.value,
        lat: draft.lat, lng: draft.lng, address: draft.address, photos: draft.photos,
      };
    if (!data.name) { toast(noteMode ? '메모 내용을 입력해 주세요' : '장소 이름을 입력해 주세요', { kind: 'error' }); name.focus(); return; }
    try {
      if (place) {
        await updatePlace(tripId, place.id, data);
        if (daySelect && daySelect.value !== place.dayId) await movePlaceToDay(tripId, place.id, daySelect.value);
      } else {
        const newId = await addPlace(tripId, { dayId, ...data });
        if (pendingPhotos.length) await uploadPhotos(newId, pendingPhotos);
      }
      toast(place ? (daySelect && daySelect.value !== place.dayId ? '다른 날로 옮겼어요' : '저장했어요') : (noteMode ? '메모를 추가했어요' : '일정에 추가했어요'));
      close();
    } catch (err) {
      console.error(err);
      toast('저장하지 못했어요', { kind: 'error' });
    }
  });

  const dayField = daySelect ? el('div', { class: 'field' }, el('label', { for: 'ps-day', text: '날짜 (다른 Day로 옮기기)' }), daySelect) : null;
  const title = place ? (noteMode ? '메모 편집' : '장소 편집') : `${noteMode ? '메모' : '장소'} 추가 · Day ${dayIndex + 1}`;
  const body = noteMode
    ? el('div', { class: 'sheet-body' },
      el('div', { class: 'field' }, el('label', { for: 'ps-name', text: '메모 내용' }), name),
      el('div', { class: 'field' }, el('label', { for: 'ps-time', text: '시간 (선택)' }), time),
      dayField,
      el('div', { class: 'field' }, el('label', { for: 'ps-memo', text: '자세한 내용 (선택)' }), memo))
    : el('div', { class: 'sheet-body' },
      el('div', { class: 'field' },
        el('div', { class: 'ps-search-head' }, el('label', { for: 'ps-search', text: '장소 검색' }), googleBtn),
        search, results, location, hint),
      el('div', { class: 'field' }, el('label', { for: 'ps-name', text: '이름' }), name),
      el('div', { class: 'form-grid' },
        el('div', { class: 'field' }, el('label', { for: 'ps-time', text: '시간' }), time),
        el('div', { class: 'field' }, el('label', { for: 'ps-stay', text: '머무는 시간(분)' }), stay)),
      dayField,
      el('div', { class: 'field' }, el('label', { text: '분류' }), categoryRow),
      el('div', { class: 'field' }, el('label', { for: 'ps-memo', text: '메모' }), memo),
      el('div', { class: 'field' },
        el('div', { class: 'ps-search-head' }, el('label', { for: 'ps-photo', text: '사진' }), el('div', { class: 'ps-photo-actions' }, uploadBtn, clipboardBtn)),
        photoList, fileInput, photoStatus,
        el('p', { class: 'muted ps-hint', text: '긴 변 1280px로 줄여서 저장돼요. 복사한 사진은 Ctrl+V로도 붙여넣을 수 있어요.' })));
  form.append(
    el('div', { class: 'sheet-head' },
      el('h2', { text: title }),
      el('button', { type: 'button', class: 'btn btn-icon', 'aria-label': '닫기', onClick: close }, icon('close'))),
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
        el('button', { type: 'button', class: 'btn', onClick: close }, '취소'),
        el('button', { type: 'submit', class: 'btn btn-primary' }, place ? '저장' : (noteMode ? '메모 추가' : '일정에 추가')))));

  drawLocation(); drawCategories(); drawPhotos();
  overlay.append(form);
  document.body.append(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  (place || noteMode ? name : search).focus();
  return close;
}
