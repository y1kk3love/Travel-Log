// 태그(v1.2.3)에서 안드로이드 versionName/versionCode 를 정해 build.gradle 에 적는다. CI 가 부른다.
//   node scripts/android-version.js v1.2.3
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function versionCodeFor(tag) {
  const m = String(tag).trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!m) throw new Error(`태그 형식이 vX.Y.Z 가 아니에요: ${tag}`);
  const [major, minor, patch] = m.slice(1).map(Number);
  if (minor > 99 || patch > 99) throw new Error('minor/patch 는 99 까지');
  return major * 10000 + minor * 100 + patch;
}

export function applyAndroidVersion(tag, gradlePath) {
  const name = String(tag).trim().replace(/^v/, '');
  const code = versionCodeFor(tag);
  let s = fs.readFileSync(gradlePath, 'utf8');
  s = s.replace(/versionCode \d+/, `versionCode ${code}`).replace(/versionName "[^"]*"/, `versionName "${name}"`);
  fs.writeFileSync(gradlePath, s);
  return { name, code };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const gradle = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'android', 'app', 'build.gradle');
  console.log(applyAndroidVersion(process.argv[2], gradle));
}
