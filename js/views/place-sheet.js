import { el, toast, confirmDialog, icon, photoPath, CATEGORY_LABELS, CATEGORY_ORDER } from '../ui.js';
import { addPlace, updatePlace, deletePlace } from '../db.js';
import { searchPlaces, debounce } from '../geocode.js';

export function openPlaceSheet({ tripId, dayId, dayIndex, place = null }) {
  const draft = {
    name: place?.name ?? '', time: place?.time ?? '', stayMinutes: place?.stayMinutes ?? '',
    category: place?.category ?? 'sight', memo: place?.memo ?? '',
    lat: place?.lat ?? null, lng: place?.lng ?? null, address: place?.address ?? null,
    photos: [...(place?.photos ?? [])],
  };

  const search = el('input', { class: 'input', id: 'ps-search', type: 'search', placeholder: '장소 이름이나 주소로 검색', autocomplete: 'off' });
  const results = el('div', { class: 'search-results', hidden: true });
  const name = el('input', { class: 'input', id: 'ps-name', value: draft.name, required: true, placeholder: '장소 이름' });
  const time = el('input', { class: 'input', id: 'ps-time', type: 'time', value: draft.time });
  const stay = el('input', { class: 'input', id: 'ps-stay', type: 'number', min: '0', step: '5', value: draft.stayMinutes, placeholder: '분' });
  const memo = el('textarea', { class: 'input', id: 'ps-memo', rows: '3', placeholder: '메모' });
  memo.value = draft.memo;
  const location = el('p', { class: 'muted ps-location' });
  const photoList = el('div', { class: 'photo-list' });
  const photoInput = el('input', { class: 'input', id: 'ps-photo', placeholder: '파일명 (예: 01.jpg) 입력 후 Enter' });
  const categoryRow = el('div', { class: 'chips' });

  function drawLocation() {
    location.textContent = draft.lat != null ? `위치 설정됨 · ${draft.address ?? `${draft.lat.toFixed(4)}, ${draft.lng.toFixed(4)}`}` : '위치 없음 · 검색해서 고르면 지도에 표시돼요';
  }

  function drawCategories() {
    categoryRow.replaceChildren(...CATEGORY_ORDER.map((key) => el('button', {
      type: 'button', class: `chip${draft.category === key ? ' active' : ''}`,
      onClick: () => { draft.category = key; drawCategories(); },
    }, CATEGORY_LABELS[key])));
  }

  function drawPhotos() {
    photoList.replaceChildren(...draft.photos.map((file) => el('div', { class: 'photo-chip' },
      el('img', { src: photoPath(tripId, file), alt: '', onError: (e) => { e.target.replaceWith(el('span', { class: 'photo-missing', text: file })); } }),
      el('button', { type: 'button', class: 'photo-remove', 'aria-label': `${file} 제거`, onClick: () => { draft.photos = draft.photos.filter((f) => f !== file); drawPhotos(); } }, icon('close')))));
  }

  const runSearch = debounce(async (q) => {
    if (q.trim().length < 2) { results.hidden = true; return; }
    try {
      const found = await searchPlaces(q.trim());
      results.replaceChildren(...(found.length ? found.map((r) => el('button', {
        type: 'button', class: 'search-result',
        onClick: () => {
          draft.lat = r.lat; draft.lng = r.lng; draft.address = r.address;
          if (!name.value.trim()) name.value = r.name;
          results.hidden = true; search.value = '';
          drawLocation();
        },
      }, el('strong', { text: r.name }), el('span', { class: 'muted', text: r.address }))) : [el('p', { class: 'muted', text: '검색 결과가 없어요' })]));
      results.hidden = false;
    } catch (err) {
      console.error(err);
      toast('검색에 실패했어요. 잠시 후 다시 시도해 주세요', { kind: 'error' });
    }
  }, 600);
  search.addEventListener('input', () => runSearch(search.value));
  photoInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const file = photoInput.value.trim();
    if (file && !draft.photos.includes(file)) { draft.photos.push(file); drawPhotos(); }
    photoInput.value = '';
  });

  const overlay = el('div', { class: 'sheet-overlay' });
  const form = el('form', { class: 'sheet' });
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: name.value.trim(), time: time.value || null,
      stayMinutes: stay.value === '' ? null : Number(stay.value),
      category: draft.category, memo: memo.value,
      lat: draft.lat, lng: draft.lng, address: draft.address, photos: draft.photos,
    };
    if (!data.name) { toast('장소 이름을 입력해 주세요', { kind: 'error' }); name.focus(); return; }
    try {
      if (place) await updatePlace(tripId, place.id, data);
      else await addPlace(tripId, { dayId, ...data });
      toast(place ? '저장했어요' : '일정에 추가했어요');
      close();
    } catch (err) {
      console.error(err);
      toast('저장하지 못했어요', { kind: 'error' });
    }
  });

  form.append(
    el('div', { class: 'sheet-head' },
      el('h2', { text: place ? '장소 편집' : `장소 추가 · Day ${dayIndex + 1}` }),
      el('button', { type: 'button', class: 'btn btn-icon', 'aria-label': '닫기', onClick: close }, icon('close'))),
    el('div', { class: 'sheet-body' },
      el('div', { class: 'field' }, el('label', { for: 'ps-search', text: '장소 검색' }), search, results, location),
      el('div', { class: 'field' }, el('label', { for: 'ps-name', text: '이름' }), name),
      el('div', { class: 'form-grid' },
        el('div', { class: 'field' }, el('label', { for: 'ps-time', text: '시간' }), time),
        el('div', { class: 'field' }, el('label', { for: 'ps-stay', text: '머무는 시간(분)' }), stay)),
      el('div', { class: 'field' }, el('label', { text: '분류' }), categoryRow),
      el('div', { class: 'field' }, el('label', { for: 'ps-memo', text: '메모' }), memo),
      el('div', { class: 'field' }, el('label', { for: 'ps-photo', text: '사진 · GitHub photos 폴더에 올린 파일명' }), photoList, photoInput)),
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
        el('button', { type: 'submit', class: 'btn btn-primary' }, place ? '저장' : '일정에 추가'))));

  drawLocation(); drawCategories(); drawPhotos();
  overlay.append(form);
  document.body.append(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  (place ? name : search).focus();
  return close;
}
