import { auth } from '/js/firebase.js';
export function watchAuth(cb) { setTimeout(() => cb(auth.currentUser), 0); return () => {}; }
export async function signIn() {}
export async function signOut() { console.log('[fake] signOut'); }
export function isSiteOwner(user) { return !!user && user.uid === 'cA5VgvDvMKQMVKtEDyggCGVqTvW2'; }
