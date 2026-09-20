import { el, toast, confirmDialog, openModal, icon } from '../ui.js';
import { setTripCover, coverBytes } from '../db.js';
import { compressImage, bytesToObjectUrl } from '../photo.js';
import { imageFilesFrom } from '../lib/clipboard.js';

const COVER = { maxSide: 800, maxBytes: 200 * 1024 };

// 대표 사진 창. 사이트 주인만 연다(호출하는 쪽에서 막는다).
export function openCoverDialog(trip) {
  const bytes = coverBytes(trip);
  let url = bytes ? bytesToObjectUrl(bytes) : null;
  const preview = el('div', { class: 'cover-preview' },
    url ? el('img', { src: url, alt: '' }) : el('span', { class: 'muted', text: '아직 대표 사진이 없어요' }));
  const fileInput = el('input', { type: 'file', accept: 'image/*', class: 'visually-hidden' });
  const status = el('p', { class: 'muted ps-hint' });
  const dialog = el('dialog', {});

  async function apply(file) {
    status.textContent = '사진 줄이는 중…';
    try {
      const { bytes: out } = await compressImage(file, COVER);
      await setTripCover(trip.id, out);
      toast('대표 사진을 바꿨어요');
      dialog.close();
    } catch (err) {
      console.error(err);
      status.textContent = '';
      toast(err?.message === 'unsupported-image' ? '열 수 없는 사진이에요' : '저장하지 못했어요', { kind: 'error' });
    }
  }

  fileInput.addEventListener('change', () => { const f = fileInput.files[0]; fileInput.value = ''; if (f) apply(f); });
  const onPaste = (e) => { const f = imageFilesFrom(e.clipboardData?.files)[0]; if (f) { e.preventDefault(); apply(f); } };
  document.addEventListener('paste', onPaste);
  dialog.addEventListener('close', () => { document.removeEventListener('paste', onPaste); if (url) URL.revokeObjectURL(url); });

  dialog.append(el('form', { method: 'dialog' },
    el('h2', { text: '대표 사진' }),
    el('div', { class: 'dialog-body' },
      preview,
      el('div', { class: 'ps-photo-actions cover-actions' },
        el('button', { type: 'button', class: 'btn btn-sm', onClick: () => fileInput.click() }, icon('plus'), '사진 고르기'),
        bytes ? el('button', {
          type: 'button', class: 'btn btn-sm btn-danger',
          onClick: async () => {
            if (!(await confirmDialog('대표 사진을 지울까요?'))) return;
            try { await setTripCover(trip.id, null); toast('대표 사진을 지웠어요'); dialog.close(); }
            catch (err) { console.error(err); toast('지우지 못했어요', { kind: 'error' }); }
          },
        }, '제거') : null),
      fileInput, status,
      el('p', { class: 'muted ps-hint', text: '긴 변 800px로 줄여 저장돼요. 복사한 사진은 Ctrl+V로도 넣을 수 있어요.' })),
    el('div', { class: 'dialog-actions' }, el('button', { type: 'button', class: 'btn', onClick: () => dialog.close() }, '닫기'))));
  openModal(dialog);
}
