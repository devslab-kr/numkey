# numkey

**English** | [한국어](README.ko.md) · [Live demo](https://devslab-kr.github.io/numkey/)

[![npm](https://img.shields.io/npm/v/%40devslab%2Fnumkey)](https://www.npmjs.com/package/@devslab/numkey)
[![CI](https://github.com/devslab-kr/numkey/actions/workflows/ci.yml/badge.svg)](https://github.com/devslab-kr/numkey/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/%40devslab%2Fnumkey)](./LICENSE)

**"It's a string, but it's a number."** Every business app has these fields —
amounts, quantities, prices — and every team rebuilds the same input by hand:
live thousands grouping (`10,000`), no leading zeros, right-aligned, numeric
keypad on mobile, and a caret that doesn't jump while separators appear and
disappear around it.

numkey is that input, done once:

- **Caret-safe live formatting** — type into the middle of `1,234,567` and the
  cursor stays where you expect, even as groups reflow
- **String-first value model** — the canonical value is a plain numeric string
  (`"1234567.89"`), never an IEEE 754 float, so money is safe
- **Leading-zero cleanup** (`007` → `7`), full-width digit normalization
  (`１２３` → `123` — Korean/Japanese IME), paste sanitizing (`₩ 1,234원` → `1234`)
- **Right alignment + `inputmode`** set automatically (opt-out available)
- **IME-safe** — nothing runs mid-composition
- **Zero dependencies**, TypeScript-first, ESM/CJS dual + a CDN global build
- Works with **plain `<script>` (JSP/PHP/anything server-rendered), Vue 3, and React**

*Wrong-keyboard-layout text in the same form? That's numkey's sibling,
[kokey](https://github.com/devslab-kr/kokey).*

## No build step (JSP, PHP, static pages)

One script tag; everything else is markup. Inputs are auto-bound, including
ones added to the DOM later.

```html
<script src="https://cdn.jsdelivr.net/npm/@devslab/numkey"></script>

<input data-numkey>                            <!-- integers: 1,234,567 -->
<input data-numkey="2">                        <!-- 2 decimals: 1,234.56 -->
<input data-numkey data-numkey-negative>       <!-- minus allowed -->
<input data-numkey data-numkey-align="left">   <!-- keep left alignment -->
```

Server-rendered values (`<input data-numkey value="1234567">`) are formatted
on load. To read the raw value back before submitting:

```html
<script>
  const raw = numkey.getValue(document.querySelector('#amount')) // "1234567"
</script>
```

(Or simply strip separators server-side — the posted value is the display
value.)

| Attribute | Meaning |
|---|---|
| `data-numkey` | bind; the value is the max decimal places (empty = integer) |
| `data-numkey-negative` | allow a leading minus |
| `data-numkey-align="left"` | opt out of automatic right alignment |
| `data-numkey-group="4"` | group size (default 3) |
| `data-numkey-separator=" "` | group separator (default `,`) |
| `data-numkey-point=","` | decimal mark shown in the field (default `.`) |
| `data-numkey-locale="auto"` | derive separators from a locale — `"auto"` (browser language) or a BCP 47 tag like `"de-DE"` |

> Use `type="text"` inputs. numkey sets `inputmode` so mobile keyboards show
> the numeric keypad; `type="number"` has no caret API and fights formatting.

## npm

```sh
npm install @devslab/numkey
```

```ts
import { format, parse, bind, observe } from '@devslab/numkey'

format('1234567.5', { decimals: 2 })   // "1,234,567.5"
parse('₩ 1,234,567원')                  // "1234567"

bind(document.querySelector('#amount'), { decimals: 2 }) // one element
observe()                                                // all [data-numkey]
```

## Vue 3

```vue
<script setup>
import { ref } from 'vue'
import { NumkeyInput, vNumkey } from '@devslab/numkey/vue'

const amount = ref('') // always canonical: "1234567"
</script>

<template>
  <!-- v-model gets the canonical value; the field shows 1,234,567 -->
  <NumkeyInput v-model="amount" :decimals="2" negative />

  <!-- or the directive for plain inputs -->
  <input v-numkey="2">
</template>
```

## React

```tsx
import { NumkeyInput, useNumkey } from '@devslab/numkey/react'

// Controlled: value/onValueChange speak canonical strings
const [amount, setAmount] = useState('')
<NumkeyInput value={amount} onValueChange={setAmount} decimals={2} negative />

// Uncontrolled: ref-callback hook
<input ref={useNumkey({ decimals: 2 })} defaultValue="1234567" />
```

## API

### Options

| Option | Default | |
|---|---|---|
| `decimals` | `0` | max fraction digits (0 = integers only) |
| `negative` | `false` | allow a leading minus |
| `group` | `3` | digits per group (4 for 만-style grouping) |
| `separator` | `","` | group separator in the display |
| `decimalPoint` | `"."` | decimal mark in the display (canonical always uses `.`) |
| `locale` | — | **opt-in**: derive `separator`/`decimalPoint` via `Intl` — `"auto"` (browser language) or a BCP 47 tag. Without it the display is deterministic no matter the visitor's browser, which is what business forms usually need. Explicit `separator`/`decimalPoint` win. |

### Core (pure functions)

| | |
|---|---|
| `parse(display, opts?)` | display/paste mess → canonical `"1234567.89"` |
| `format(canonical, opts?)` | canonical → display `"1,234,567.89"` |
| `finalize(canonical)` | settle transient typing states (`"1234."` → `"1234"`) |

### DOM

| | |
|---|---|
| `bind(el, opts?)` | attach live formatting; returns an unbind function |
| `observe(root?)` | bind all `[data-numkey]` now and as they appear |
| `getValue(el, opts?)` | canonical value of a bound input |
| `setValue(el, canonical, opts?)` | write a canonical value as the formatted display |
| `applyToInput(el, opts?)` | one caret-preserving reformat (building block) |
| `createRefBinder(opts?)` | ref-callback factory for any framework |

## Notes

- European formats work via options: `{ separator: '.', decimalPoint: ',' }`
  displays `1.234.567,89` while the canonical value stays `"1234567.89"`.
- Backspacing directly over a separator moves the caret past it (the digit
  is deleted on the next backspace) — the same behavior as the major masking
  libraries. Smart separator-skipping deletion is on the roadmap.
- Roadmap: Korean unit reading (`1500000` → “150만”), 만/억 shorthand parsing
  (`3만5천` → `35000`), hidden-field canonical sync for classic form posts.

## License

MIT © [devslab](https://github.com/devslab-kr)
