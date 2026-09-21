// 공유 인텐트 결과({title, description, url, type})를 붙여넣기 로직이 이해하는 한 덩어리 텍스트로 (순수 함수)
export function sharedTextFrom(result) {
  if (!result || typeof result !== 'object') return null;
  if (result.type && !/^text\//.test(result.type)) return null;
  const parts = [];
  for (const key of ['title', 'description', 'url']) {
    const v = String(result[key] ?? '').trim();
    if (v && !parts.includes(v)) parts.push(v);
  }
  return parts.length ? parts.join('\n') : null;
}

// 웹앱(PWA) 공유 대상: 안드로이드 공유 시트가 ?title=&text=&url= 로 열어 준다 (manifest share_target). 공유가 아니면 null.
export function shareFromQuery(search) {
  const params = new URLSearchParams(String(search ?? ''));
  if (!params.has('title') && !params.has('text') && !params.has('url')) return null;
  return sharedTextFrom({ title: params.get('title'), description: params.get('text'), url: params.get('url'), type: 'text/plain' });
}
