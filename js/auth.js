import { GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { auth } from './firebase.js';
import { OWNER_UID } from './firebase-config.js';

export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

// 리디렉트 방식은 앱 도메인(github.io)과 인증 도메인(firebaseapp.com)이 달라
// 브라우저의 서드파티 저장소 차단에 걸려 결과를 잃어버린다. 팝업만 쓴다.
export async function signIn() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
    if (err.code === 'auth/popup-blocked') {
      const e = new Error('팝업이 차단됐어요. 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요');
      e.code = err.code;
      throw e;
    }
    throw err;
  }
}

export function signOut() {
  return firebaseSignOut(auth);
}

export function isOwner(user) {
  return !!user && OWNER_UID !== '' && user.uid === OWNER_UID;
}
