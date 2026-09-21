import { GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut as firebaseSignOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { auth } from './firebase.js';
import { OWNER_UID } from './firebase-config.js';
import { isNative, googleIdToken, nativeSignOut } from './native.js';

export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

// 웹: 팝업 (리디렉트는 authDomain 불일치로 결과를 잃는다). 앱: 네이티브 구글 로그인 → 같은 Firebase 계정으로 signInWithCredential.
export async function signIn() {
  if (isNative()) {
    const idToken = await googleIdToken(); // 실패·취소는 code 가 붙은 에러로 올라온다
    if (!idToken) { const e = new Error('앱 안에서 로그인 플러그인을 찾지 못했어요'); e.code = 'auth/native-missing'; throw e; }
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return;
  }
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

export async function signOut() {
  await nativeSignOut();
  return firebaseSignOut(auth);
}

export function isOwner(user) {
  return !!user && OWNER_UID !== '' && user.uid === OWNER_UID;
}
