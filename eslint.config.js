// 코드 검사 (npm run lint, CI 에서도 돈다). 모양(들여쓰기·따옴표)은 건드리지 않고, 실수를 잡는 규칙만 켠다:
// 선언 안 한 이름, 안 쓰는 import·변수, 닿지 않는 코드, 잘못된 비교 같은 것.
import js from '@eslint/js';
import globals from 'globals';

export default [
  // gmaps.js 는 구글이 배포하는 로더를 그대로 담고 있다. _site 는 배포용 빌드 결과, unslop 은 이 PC 에 받아 둔 외부 스킬(저장소에 올리지 않는다)
  { ignores: ['node_modules/**', 'dist/**', '_site/**', 'android/**', 'unslop/**', 'js/gmaps.js'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['error', 'always', { null: 'ignore' }], // == null 은 "없음"을 묻는 뜻으로 일부러 쓴다
      'no-var': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
    },
  },
  { files: ['js/**', 'harness/**'], languageOptions: { globals: { ...globals.browser } } },
  { files: ['sw.js'], languageOptions: { globals: { ...globals.serviceworker } } },
  { files: ['scripts/**', 'tests/**', 'tests-rules/**', 'tests-ui/**', 'eslint.config.js'], languageOptions: { globals: { ...globals.node } } },
  { files: ['tests/**', 'tests-ui/**'], languageOptions: { globals: { ...globals.browser } } }, // 화면 테스트는 페이지 안에서 도는 코드도 담는다
  // Apps Script (구글 서버에서 도는 중계): 모듈이 아니고 전역 함수·서비스를 쓴다
  { files: ['relay/**'], languageOptions: { sourceType: 'script', globals: { UrlFetchApp: 'readonly', ContentService: 'readonly', doGet: 'writable' } }, rules: { 'no-unused-vars': 'off' } },
];
