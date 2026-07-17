/**
 * DOM layer — attach live numeric formatting to an <input>.
 *
 *   <input data-numkey>                        — integers: 1,234,567
 *   <input data-numkey="2">                    — 2 decimals: 1,234.56
 *   <input data-numkey data-numkey-negative>   — minus allowed
 *   <input data-numkey data-numkey-align="left">  — opt out of right-align
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

const SELECTOR = 'input[data-numkey]'

const unbinders = new WeakMap<HTMLInputElement, () => void>()

/** Read options from `data-numkey*` attributes. */
export function optionsFromElement(el: HTMLInputElement): NumkeyOptions {
  const main = el.getAttribute('data-numkey')
  const group = el.getAttribute('data-numkey-group')
  const separator = el.getAttribute('data-numkey-separator')
  const decimalPoint = el.getAttribute('data-numkey-point')
  const opts: NumkeyOptions = {
    decimals: main ? parseInt(main, 10) || 0 : 0,
    negative: el.hasAttribute('data-numkey-negative')
  }
  if (group) opts.group = parseInt(group, 10) || 3
  if (separator !== null) opts.separator = separator
  if (decimalPoint !== null) opts.decimalPoint = decimalPoint
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

/** The canonical (unformatted, settled) value of a bound input. */
export function getValue(el: HTMLInputElement, opts?: NumkeyOptions): string {
  return finalize(parse(el.value, opts ?? optionsFromElement(el)))
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
  applyToInput(el, initial)

  let composing = false

  const onCompositionStart = (): void => {
    composing = true
  }
  const onCompositionEnd = (): void => {
    composing = false
    applyToInput(el, resolve())
  }
  const onInput = (): void => {
    if (!composing) applyToInput(el, resolve())
  }
  const onBlur = (): void => {
    finalizeInput(el, resolve())
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
