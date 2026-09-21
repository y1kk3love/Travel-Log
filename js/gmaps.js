// Google Maps JavaScript API 로더. 키는 사이트 주소(HTTP 리퍼러)로 제한된 공개 키다.
// 콘솔에서 하루 요청 한도를 무료 범위 아래로 걸어 두어 한도를 넘으면 요청이 실패할 뿐 청구되지 않는다.
import { MAPS_API_KEY } from './firebase-config.js';

let bootstrapped = false;

function bootstrap() {
  if (bootstrapped) return;
  bootstrapped = true;
  // Google 이 배포하는 인라인 부트스트랩 로더 (importLibrary 방식)
  /* eslint-disable */
  (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=`https://maps.${c}apis.com/maps/api/js?`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({
    key: MAPS_API_KEY, v: 'weekly', language: 'ko', region: 'KR',
  });
  /* eslint-enable */
}

export function importLibrary(name) {
  bootstrap();
  return globalThis.google.maps.importLibrary(name);
}
