// 초대 메시지 보내기: 초대한 사람이 자기 카카오톡·문자·메일로 직접 보낸다 (자동 메일은 없다).
// 앱은 안드로이드 공유 창, 웹은 브라우저 공유 창, 공유 창이 없으면(일부 PC) 문구를 복사한다.
import { el, icon, toast } from '../ui.js';
import { inviteMessage, shareInvite } from '../lib/invite.js';
import { shareText } from '../native.js';

export async function sendInviteMessage(email, trip = null) {
  const result = await shareInvite(inviteMessage({ email, trip }), {
    native: shareText,
    webShare: typeof navigator.share === 'function' ? (m) => navigator.share(m) : null,
    copy: (text) => navigator.clipboard.writeText(text),
  });
  if (result === 'copied') toast('초대 메시지를 복사했어요. 카카오톡·문자·메일에 붙여넣어 보내 주세요', { ms: 5000 });
  else if (result === 'failed') toast('초대 메시지를 보내지 못했어요', { kind: 'error' });
}

// 목록의 사람마다 붙이는 "초대 메시지 보내기" 버튼 (나중에 다시 보낼 때)
export function inviteShareButton(email, trip = null) {
  return el('button', {
    type: 'button', class: 'btn btn-icon btn-sm', 'aria-label': `${email} 님에게 초대 메시지 보내기`, title: '초대 메시지 보내기',
    onClick: () => sendInviteMessage(email, trip),
  }, icon('send'));
}

// 초대를 추가한 직후 알림: 바로 보낼 수 있게 "메시지 보내기" 버튼을 단다
export function invitedToast(message, email, trip = null) {
  toast(message, { ms: 8000, action: { label: '메시지 보내기', onClick: () => sendInviteMessage(email, trip) } });
}
