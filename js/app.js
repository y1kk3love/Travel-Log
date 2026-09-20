import { watchAuth, signIn, signOut, isOwner } from './auth.js';
import { el, clear, toast } from './ui.js';

const app = document.getElementById('app');

function renderLogin() {
  clear(app);
  app.append(el('div', { class: 'screen-center' },
    el('h1', { text: '여행 로그' }),
    el('p', { class: 'muted', text: '본인 Google 계정으로 로그인하면 일정을 볼 수 있어요' }),
    el('button', {
      class: 'btn btn-primary',
      onClick: () => signIn().catch((err) => {
        console.error(err);
        toast(err.code === 'auth/popup-blocked' ? err.message : '로그인에 실패했어요', { kind: 'error', ms: 5000 });
      }),
    }, 'Google로 로그인')));
}

function renderNoAccess(user) {
  clear(app);
  app.append(el('div', { class: 'screen-center' },
    el('h1', { text: '접근 권한이 없는 계정이에요' }),
    el('p', { class: 'muted', text: `${user.email} 계정은 이 여행 로그의 주인으로 등록되어 있지 않아요.` }),
    el('p', {}, '내 UID: ', el('code', { text: user.uid })),
    el('p', { class: 'muted', text: '이 계정이 본인 계정이라면 위 UID를 js/firebase-config.js의 OWNER_UID와 firestore.rules에 넣으세요.' }),
    el('button', { class: 'btn', onClick: () => signOut() }, '로그아웃')));
}

function renderApp(user) {
  clear(app);
  app.append(el('div', { class: 'screen-center' },
    el('h1', { text: '로그인 완료' }),
    el('p', { class: 'muted', text: `${user.email} · 여행 목록은 다음 단계에서 붙어요` }),
    el('button', { class: 'btn', onClick: () => signOut() }, '로그아웃')));
}

watchAuth((user) => {
  if (!user) return renderLogin();
  if (!isOwner(user)) return renderNoAccess(user);
  renderApp(user);
});
