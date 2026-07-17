/**
 * DOM layer — attach live numeric formatting to an <input>.
 *
 *   <input data-numkey>                        — integers: 1,234,567
 *   <input data-numkey="2">                    — 2 decimals: 1,234.56
 *   <input data-numkey data-numkey-negative>   — minus allowed
 *   <input data-numkey data-numkey-align="left">  — opt out of right-align
 *   <input data-numkey data-numkey-korean>     — live "150만" reading in a
 *       generated <span class="numkey-korean"> after the input (or give the
 *       attribute a CSS selector to use an existing element)
 *   <input data-numkey data-numkey-name="amount"> — keep a generated hidden
 *       input named "amount" in sync with the CANONICAL value, so a classic
 *       form POST submits "1234567" while the field shows "1,234,567"
 *   <input data-numkey data-numkey-korean-entry> — accept Korean shorthand:
 *       typing "3만5천" is left alone until blur, which converts it to
 *       "35,000" (fromKorean)
 *
 * Binding sets `inputmode` (numeric/decimal) and right-aligns the field
 * unless either is already set, formats any server-rendered value in place,
 * and keeps the caret stable across reformatting (see core caret math).
 * IME-safe: nothing runs mid-composition (Korean IME half-composed jamo in a
 * number field would be destroyed otherwise); conversion runs on
 * `compositionend` and on regular `input` events. Blur settles transient
 * states ("1,234." → "1,234").
 *
 * Use `type="text"` inputs — `type="number"` has no caret API and already
 * fights custom formatting. numkey sets `inputmode` for the mobile keypad.
 */
import {
  caretIndex,
  countSignificant,
  finalize,
  format,
  parse,
  type NumkeyOptions
} from './core'
import { fromKorean, KOREAN_NUMBER_CHARS, toKorean } from './korean'

const SELECTOR = 'input[data-numkey]'

const unbinders = new WeakMap<HTMLInputElement, () => void>()

/** Read options from `data-numkey*` attributes. */
export function optionsFromElement(el: HTMLInputElement): NumkeyOptions {
  const main = el.getAttribute('data-numkey')
  const group = el.getAttribute('data-numkey-group')
  const separator = el.getAttribute('data-numkey-separator')
  const decimalPoint = el.getAttribute('data-numkey-point')
  const locale = el.getAttribute('data-numkey-locale')
  const opts: NumkeyOptions = {
    decimals: main ? parseInt(main, 10) || 0 : 0,
    negative: el.hasAttribute('data-numkey-negative'),
    koreanEntry: el.hasAttribute('data-numkey-korean-entry')
  }
  if (group) opts.group = parseInt(group, 10) || 3
  if (separator !== null) opts.separator = separator
  if (decimalPoint !== null) opts.decimalPoint = decimalPoint
  if (locale) opts.locale = locale
  return opts
}

function getCaret(el: HTMLInputElement): number | null {
  try {
    return el.selectionStart
  } catch {
    return null // type="number" etc. — no selection API
  }
}

function setCaret(el: HTMLInputElement, pos: number): void {
  try {
    el.setSelectionRange(pos, pos)
  } catch {
    /* no selection API */
  }
}

/**
 * Reformat an input's value in place, preserving the caret (significant
 * chars before the caret are counted in the old value and the caret lands
 * after the same count in the new display). Returns whether the value
 * changed — the building block the bind layer and framework adapters share.
 */
export function applyToInput(
  el: HTMLInputElement,
  opts?: NumkeyOptions
): boolean {
  const raw = el.value
  const display = format(parse(raw, opts), opts)
  if (display === raw) return false
  const caret = getCaret(el)
  el.value = display
  if (caret !== null) {
    setCaret(el, caretIndex(display, countSignificant(raw.slice(0, caret), opts), opts))
  }
  return true
}

/** Settle transient states and reformat — what blur runs. */
export function finalizeInput(
  el: HTMLInputElement,
  opts?: NumkeyOptions
): boolean {
  const display = format(finalize(parse(el.value, opts)), opts)
  if (display === el.value) return false
  el.value = display
  return true
}

/**
 * Clamp a canonical value to the field's `decimals` budget ("1.5" → "1" on
 * an integer field). Needed after `fromKorean`, which can yield fractions
 * the field itself would never allow.
 */
function constrain(canonical: string, o: NumkeyOptions): string {
  const point = canonical.indexOf('.')
  if (point === -1) return canonical
  const decimals = o.decimals ?? 0
  if (decimals <= 0) return canonical.slice(0, point) || '0'
  const cut = canonical.slice(0, point + 1 + decimals)
  return cut.endsWith('.') ? cut.slice(0, -1) : cut
}

/**
 * Whether a value is a Korean-shorthand draft that live reformatting must
 * not touch: it contains Korean number chars, or it is a decimal draft on
 * an integer field ("1." on the way to "1.5억" — stripping the point before
 * the unit arrives would silently turn 1.5억 into 15억).
 */
function isKoreanDraftValue(value: string, o: NumkeyOptions): boolean {
  if (!(o.koreanEntry ?? false)) return false
  if (KOREAN_NUMBER_CHARS.test(value)) return true
  return (o.decimals ?? 0) === 0 && /\d[.．]\d*$/.test(value)
}

/** Canonical value of a raw display value under the given options. */
function canonicalOf(value: string, o: NumkeyOptions): string {
  if (isKoreanDraftValue(value, o)) return constrain(fromKorean(value), o)
  return finalize(parse(value, o))
}

/** The canonical (unformatted, settled) value of a bound input. */
export function getValue(el: HTMLInputElement, opts?: NumkeyOptions): string {
  return canonicalOf(el.value, opts ?? optionsFromElement(el))
}

