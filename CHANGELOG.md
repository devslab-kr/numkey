# Changelog

## 0.1.0 (unreleased)

Initial release. / 최초 릴리스.

- Core: `parse` / `format` / `finalize` — string-first canonical value model
  (money-safe, no IEEE 754), thousands grouping, leading-zero cleanup,
  full-width digit normalization, custom group size / separator /
  decimal mark. / 문자열 우선 정식 값 모델, 천 단위 그룹핑, 앞자리 0 정리,
  전각 숫자 정규화, 그룹 크기·구분자·소수점 커스텀.
- DOM: `bind` / `observe` / `getValue` — caret-preserving live formatting,
  `data-numkey*` attribute API, automatic `inputmode` + right alignment,
  IME-composition safety, blur settling. / 커서 보존 실시간 포맷팅,
  `data-numkey*` 속성 API, `inputmode`·오른쪽 정렬 자동 설정, IME 조합 안전,
  blur 시 중간 상태 정리.
- CDN global build with `data-numkey` auto-init (no build step — JSP/PHP
  friendly). / `data-numkey` 자동 초기화가 포함된 CDN 글로벌 빌드.
- Vue 3: `NumkeyInput` (v-model speaks canonical values) + `vNumkey`
  directive. / Vue 3 컴포넌트·디렉티브.
- React: `NumkeyInput` (controlled, `onValueChange`) + `useNumkey` hook. /
  React 컴포넌트·훅.
