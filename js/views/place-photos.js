// 장소 창의 "사진" 칸: 작은 썸네일만 받아 보여 주고, 원본은 눌러 크게 볼 때만 받는다.
// 있는 장소면 고르는 즉시 올리고, 새 장소면 대기열에 두었다가 저장할 때 함께 올린다. 장소 창(place-sheet.js)에서 떼어 낸 것.
import { el, toast, confirmDialog, icon, openLightbox, isTouchDevice } from '../ui.js';
import { watchThumbs, addPhoto, deletePhoto, getPhoto, listPhotos, addThumb, deleteThumb } from '../db.js';
import { compressImage, makeThumb, bytesToObjectUrl } from '../photo.js';
import { imageFilesFrom } from '../lib/clipboard.js';

// place: 있는 장소(없으면 새 장소). onDirty: 대기열이 바뀌어 저장할 게 생겼을 때
// 반환: { field, hasPending(), uploadPending(placeId), dispose() }
export function createPhotoSection({ tripId, place = null, onDirty = () => {} }) {
  const photoList = el('div', { class: 'photo-list' });
  const fileInput = el('input', { type: 'file', id: 'ps-photo', accept: 'image/*', multiple: true, class: 'visually-hidden' });
  const uploadBtn = el('button', { type: 'button', class: 'btn btn-sm', onClick: () => fileInput.click() }, icon('plus'), '사진 올리기');
  const photoStatus = el('span', { class: 'muted ps-photo-status' });

  let thumbs = [];        // 저장된 사진의 썸네일 [{ id, bytes, width, height }]
  let pendingPhotos = []; // 새 장소일 때 저장을 기다리는 사진 [{ bytes, width, height, thumb }]
  let disposed = false;
  const objectUrls = new Set();
  const fullUrls = new Map(); // 사진 id → 원본 주소 (이 창이 열린 동안 다시 받지 않는다)
  const urlFor = (bytes) => { const u = bytesToObjectUrl(bytes); objectUrls.add(u); return u; };
  const revokeAll = () => { objectUrls.forEach((u) => URL.revokeObjectURL(u)); objectUrls.clear(); };

  // 썸네일을 누르면 그때 원본을 받아 크게 본다 (한 번 받은 원본은 기기 캐시에 남아 오프라인에서도 열린다)
  async function openFull(photo, button) {
    const img = button.querySelector('img');
    let url = fullUrls.get(photo.id);
    if (!url) {
      button.classList.add('loading');
      try {
        const full = await getPhoto(tripId, photo.id);
        if (!full) {
          // 원본이 없다: 옛 앱이 원본만 지운 것. 남은 썸네일도 치운다
          toast('지워진 사진이에요');
          deleteThumb(tripId, photo.id).catch((err) => console.warn('thumb cleanup', err));
          return;
        }
        url = bytesToObjectUrl(full.bytes);
        fullUrls.set(photo.id, url);
      } catch (err) {
        console.error(err);
        toast('사진을 불러오지 못했어요. 인터넷 연결을 확인해 주세요', { kind: 'error' });
        return;
      } finally { button.classList.remove('loading'); }
    }
    if (!disposed) openLightbox(url, img?.isConnected ? img : null);
  }

  function photoChip(src, label, { onOpen, onRemove }) {
    const open = el('button', { type: 'button', class: 'photo-open', 'aria-label': `${label} 크게 보기`, onClick: () => onOpen(open) }, el('img', { src, alt: '' }));
    return el('div', { class: 'photo-chip' }, open,
      el('button', { type: 'button', class: 'photo-remove', 'aria-label': `${label} 삭제`, onClick: onRemove }, icon('close')));
  }

  function draw() {
    revokeAll();
    const saved = thumbs.map((p, i) => photoChip(urlFor(p.bytes), `사진 ${i + 1}`, {
      onOpen: (button) => openFull(p, button),
      onRemove: async () => {
        if (!(await confirmDialog('이 사진을 삭제할까요?'))) return;
        await deletePhoto(tripId, p.id, place.id).catch((err) => { console.error(err); toast('삭제하지 못했어요', { kind: 'error' }); });
      },
    }));
    const pending = pendingPhotos.map((p, i) => {
      const src = urlFor(p.bytes);
      return photoChip(src, `대기 중 사진 ${i + 1}`, {
        onOpen: (button) => openLightbox(src, button.querySelector('img')),
        onRemove: () => { pendingPhotos = pendingPhotos.filter((x) => x !== p); onDirty(); draw(); },
      });
    });
    photoList.replaceChildren(...saved, ...pending);
    photoStatus.textContent = pendingPhotos.length ? `저장하면 사진 ${pendingPhotos.length}장이 함께 올라가요` : '';
  }

  // 하나씩 올리고, 올라간 사진은 대기 목록에서 뺀다 (중간에 실패해 다시 저장하면 남은 것만 올린다)
  async function upload(placeId, items) {
    const list = [...items];
    try {
      for (let i = 0; i < list.length; i++) {
        photoStatus.textContent = `사진 올리는 중 ${i + 1} / ${list.length}`;
        await addPhoto(tripId, { placeId, bytes: list[i].bytes, width: list[i].width, height: list[i].height, thumb: list[i].thumb });
        pendingPhotos = pendingPhotos.filter((x) => x !== list[i]);
      }
    } finally {
      draw(); // 중간에 실패해도 올라간 사진은 대기 칩에서 빼고, 남은 장수를 다시 보여 준다
    }
  }

  async function handleFiles(files) {
    if (!files.length) return;
    const compressed = [];
    for (let i = 0; i < files.length; i++) {
      photoStatus.textContent = `사진 줄이는 중 ${i + 1} / ${files.length}`;
      try {
        const photo = await compressImage(files[i]);
        // 썸네일을 못 만들어도 사진은 올린다 (다음에 창을 열 때 다시 만든다)
        photo.thumb = await makeThumb(photo.bytes).catch((err) => { console.warn('thumb', err); return null; });
        compressed.push(photo);
      } catch (err) { console.error(err); toast(`${files[i].name}은(는) 열 수 없는 사진이에요`, { kind: 'error' }); }
    }
    if (!compressed.length) { photoStatus.textContent = ''; return; }
    if (place) {
      try { await upload(place.id, compressed); toast(`사진 ${compressed.length}장을 올렸어요`); }
      catch (err) { console.error(err); photoStatus.textContent = ''; toast('사진을 올리지 못했어요', { kind: 'error' }); }
    } else {
      pendingPhotos = [...pendingPhotos, ...compressed]; onDirty();
      draw();
    }
  }

  fileInput.addEventListener('change', () => {
    const files = [...fileInput.files];
    fileInput.value = '';
    handleFiles(files);
  });

  // 클립보드 사진: 창이 열린 동안 Ctrl+V(폰은 붙여넣기)로 들어오는 이미지 파일을 받는다.
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

  // 썸네일이 없는 예전 사진: 한 번만 원본을 받아 썸네일을 만들어 둔다 (그 뒤로는 이 기기도 다른 기기도 썸네일만 받는다)
  let backfilled = false;
  async function backfillThumbs() {
    if (backfilled || !place || !navigator.onLine) return;
    if (!((place.photoCount ?? 0) > thumbs.length)) return;
    backfilled = true;
    try {
      const have = new Set(thumbs.map((t) => t.id));
      const missing = (await listPhotos(tripId, place.id)).filter((p) => !have.has(p.id) && p.bytes.length);
      for (const p of missing) {
        if (disposed) return;
        const thumb = await makeThumb(p.bytes);
        await addThumb(tripId, p.id, { placeId: place.id, thumb, createdAt: p.createdAt });
      }
    } catch (err) { console.warn('thumb backfill', err); }
  }

  let unsub = null;
  if (place) {
    // 서버가 답한 뒤에만 빠진 썸네일을 채운다 (기기 캐시만 보고 "없다"고 판단해 원본을 다시 받지 않게)
    unsub = watchThumbs(tripId, place.id, (list, meta) => { thumbs = list; draw(); if (!meta?.fromCache) backfillThumbs(); },
      (err) => { console.error(err); toast('사진을 불러오지 못했어요', { kind: 'error' }); });
  }
  draw();

  const field = el('div', { class: 'field' },
    el('div', { class: 'ps-search-head' }, el('label', { for: 'ps-photo', text: '사진' }), el('div', { class: 'ps-photo-actions' }, uploadBtn, clipboardBtn)),
    photoList, fileInput, photoStatus,
    el('p', { class: 'muted ps-hint', text: isTouchDevice() ? '긴 변 1280px로 줄여서 저장돼요.' : '긴 변 1280px로 줄여서 저장돼요. 복사한 사진은 Ctrl+V로도 붙여넣을 수 있어요.' }));

  return {
    field,
    hasPending: () => pendingPhotos.length > 0,
    uploadPending: (placeId) => upload(placeId, pendingPhotos),
    dispose() {
      disposed = true;
      document.removeEventListener('paste', onPaste);
      if (unsub) unsub();
      // 닫히는 움직임이 끝난 뒤에 주소를 푼다 (움직이는 동안 사진이 깨져 보이지 않게)
      setTimeout(() => { revokeAll(); fullUrls.forEach((u) => URL.revokeObjectURL(u)); fullUrls.clear(); }, 400);
    },
  };
}
