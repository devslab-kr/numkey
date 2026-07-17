# Changelog

## 0.4.0 (2026-07-17)

- **Smart deletion** — Backspace/Delete next to a group separator now takes
  out the adjacent digit in one keystroke instead of bouncing off the
  separator. Automatic in the DOM layer and both components; also exported
  as `adjustDeleteCaret(el, key, opts?)` for custom wiring. / 구분자 옆
  백스페이스/Delete가 한 번에 숫자를 지웁니다 (기존: 두 번).
- **`min` / `max`** (`data-numkey-min` / `data-numkey-max`) — bounds applied
  on blur only, never mid-keystroke (you can still type 50 in a min-10
  field). Applies to Korean shorthand too (`1.5억` with max 100만 → 100만).
  Exported as `clamp(canonical, opts?)`. / blur 시에만 적용되는 최소/최대 —
  입력 도중에는 간섭하지 않습니다.

## 0.3.0 (2026-07-17)

- **`fromKorean(text)`** — Korean-shorthand amount parsing, the inverse of
  `toKorean`: `'3만5천'` → `"35000"`, `'1.5억'` → `"150000000"`,
  `'삼십오만'` → `"350000"`. Digits + units (만/억/조/경, 천/백/십), full
  Hangul digits, decimal units, commas/spaces/"원" ignored, bare unit = 1.
  / 만/억 축약 파싱 — 부동산·주식 앱에서 실제로 입력하는 그대로.
- **`data-numkey-korean-entry`** / `koreanEntry` option — accept shorthand
  in the field itself: a Korean draft is left alone while typing (no live
  reformat fighting the IME) and converted on blur (`3만5천` → `35,000`).
  `getValue` and the `data-numkey-name` hidden sync see the parsed value
  even mid-draft. / 인풋에서 바로 축약 입력 — 조합 중에는 건드리지 않고
  blur에 변환, hidden 동기화는 초안 상태에서도 파싱된 값 유지.

## 0.2.0 (2026-07-17)

The Korean release. / 한국 특화 릴리스.

- **`toKorean(canonical)`** — mixed digits-plus-units amount reading:
  `'1500000'` → `"150만"`, `'927483041001'` → `"9,274억 8,304만 1,001"`.
  Zero groups omitted, per-group comma grouping, sign kept, fraction
  ignored, units up to 양 (10^28). / 한글 금액 읽기 — 은행·핀테크 UI의
  "150만" 병기를 함수 하나로.
- **`data-numkey-korean`** — live reading next to the input: empty value
  generates a `<span class="numkey-korean">` after the field (style it
  yourself; add "원" via CSS `::after`), or pass a CSS selector to use an
  existing element. / 인풋 옆 실시간 한글 병기 — 마크업만으로.
- **`data-numkey-name="amount"`** — generated hidden input that always
  carries the settled CANONICAL value, so a classic form POST submits
  `1234567` while the field shows `1,234,567`. No server-side comma
  stripping needed. / 클래식 폼 전송용 hidden 정식 값 동기화 — JSP/PHP
  폼에서 서버측 콤마 제거가 필요 없어집니다.

## 0.1.0 (2026-07-17)

Initial release. / 최초 릴리스.

- Opt-in locale formatting: `locale: 'auto' | 'de-DE' | …` /
  `data-numkey-locale` derives separators via `Intl.NumberFormat`; without it
  the display stays deterministic regardless of the visitor's browser. /
  옵트인 로케일 포맷팅 — 지정하지 않으면 브라우저와 무관하게 표시 고정.
- `setValue(el, canonical)` — programmatic canonical writes (the counterpart
  of `getValue`). / 정식 값 프로그래매틱 기록.
- GitHub Pages demo site (`site/`, deployed on main push). / 데모 사이트.
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
