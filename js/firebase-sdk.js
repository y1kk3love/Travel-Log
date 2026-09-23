// Firebase SDK 는 여기 한 곳에서만 불러온다 (버전을 올릴 때 이 세 줄만 고친다).
// 안드로이드 앱 빌드는 이 주소들을 받아 vendor/firebase 로 바꾼다 (scripts/build-web.js).
// setLogLevel 은 app·firestore 에 둘 다 있어 이름이 겹치므로 쓰지 않는다.
export * from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
export * from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
export * from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
