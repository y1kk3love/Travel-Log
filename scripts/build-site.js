// 웹사이트(GitHub Pages)에 올릴 파일만 _site/ 로 모은다. CI 의 deploy 단계가 테스트를 통과한 뒤에 부른다
// (.github/workflows/test.yml). 저장소 전체가 아니라 앱 파일만 올라간다: 테스트·문서·안드로이드 소스·화면 확인용 harness 는 빠진다.
//   node scripts/build-site.js [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWeb, WEB_FILES } from './build-web.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// 앱 파일(WEB_FILES)에 더해 웹에만 필요한 것: 안드로이드 앱이 읽는 최소 지원 버전 설정
export const SITE_FILES = [...WEB_FILES, 'app-config.json'];

export function buildSite(outDir = path.join(ROOT, '_site')) {
  buildWeb(outDir);
  for (const name of SITE_FILES.filter((f) => !WEB_FILES.includes(f))) {
    fs.cpSync(path.join(ROOT, name), path.join(outDir, name), { recursive: true });
  }
  return SITE_FILES;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, '_site');
  const files = buildSite(out);
  console.log(`사이트 파일 ${files.length}개 항목 → ${out}`);
}
