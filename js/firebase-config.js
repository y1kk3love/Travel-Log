export const firebaseConfig = {
  apiKey: 'AIzaSyAMtvkiVR3TNvzGlCmDIQxdmytKr4N8j5o',
  authDomain: 'travel-log-d6cc9.firebaseapp.com',
  projectId: 'travel-log-d6cc9',
  storageBucket: 'travel-log-d6cc9.firebasestorage.app',
  messagingSenderId: '660409033949',
  appId: '1:660409033949:web:289773cbe56ee64b256734',
};

// 첫 로그인 후 "접근 권한 없음" 화면에 표시되는 UID를 여기에 넣는다.
export const OWNER_UID = 'cA5VgvDvMKQMVKtEDyggCGVqTvW2';

// Google Maps Platform 브라우저 키 (Cloud 프로젝트 travel-log-maps, Firebase 와 별개).
// 사이트 주소로 제한되어 있고 콘솔에서 하루 한도를 무료 범위 아래로 걸어 두었다.
export const MAPS_API_KEY = 'AIzaSyDDdEqpiE7eM7T78i9lgqEMjrnl2sV9WJM';
// 지도 ID (콘솔 지도 관리의 travel-log-web, 래스터·Google 기본 스타일). 새 방식 핀(AdvancedMarkerElement)에 필요하다. 공개돼도 되는 값
export const MAPS_MAP_ID = '46966c66a1cbaca5846e633e';

// 웹에서 구글 지도 짧은 링크(maps.app.goo.gl)를 따라가 주는 중계 (사이트 주인 구글 계정의 Apps Script 웹 앱, relay/maps-link.gs).
// 비어 있으면 웹은 이름 검색으로 넘어간다. 앱은 중계 없이 네이티브로 따라간다. 공개돼도 되는 값 (구글 짧은 링크만 받는다)
export const MAPS_LINK_RELAY = 'https://script.google.com/macros/s/AKfycbxlw8KRhbpzjXPe0y3lQ5DsPo4Rj5hXN7rdaKW9B51Z7oNVdyEVbSttCa8l_gltXsXGvQ/exec';
