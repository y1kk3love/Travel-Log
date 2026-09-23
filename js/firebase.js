import { initializeApp, getAuth, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from './firebase-sdk.js';
import { firebaseConfig } from './firebase-config.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
