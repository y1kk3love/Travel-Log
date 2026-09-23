// 서비스 워커가 설치 때 미리 받아 둘 앱 파일 목록을 sw.js 의 PRECACHE 에 적는다.
// JS 파일을 더하거나 지웠으면 `npm run sw:precache` (테스트가 목록이 실제와 다르면 알려 준다).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'favicon.svg', 'css/main.css'];

function jsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...jsFiles(rel));
    else if (entry.name.endsWith('.js')) out.push(rel);
  }
  return out;
}

export function precacheList() {
  return [...SHELL, ...jsFiles('js').sort()];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = path.join(ROOT, 'sw.js');
  const src = fs.readFileSync(file, 'utf8');
  const list = precacheList();
  const next = src.replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = ${JSON.stringify(list, null, 2)};`);
  if (next === src && !src.includes('const PRECACHE = ')) throw new Error('sw.js 에 PRECACHE 가 없어요');
  fs.writeFileSync(file, next);
  console.log(`sw.js PRECACHE: ${list.length}개`);
}
