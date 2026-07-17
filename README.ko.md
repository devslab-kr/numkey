# numkey

[English](README.md) | **한국어** · [라이브 데모](https://devslab-kr.github.io/numkey/)

[![npm](https://img.shields.io/npm/v/%40devslab%2Fnumkey)](https://www.npmjs.com/package/@devslab/numkey)
[![CI](https://github.com/devslab-kr/numkey/actions/workflows/ci.yml/badge.svg)](https://github.com/devslab-kr/numkey/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/%40devslab%2Fnumkey)](./LICENSE)

**"문자열인데 숫자야."** 업무 시스템엔 이런 필드가 꼭 있습니다 — 금액, 수량,
단가. 그리고 매번 같은 걸 손으로 다시 만들죠: 실시간 천 단위 콤마(`10,000`),
앞자리 0 제거, 오른쪽 정렬, 모바일 숫자 키패드, 그리고 콤마가 생기고 사라져도
튀지 않는 커서까지.

numkey는 그 인풋을 한 번에 끝냅니다:

- **커서 안전 실시간 포맷팅** — `1,234,567` 중간에 타이핑해도 그룹이 재배치되는
  동안 커서가 기대한 자리에 그대로
- **문자열 우선 값 모델** — 정식 값은 순수 숫자 문자열(`"1234567.89"`).
  IEEE 754 부동소수점을 거치지 않아 금액에 안전
- **앞자리 0 정리**(`007` → `7`), 전각 숫자 정규화(`１２３` → `123` —
  한글/일본어 IME), 붙여넣기 정제(`₩ 1,234원` → `1234`)
- **오른쪽 정렬 + `inputmode`** 자동 설정 (옵트아웃 가능)
- **IME 안전** — 조합 중에는 값을 건드리지 않음
- **의존성 0**, TypeScript 우선, ESM/CJS 듀얼 + CDN 글로벌 빌드
- **순수 `<script>` (JSP/PHP 등 서버 렌더링), Vue 3, React** 모두 지원

*같은 폼에서 한/영 키 오타도 처리해야 한다면? numkey의 형제
[kokey](https://github.com/devslab-kr/kokey)를 보세요.*

## 빌드 도구 없이 (JSP, PHP, 정적 페이지)

스크립트 태그 한 줄, 나머지는 마크업입니다. 나중에 DOM에 추가되는 인풋까지
자동으로 바인딩됩니다.

```html
<script src="https://cdn.jsdelivr.net/npm/@devslab/numkey"></script>

<input data-numkey>                            <!-- 정수: 1,234,567 -->
<input data-numkey="2">                        <!-- 소수 2자리: 1,234.56 -->
<input data-numkey data-numkey-negative>       <!-- 음수 허용 -->
<input data-numkey data-numkey-align="left">   <!-- 왼쪽 정렬 유지 -->
```

서버가 렌더링한 값(`<input data-numkey value="1234567">`)은 로드 시
포맷됩니다. 제출 전에 원본 값을 읽으려면:

```html
<script>
  const raw = numkey.getValue(document.querySelector('#amount')) // "1234567"
</script>
```

(또는 서버에서 콤마를 제거해도 됩니다 — POST되는 값은 표시 값입니다.)

| 속성 | 의미 |
|---|---|
| `data-numkey` | 바인딩; 값은 최대 소수 자릿수 (빈 값 = 정수) |
| `data-numkey-negative` | 앞자리 마이너스 허용 |
| `data-numkey-align="left"` | 자동 오른쪽 정렬 옵트아웃 |
| `data-numkey-group="4"` | 그룹 크기 (기본 3, 만 단위는 4) |
| `data-numkey-separator=" "` | 그룹 구분자 (기본 `,`) |
| `data-numkey-point=","` | 필드에 표시되는 소수점 (기본 `.`) |
| `data-numkey-locale="auto"` | 로케일에서 구분자 유도 — `"auto"`(브라우저 언어) 또는 `"de-DE"` 같은 BCP 47 태그 |

> `type="text"` 인풋을 쓰세요. numkey가 `inputmode`를 설정해 모바일에서 숫자
> 키패드가 뜹니다. `type="number"`는 커서 API가 없어 포맷팅과 충돌합니다.

## npm

```sh
npm install @devslab/numkey
```

```ts
import { format, parse, bind, observe } from '@devslab/numkey'

format('1234567.5', { decimals: 2 })   // "1,234,567.5"
parse('₩ 1,234,567원')                  // "1234567"

bind(document.querySelector('#amount'), { decimals: 2 }) // 요소 하나
observe()                                                // 모든 [data-numkey]
```

## Vue 3

```vue
<script setup>
import { ref } from 'vue'
import { NumkeyInput, vNumkey } from '@devslab/numkey/vue'

const amount = ref('') // 항상 정식 값: "1234567"
</script>

<template>
  <!-- v-model은 정식 값을 받고, 필드에는 1,234,567이 보입니다 -->
  <NumkeyInput v-model="amount" :decimals="2" negative />

  <!-- 일반 인풋에는 디렉티브 -->
  <input v-numkey="2">
</template>
```

## React

```tsx
import { NumkeyInput, useNumkey } from '@devslab/numkey/react'

// Controlled: value/onValueChange는 정식 값 문자열로 통신
const [amount, setAmount] = useState('')
<NumkeyInput value={amount} onValueChange={setAmount} decimals={2} negative />

// Uncontrolled: ref 콜백 훅
<input ref={useNumkey({ decimals: 2 })} defaultValue="1234567" />
```

## API

### 옵션

| 옵션 | 기본값 | |
|---|---|---|
| `decimals` | `0` | 최대 소수 자릿수 (0 = 정수만) |
| `negative` | `false` | 앞자리 마이너스 허용 |
| `group` | `3` | 그룹당 자릿수 (만 단위 그룹핑은 4) |
| `separator` | `","` | 표시용 그룹 구분자 |
| `decimalPoint` | `"."` | 표시용 소수점 (정식 값은 항상 `.`) |
| `locale` | — | **옵트인**: `Intl`로 `separator`/`decimalPoint` 유도 — `"auto"`(브라우저 언어) 또는 BCP 47 태그. 지정하지 않으면 방문자 브라우저와 무관하게 표시가 고정됩니다 (업무 폼의 기본 요구). 명시한 `separator`/`decimalPoint`가 우선. |

### Core (순수 함수)

| | |
|---|---|
| `parse(display, opts?)` | 표시 값/붙여넣기 → 정식 값 `"1234567.89"` |
| `format(canonical, opts?)` | 정식 값 → 표시 값 `"1,234,567.89"` |
| `finalize(canonical)` | 입력 중간 상태 정리 (`"1234."` → `"1234"`) |

### DOM

| | |
|---|---|
| `bind(el, opts?)` | 실시간 포맷팅 연결; 해제 함수 반환 |
| `observe(root?)` | 현재/미래의 모든 `[data-numkey]` 바인딩 |
| `getValue(el, opts?)` | 바인딩된 인풋의 정식 값 |
| `setValue(el, canonical, opts?)` | 정식 값을 포맷된 표시 값으로 기록 |
| `applyToInput(el, opts?)` | 커서 보존 1회 재포맷 (빌딩 블록) |
| `createRefBinder(opts?)` | 어떤 프레임워크에서든 쓰는 ref 콜백 팩토리 |

## 참고

- 유럽식 포맷도 옵션으로 지원: `{ separator: '.', decimalPoint: ',' }`이면
  `1.234.567,89`로 표시되고 정식 값은 `"1234567.89"`로 유지됩니다.
- 구분자 바로 뒤에서 백스페이스를 누르면 커서가 구분자를 지나칩니다 (숫자는
  다음 백스페이스에서 삭제) — 주요 마스킹 라이브러리들과 같은 동작입니다.
  구분자 건너뛰기 삭제는 로드맵에 있습니다.
- 로드맵: 한글 금액 병기 (`1500000` → “150만”), 만/억 축약 파싱
  (`3만5천` → `35000`), 클래식 폼 전송용 hidden 필드 정식 값 동기화.

## License

MIT © [devslab](https://github.com/devslab-kr)
