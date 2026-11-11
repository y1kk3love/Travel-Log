import { el, toast, confirmDialog, icon, overlays, CATEGORY_LABELS, CATEGORY_ORDER, onSubmit, linkedText } from '../ui.js';
import { addPlace, updatePlace, deletePlace, movePlaceToDay } from '../db.js';
import { extractLinks, shortLabel } from '../lib/text.js';
import { googleMapsPlaceUrl, googleMapsDirectionsUrl } from '../lib/coords.js';
import { changedFields, hasChanges } from '../lib/changes.js';
import { formatShort } from '../lib/dates.js';
import { sheetBackdrop, restyle } from '../motion.js';
import { enableSwipeClose } from '../sheet-swipe.js';
import { createLocationField } from './place-location.js';
import { createPhotoSection } from './place-photos.js';

// 장소 창. 있는 장소를 열면 먼저 "보기"(메모·사진·길찾기)가 뜨고, "편집"을 눌러야 입력 폼으로 바뀐다
// (여행 중에는 고치려는 게 아니라 읽으려고 연다). 새 장소·메모는 바로 입력 폼.
// 검색 칸은 place-location.js, 사진 칸은 place-photos.js, 끌어 닫기는 sheet-swipe.js.
// kind: 'place'(기본) 또는 'note'(장소 없는 메모 항목). days를 주면 기존 항목을 다른 Day로 옮길 수 있다.
// near: 검색 결과를 우선 보여줄 기준 좌표 (보통 그 날의 마지막 장소)
// sharedText: 앱의 공유 시트로 받은 텍스트 (검색창에 붙여넣은 것처럼 처리)
let sheetSeq = 0;
export function openPlaceSheet({ tripId, dayId, dayIndex, place = null, kind = 'place', days = [], near = null, sharedText = null }) {
  const noteMode = kind === 'note' || place?.category === 'note';
  const draft = {
    category: place?.category ?? (noteMode ? 'note' : 'sight'),
    lat: place?.lat ?? null, lng: place?.lng ?? null, address: place?.address ?? null,
    placeId: place?.placeId ?? null, // 구글 장소 ID (검색으로 고른 장소만)
  };
  let dirty = false; // 저장하지 않은 편집이 있나 (닫을 때 물어본다)
  const markDirty = () => { dirty = true; };

  const name = el('input', { class: 'input', id: 'ps-name', value: place?.name ?? '', required: true, placeholder: noteMode ? '예: 점심 먹기, 12시까지 공항으로' : '장소 이름' });
  // 날짜 선택: 장소는 "보관함(날짜 미정)"에 둘 수도 있다. 메모 항목은 기존 것만 다른 Day 로 옮긴다.
  const currentDayId = place ? (place.dayId ?? null) : (dayId ?? null);
  const showDaySelect = noteMode ? (place && days.length > 1) : days.length > 0;
  const daySelect = showDaySelect ? el('select', { class: 'input', id: 'ps-day' },
    ...(noteMode ? [] : [el('option', { value: '', selected: currentDayId == null, text: '보관함 (날짜 미정)' })]),
    ...days.map((d, i) => el('option', { value: d.id, selected: d.id === currentDayId, text: `Day ${i + 1} · ${formatShort(d.date)}` }))) : null;
  const chosenDayId = () => (daySelect ? (daySelect.value || null) : currentDayId);
  const time = el('input', { class: 'input', id: 'ps-time', type: 'time', value: place?.time ?? '' });
  const stay = el('input', { class: 'input', id: 'ps-stay', type: 'number', min: '0', step: '5', value: place?.stayMinutes ?? '', placeholder: '분' });
  const memo = el('textarea', { class: 'input', id: 'ps-memo', rows: '3', placeholder: '메모 (링크를 넣으면 바로 열 수 있어요)' });
  memo.value = place?.memo ?? '';
  // 메모 속 링크를 버튼으로 (블로그 글, 예약 페이지 등)
  const linkButtons = (text) => extractLinks(text).map((href) => el('a', { class: 'btn btn-sm', href, target: '_blank', rel: 'noopener', text: shortLabel(href) }));
  const memoLinks = el('div', { class: 'memo-links' });
  const drawMemoLinks = () => memoLinks.replaceChildren(...linkButtons(memo.value));
  memo.addEventListener('input', drawMemoLinks);
  drawMemoLinks();

  const categoryRow = el('div', { class: 'chips' });
  function drawCategories() {
    categoryRow.replaceChildren(...CATEGORY_ORDER.map((key) => el('button', {
      type: 'button', class: `chip${draft.category === key ? ' active' : ''}`, 'aria-pressed': String(draft.category === key),
      onClick: () => { draft.category = key; markDirty(); drawCategories(); },
    }, CATEGORY_LABELS[key])));
  }
  drawCategories();

  const location = noteMode ? null : createLocationField({ draft, name, near, onDirty: markDirty });
  const photos = noteMode ? null : createPhotoSection({ tripId, place, onDirty: markDirty });

  // ---- 보기 화면 (있는 장소·메모): 여행 중에 읽는 것 먼저 — 시간·분류, 길찾기, 메모, (그 아래 사진) ----
  function viewBox() {
    const dayIdx = days.findIndex((d) => d.id === place.dayId);
    const where = dayIdx < 0 ? '보관함' : `Day ${dayIdx + 1} · ${formatShort(days[dayIdx].date)}`;
    const hasCoords = place.lat != null && place.lng != null;
    return el('div', { class: 'place-view' },
      el('div', { class: 'place-view-meta' },
        place.time ? el('span', { class: 'place-view-time', text: place.time }) : null,
        el('span', { class: 'tag', text: CATEGORY_LABELS[place.category] ?? '기타' }),
        place.stayMinutes ? el('span', { class: 'muted', text: `${place.stayMinutes}분 머무름` }) : null,
        el('span', { class: 'muted', text: where })),
      !noteMode && place.address ? el('p', { class: 'muted place-view-address', text: place.address }) : null,
      hasCoords ? el('div', { class: 'place-view-actions' },
        el('a', { class: 'btn btn-tint', target: '_blank', rel: 'noopener', href: googleMapsDirectionsUrl({ to: { lat: place.lat, lng: place.lng, placeId: place.placeId } }) }, icon('navigation'), '여기로 길찾기'),
        el('a', { class: 'btn btn-tint', target: '_blank', rel: 'noopener', href: googleMapsPlaceUrl({ placeId: place.placeId, name: place.name, lat: place.lat, lng: place.lng }) }, icon('map'), 'Google 지도')) : null,
      place.memo
        ? el('div', { class: 'place-view-memo' }, el('p', { class: 'pre-wrap' }, linkedText(place.memo))) // 링크는 글 안에서 바로 눌린다
        : el('p', { class: 'muted place-view-empty', text: noteMode ? '자세한 내용이 없어요' : '메모가 없어요. "편집"에서 적어 둘 수 있어요' }));
  }

  // ---- 편집 폼 ----
  const dayField = daySelect ? el('div', { class: 'field' }, el('label', { for: 'ps-day', text: noteMode ? '날짜 (다른 Day로 옮기기)' : '날짜' }), daySelect) : null;
  const editBox = noteMode
    ? el('div', { class: 'place-edit' },
      el('div', { class: 'field' }, el('label', { for: 'ps-name', text: '메모 내용' }), name),
      el('div', { class: 'field' }, el('label', { for: 'ps-time', text: '시간 (선택)' }), time),
      dayField,
      el('div', { class: 'field' }, el('label', { for: 'ps-memo', text: '자세한 내용 (선택)' }), memo))
    : el('div', { class: 'place-edit' },
      location.field,
      el('div', { class: 'field' }, el('label', { for: 'ps-name', text: '이름' }), name),
      el('div', { class: 'form-grid' },
        el('div', { class: 'field' }, el('label', { for: 'ps-time', text: '시간' }), time),
        el('div', { class: 'field' }, el('label', { for: 'ps-stay', text: '머무는 시간(분)' }), stay)),
      dayField,
      el('div', { class: 'field' }, el('label', { text: '분류' }), categoryRow),
      el('div', { class: 'field' }, el('label', { for: 'ps-memo', text: '메모' }), memo, memoLinks));

  const where = currentDayId == null ? '보관함' : `Day ${dayIndex + 1}`;
  const editTitle = place ? (noteMode ? '메모 편집' : '장소 편집') : `${noteMode ? '메모' : '장소'} 추가 · ${where}`;
  const titleId = `sheet-title-${++sheetSeq}`;
  const heading = el('h2', { id: titleId });
  const view = place ? viewBox() : null;
  const body = el('div', { class: 'sheet-body' }, view, editBox, photos?.field);

  const overlay = el('div', { class: 'sheet-overlay' });
  // 화면 낭독기·키보드에 "대화상자"로 알린다. 뒤 화면(#app)은 창이 열린 동안 inert 로 잠가 포커스가 창 밖으로 나가지 않는다
  const form = el('form', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' });
  const onKey = (e) => { if (e.key === 'Escape' && sheetEntry.isTop()) requestClose(); }; // 위에 확인 창·사진이 떠 있으면 그것만 닫힌다
  form.addEventListener('input', (e) => { if (e.target !== location?.search) markDirty(); }); // 검색어 입력은 편집이 아니다
  form.addEventListener('change', (e) => { if (e.target !== location?.search && e.target.type !== 'file') markDirty(); });

  const app = document.getElementById('app');
  const opener = document.activeElement; // 닫으면 포커스를 연 자리(일정의 그 항목)로 돌려준다
  let closed = false;
  const backdrop = sheetBackdrop(); // 폰: 시트가 올라오면 뒤 화면이 살짝 작아진다
  // 바로 닫기 (저장 뒤, 다른 장소를 열 때, 화면을 떠날 때). 아래로 내려가며 사라진다
  function close() {
    if (closed) return;
    closed = true;
    sheetEntry.release();
    document.removeEventListener('keydown', onKey);
    photos?.dispose();
    if (app) app.inert = false;
    // 저장하면 일정이 다시 그려져 연 버튼이 새 것으로 바뀌므로, 한 박자 뒤에 지금 화면의 그 항목을 찾아 돌려준다
    requestAnimationFrame(() => {
      if (document.querySelector('.sheet-overlay.open')) return; // 그 사이 다른 창이 열렸다
      const item = place ? document.querySelector(`[data-id="${place.id}"] .tl-open, [data-id="${place.id}"] .tl-body`) : null;
      (item ?? (opener?.isConnected ? opener : null))?.focus?.({ preventScroll: true });
    });
    overlay.style.background = '';
    form.style.transition = ''; overlay.style.transition = ''; form.style.transform = ''; // 끄던 자리에서 그대로 아래로 내려간다
    overlay.classList.remove('open');
    overlay.classList.add('closing');
    backdrop.close();
    setTimeout(() => overlay.remove(), 320);
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

  // 창을 연 시점의 값. 저장할 때 이것과 달라진 필드만 쓴다 — 그 사이 동행이 고친 다른 필드(메모 등)를 덮어쓰지 않게
  const base = place ? {
    name: place.name ?? '', time: place.time ?? null, stayMinutes: place.stayMinutes ?? null, category: place.category ?? 'sight', memo: place.memo ?? '',
    lat: place.lat ?? null, lng: place.lng ?? null, address: place.address ?? null, placeId: place.placeId ?? null,
  } : null;

  onSubmit(form, async (e) => { // 저장 중 연타 막기
    e.preventDefault();
    if (mode === 'view') return;
    const data = noteMode
      ? { name: name.value.trim(), time: time.value || null, stayMinutes: null, category: 'note', memo: memo.value, lat: null, lng: null, address: null }
      : {
        name: name.value.trim(), time: time.value || null,
        stayMinutes: stay.value === '' ? null : Number(stay.value),
        category: draft.category, memo: memo.value,
        lat: draft.lat, lng: draft.lng, address: draft.address, placeId: draft.placeId,
      };
    if (!data.name) { toast(noteMode ? '메모 내용을 입력해 주세요' : '장소 이름을 입력해 주세요', { kind: 'error' }); name.focus(); return; }
    try {
      const target = chosenDayId();
      const moved = place && target !== (place.dayId ?? null);
      if (place) {
        const changes = changedFields(base, data);
        if (hasChanges(changes)) await updatePlace(tripId, place.id, changes);
        if (moved) await movePlaceToDay(tripId, place.id, target);
      } else if (createdId) {
        await updatePlace(tripId, createdId, data);
        if (target !== createdDayId) { await movePlaceToDay(tripId, createdId, target); createdDayId = target; }
        if (photos?.hasPending()) await photos.uploadPending(createdId);
      } else {
        createdId = await addPlace(tripId, { dayId: target, ...data });
        createdDayId = target;
        if (photos?.hasPending()) await photos.uploadPending(createdId);
      }
      close(); // 먼저 닫아야 알림이 (내려가는) 시트 버튼 위가 아닌 제자리에 뜬다
      toast(place ? (moved ? (target ? '다른 날로 옮겼어요' : '보관함으로 옮겼어요') : '저장했어요')
        : (noteMode ? '메모를 추가했어요' : (target ? '일정에 추가했어요' : '보관함에 담았어요')));
    } catch (err) {
      console.error(err);
      toast('저장하지 못했어요', { kind: 'error' });
    }
  });
  // 새 장소를 만든 뒤 사진 올리기가 실패하면, 다시 저장할 때 또 만들지 않고 이 장소를 고친다 (그 사이 날짜를 바꾸면 그 날 끝으로 옮긴다)
  let createdId = null;
  let createdDayId = null;

  // 보기 ↔ 편집. 버튼 줄도 함께 바뀐다: 보기는 [닫기] [편집], 편집은 [삭제] … [취소] [저장]
  const deleteBtn = place ? el('button', {
    type: 'button', class: 'btn btn-danger',
    onClick: async () => {
      if (!(await confirmDialog(`'${place.name}'을(를) 일정에서 삭제할까요?`))) return;
      try { await deletePlace(tripId, place.id); close(); toast('삭제했어요'); }
      catch (err) { console.error(err); toast('삭제하지 못했어요', { kind: 'error' }); }
    },
  }, '삭제') : el('span');
  const cancelBtn = el('button', { type: 'button', class: 'btn', onClick: () => requestClose() }, '취소');
  const saveBtn = el('button', { type: 'submit', class: 'btn btn-primary' }, place ? '저장' : (noteMode ? '메모 추가' : '추가'));
  const closeBtn = el('button', { type: 'button', class: 'btn', onClick: () => requestClose() }, '닫기');
  const editBtn = el('button', { type: 'button', class: 'btn btn-primary', onClick: () => setMode('edit') }, icon('edit'), '편집');
  const foot = el('div', { class: 'sheet-foot' });
  let mode = null;
  function setMode(next) {
    mode = next;
    const viewing = mode === 'view';
    form.classList.toggle('viewing', viewing);
    if (view) view.hidden = !viewing;
    editBox.hidden = viewing;
    heading.textContent = viewing ? (place.name || (noteMode ? '메모' : '(이름 없음)')) : editTitle;
    foot.replaceChildren(...(viewing
      ? [el('span'), el('div', { class: 'sheet-foot-right' }, closeBtn, editBtn)]
      : [deleteBtn, el('div', { class: 'sheet-foot-right' }, cancelBtn, saveBtn)]));
    if (!viewing && place) { body.scrollTop = 0; form.focus({ preventScroll: true }); }
  }

  const sheetHead = el('div', { class: 'sheet-head' }, heading,
    el('button', { type: 'button', class: 'btn btn-icon', 'aria-label': '닫기', onClick: () => requestClose() }, icon('close')));
  form.append(sheetHead, body, foot);
  setMode(place ? 'view' : 'edit');

  overlay.append(form);
  document.body.append(overlay);
  if (app) app.inert = true;
  restyle(form);
  overlay.classList.add('open');
  backdrop.open();
  // 폰(아래 시트): 머리 부분을 끌어 닫는다. 저장 안 한 편집이 있으면 제자리에서 한 번 묻는다
  enableSwipeClose({
    handle: sheetHead, sheet: form, overlay, backdrop, isClosed: () => closed,
    onDismiss: (settle) => { if (dirty) { settle(); requestClose(); } else close(); },
  });
  // 새로 추가할 때만 입력칸에 커서 (있는 장소를 보려고 열었을 때 키보드가 화면 절반을 가리지 않게). 그 밖에는 창 자체에 포커스
  if (!place) (noteMode ? name : location.search).focus();
  else form.focus({ preventScroll: true });

  if (sharedText && location) location.applyShared(sharedText);
  return close;
}
