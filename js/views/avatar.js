import { el } from '../ui.js';
import { displayNameFor, initialFor } from '../lib/profile.js';

// 동그란 아바타. Google 프로필 사진이 있으면 사진, 없거나 못 불러오면 이름 첫 글자.
export function avatar(profile, email, size = 28) {
  const name = displayNameFor(profile, email);
  const fallback = () => el('span', { class: 'avatar avatar-initial', style: { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.45)}px` }, text: initialFor(name), 'aria-hidden': 'true' });
  if (!profile?.photoURL) return fallback();
  const img = el('img', {
    class: 'avatar', src: profile.photoURL, alt: '', referrerpolicy: 'no-referrer',
    style: { width: `${size}px`, height: `${size}px` },
    onError: (e) => e.target.replaceWith(fallback()),
  });
  return img;
}
