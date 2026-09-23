import { GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut as firebaseSignOut, onAuthStateChanged, terminate, clearIndexedDbPersistence } from './firebase-sdk.js';
import { auth, db } from './firebase.js';
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
  await firebaseSignOut(auth);
  // 공용 PC·빌린 폰에서 다음 사람이 이 기기에 남은 여행 데이터(오프라인 캐시)를 보지 못하게 지운다
  try { await terminate(db); await clearIndexedDbPersistence(db); }
  catch (err) { console.warn('기기 캐시를 지우지 못했어요 (다른 탭이 열려 있으면 그 탭을 닫은 뒤 다시)', err); }
  try { for (const k of Object.keys(globalThis.localStorage ?? {})) if (k.startsWith('tl.')) localStorage.removeItem(k); } catch { /* 없어도 됨 */ }
  location.reload(); // 끝낸(terminate) Firestore 는 다시 쓸 수 없으니 새로 시작한다
}

// 사이트 주인 (초대 목록·사용량을 관리하는 계정). 여행을 만든 사람은 lib/members.js 의 isTripOwner
export function isSiteOwner(user) {
  return !!user && OWNER_UID !== '' && user.uid === OWNER_UID;
}