/**
 * Set an input from a CANONICAL value ("1234567.89") — the write counterpart
 * of `getValue`. Use this for programmatic updates (loading a record,
 * switching display options): assigning a canonical string to `el.value`
 * directly would show it unformatted, and re-parsing it under a non-`.`
 * decimal mark would corrupt it.
 */
export function setValue(
  el: HTMLInputElement,
  canonical: string,
  opts?: NumkeyOptions
): void {
  el.value = format(finalize(canonical), opts ?? optionsFromElement(el))
}

/**
 * Bind formatting to a single element. Options are read from the
 * `data-numkey*` attributes at event time unless `opts` is given explicitly.
 * Returns an unbind function. Binding an already-bound element is a no-op
 * that returns the existing unbinder.
 */
export function bind(el: HTMLInputElement, opts?: NumkeyOptions): () => void {
  const existing = unbinders.get(el)
  if (existing) return existing

  const resolve = (): NumkeyOptions => opts ?? optionsFromElement(el)

  // One-time setup: mobile keypad, alignment, server-rendered value.
  const initial = resolve()
  if (!el.hasAttribute('inputmode')) {
    el.setAttribute('inputmode', (initial.decimals ?? 0) > 0 ? 'decimal' : 'numeric')
  }
  if (
    el.style.textAlign === '' &&
    el.getAttribute('data-numkey-align') !== 'left'
  ) {
    el.style.textAlign = 'right'
  }

  // data-numkey-korean: live "150만" reading. Empty value → generate a span
  // right after the input; a value is a selector for an existing element.
  const koreanAttr = el.getAttribute('data-numkey-korean')
  let koreanTarget: Element | null = null
  let koreanCreated = false
  if (koreanAttr !== null) {
    if (koreanAttr === '') {
      koreanTarget = document.createElement('span')
      koreanTarget.className = 'numkey-korean'
      el.insertAdjacentElement('afterend', koreanTarget)
      koreanCreated = true
    } else {
      koreanTarget = document.querySelector(koreanAttr)
    }
  }

  // data-numkey-name: hidden input carrying the canonical value for form
  // POSTs. Always generated (and removed on unbind).
  const hiddenName = el.getAttribute('data-numkey-name')
  let hidden: HTMLInputElement | null = null
  if (hiddenName) {
    hidden = document.createElement('input')
    hidden.type = 'hidden'
    hidden.name = hiddenName
    el.insertAdjacentElement('afterend', hidden)
  }

  const syncExtras = (o: NumkeyOptions): void => {
    if (!koreanTarget && !hidden) return
    const canonical = canonicalOf(el.value, o)
    if (koreanTarget) koreanTarget.textContent = toKorean(canonical)
    if (hidden) hidden.value = canonical
  }

  const settle = (o: NumkeyOptions): void => {
    if (isKoreanDraftValue(el.value, o)) {
      el.value = format(constrain(fromKorean(el.value), o), o)
      syncExtras(o)
    } else {
      finalizeInput(el, o)
      syncExtras(o)
    }
  }

  settle(initial) // server-rendered value → formatted display

  let composing = false

  const run = (): void => {
    const o = resolve()
    if (!isKoreanDraftValue(el.value, o)) applyToInput(el, o)
    syncExtras(o)
  }

  const onCompositionStart = (): void => {
    composing = true
  }
  const onCompositionEnd = (): void => {
    composing = false
    run()
  }
  const onInput = (): void => {
    if (!composing) run()
  }
  const onBlur = (): void => {
    settle(resolve())
  }

  el.addEventListener('compositionstart', onCompositionStart)
  el.addEventListener('compositionend', onCompositionEnd)
  el.addEventListener('input', onInput)
  el.addEventListener('blur', onBlur)

  const unbind = (): void => {
    el.removeEventListener('compositionstart', onCompositionStart)
    el.removeEventListener('compositionend', onCompositionEnd)
    el.removeEventListener('input', onInput)
    el.removeEventListener('blur', onBlur)
    if (koreanCreated) koreanTarget?.remove()
    hidden?.remove()
    unbinders.delete(el)
  }
  unbinders.set(el, unbind)
  return unbind
}

function isBindable(node: unknown): node is HTMLInputElement {
  return (
    typeof HTMLInputElement !== 'undefined' && node instanceof HTMLInputElement
  )
}

function bindAll(scope: ParentNode): void {
  for (const el of scope.querySelectorAll(SELECTOR)) {
    if (isBindable(el)) bind(el)
  }
}

/**
 * Framework-agnostic ref-callback factory: pass the element to bind, `null`
 * to unbind. This is what the React `useNumkey` hook wraps — usable directly
 * with any library that hands you element refs.
 */
export function createRefBinder(
  opts?: NumkeyOptions
): (el: HTMLInputElement | null) => void {
  let unbind: (() => void) | null = null
  return (el) => {
    unbind?.()
    unbind = el ? bind(el, opts) : null
  }
}

/**
 * Bind every `[data-numkey]` input under `root` (default: `document`) and
 * keep watching for inputs added later or gaining the attribute. Returns a
 * stop function that disconnects the observer (existing bindings stay).
 */
export function observe(root: ParentNode = document): () => void {
  bindAll(root)

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes' && isBindable(record.target)) {
        if (record.target.hasAttribute('data-numkey')) bind(record.target)
        continue
      }
      for (const node of record.addedNodes) {
        if (isBindable(node) && node.matches(SELECTOR)) bind(node)
        else if (node instanceof Element) bindAll(node)
      }
    }
  })

  observer.observe(root as Node, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-numkey']
  })
  return () => observer.disconnect()
}
