// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
  adjustDeleteCaret,
  applyToInput,
  bind,
  getValue,
  observe,
  setValue
} from './dom'

function makeInput(attrs: Record<string, string> = {}): HTMLInputElement {
  const el = document.createElement('input')
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  document.body.appendChild(el)
  return el
}

/** Simulate a keystroke result: set value + caret, fire input. */
function feed(el: HTMLInputElement, value: string, caret?: number): void {
  el.value = value
  const pos = caret ?? value.length
  el.setSelectionRange(pos, pos)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('applyToInput — caret-preserving reformat', () => {
  it('formats and keeps the caret at the end', () => {
    const el = makeInput()
    el.value = '1234'
    el.setSelectionRange(4, 4)
    expect(applyToInput(el)).toBe(true)
    expect(el.value).toBe('1,234')
    expect(el.selectionStart).toBe(5)
    expect(applyToInput(el)).toBe(false) // already formatted
  })

  it('keeps the caret stable on mid-string insertion across a new group', () => {
    // display was "123,567", user typed 4 after the 3 → raw "1234,567", caret 4
    const el = makeInput()
    el.value = '1234,567'
    el.setSelectionRange(4, 4)
    applyToInput(el)
    expect(el.value).toBe('1,234,567')
    expect(el.selectionStart).toBe(5) // "1,234|,567"
  })

  it('strips a leading zero without losing the caret', () => {
    const el = makeInput()
    el.value = '01'
    el.setSelectionRange(2, 2)
    applyToInput(el)
    expect(el.value).toBe('1')
    expect(el.selectionStart).toBe(1)
  })

  it('backspacing a separator restores the value with the caret moved left', () => {
    // "1,234" backspace at index 2 → raw "1234", caret 1
    const el = makeInput()
    el.value = '1234'
    el.setSelectionRange(1, 1)
    applyToInput(el)
    expect(el.value).toBe('1,234')
    expect(el.selectionStart).toBe(1) // "1|,234"
  })
})

describe('bind — attribute-driven behavior', () => {
  it('sets inputmode and right alignment, formats the server value', () => {
    const el = makeInput({ 'data-numkey': '', value: '1234567' })
    el.value = '1234567'
    bind(el)
    expect(el.getAttribute('inputmode')).toBe('numeric')
    expect(el.style.textAlign).toBe('right')
    expect(el.value).toBe('1,234,567')
  })

  it('data-numkey="2" enables decimals (and the decimal keypad)', () => {
    const el = makeInput({ 'data-numkey': '2' })
    bind(el)
    expect(el.getAttribute('inputmode')).toBe('decimal')
    feed(el, '1234.5')
    expect(el.value).toBe('1,234.5')
  })

  it('data-numkey-negative allows a leading minus', () => {
    const el = makeInput({ 'data-numkey': '', 'data-numkey-negative': '' })
    bind(el)
    feed(el, '-1234')
    expect(el.value).toBe('-1,234')
  })

  it('data-numkey-align="left" opts out of right alignment', () => {
    const el = makeInput({ 'data-numkey': '', 'data-numkey-align': 'left' })
    bind(el)
    expect(el.style.textAlign).toBe('')
  })

  it('respects an existing inputmode and inline alignment', () => {
    const el = makeInput({ 'data-numkey': '2', inputmode: 'numeric' })
    el.style.textAlign = 'center'
    bind(el)
    expect(el.getAttribute('inputmode')).toBe('numeric')
    expect(el.style.textAlign).toBe('center')
  })

  it('does not touch the value mid-IME-composition', () => {
    const el = makeInput({ 'data-numkey': '' })
    bind(el)
    el.dispatchEvent(new CompositionEvent('compositionstart'))
    feed(el, '1234ㅁ')
    expect(el.value).toBe('1234ㅁ') // untouched while composing
    el.dispatchEvent(new CompositionEvent('compositionend'))
    expect(el.value).toBe('1,234')
  })

  it('settles transient states on blur', () => {
    const el = makeInput({ 'data-numkey': '2' })
    bind(el)
    feed(el, '1234.')
    expect(el.value).toBe('1,234.')
    el.dispatchEvent(new Event('blur'))
    expect(el.value).toBe('1,234')
  })

  it('unbind stops formatting', () => {
    const el = makeInput({ 'data-numkey': '' })
    const unbind = bind(el)
    unbind()
    feed(el, '1234')
    expect(el.value).toBe('1234')
  })
})

describe('getValue / setValue — canonical read/write', () => {
  it('getValue returns the unformatted, settled value using the element options', () => {
    const el = makeInput({ 'data-numkey': '2', 'data-numkey-negative': '' })
    el.value = '-1,234,567.'
    expect(getValue(el)).toBe('-1234567')
  })

  it('setValue writes a canonical value as the formatted display', () => {
    const el = makeInput({ 'data-numkey': '2' })
    setValue(el, '1234567.89')
    expect(el.value).toBe('1,234,567.89')
    expect(getValue(el)).toBe('1234567.89')
  })

  it('canonical values survive a locale switch via setValue', () => {
    const el = makeInput({ 'data-numkey': '2' })
    setValue(el, '1234567.89')
    const canonical = getValue(el)
    el.setAttribute('data-numkey-locale', 'de-DE')
    setValue(el, canonical)
    expect(el.value).toBe('1.234.567,89')
    expect(getValue(el)).toBe('1234567.89')
  })
})

describe('data-numkey-locale — opt-in locale formatting', () => {
  it('formats with the locale separators from the attribute', () => {
    const el = makeInput({ 'data-numkey': '2', 'data-numkey-locale': 'de-DE' })
    bind(el)
    feed(el, '1234567,8')
    expect(el.value).toBe('1.234.567,8')
  })
})

describe('data-numkey-korean — live amount reading', () => {
  it('generates a span after the input and keeps it in sync', () => {
    const el = makeInput({ 'data-numkey': '', 'data-numkey-korean': '' })
    el.value = '1500000'
    const unbind = bind(el)
    const span = el.nextElementSibling as HTMLSpanElement
    expect(span.className).toBe('numkey-korean')
    expect(span.textContent).toBe('150만') // server value read at bind

    feed(el, '927483041001')
    expect(span.textContent).toBe('9,274억 8,304만 1,001')

    unbind()
    expect(el.nextElementSibling).toBeNull() // generated span removed
  })

  it('a selector value targets an existing element instead', () => {
    const target = document.createElement('div')
    target.id = 'hint'
    document.body.appendChild(target)
    const el = makeInput({ 'data-numkey': '', 'data-numkey-korean': '#hint' })
    const unbind = bind(el)
    feed(el, '15000')
    expect(target.textContent).toBe('1만 5,000')
    unbind()
    expect(document.getElementById('hint')).not.toBeNull() // not ours to remove
  })
})

describe('data-numkey-name — hidden canonical sync for form POSTs', () => {
  it('generates a hidden input that carries the canonical value', () => {
    const el = makeInput({ 'data-numkey': '2', 'data-numkey-name': 'amount' })
    el.value = '1234567.89'
    const unbind = bind(el)
    const hidden = el.nextElementSibling as HTMLInputElement
    expect(hidden.type).toBe('hidden')
    expect(hidden.name).toBe('amount')
    expect(el.value).toBe('1,234,567.89') // visible: display
    expect(hidden.value).toBe('1234567.89') // posted: canonical

    feed(el, '1,234,567.895') // over the decimal budget → truncated
    expect(hidden.value).toBe('1234567.89')

    feed(el, '500')
    expect(hidden.value).toBe('500')

    unbind()
    expect(el.nextElementSibling).toBeNull() // generated hidden removed
  })

  it('the hidden value is settled even while the display is transient', () => {
    const el = makeInput({ 'data-numkey': '2', 'data-numkey-name': 'amount' })
    bind(el)
    const hidden = el.nextElementSibling as HTMLInputElement
    feed(el, '1234.')
    expect(el.value).toBe('1,234.') // transient display kept for typing
    expect(hidden.value).toBe('1234') // canonical already settled
  })
})

describe('data-numkey-korean-entry — shorthand entry', () => {
  it('leaves a Korean draft alone while typing, converts on blur', () => {
    const el = makeInput({ 'data-numkey': '', 'data-numkey-korean-entry': '' })
    bind(el)
    feed(el, '3만5천')
    expect(el.value).toBe('3만5천') // untouched — no live reformat mid-word
    el.dispatchEvent(new Event('blur'))
    expect(el.value).toBe('35,000')
  })

  it('plain digits still format live', () => {
    const el = makeInput({ 'data-numkey': '', 'data-numkey-korean-entry': '' })
    bind(el)
    feed(el, '1234567')
    expect(el.value).toBe('1,234,567')
  })

  it('getValue and the hidden sync see the parsed value mid-draft', () => {
    const el = makeInput({
      'data-numkey': '',
      'data-numkey-korean-entry': '',
      'data-numkey-name': 'amount'
    })
    bind(el)
    const hidden = el.nextElementSibling as HTMLInputElement
    feed(el, '1.5억')
    expect(el.value).toBe('1.5억') // display: still the draft
    expect(getValue(el)).toBe('150000000')
    expect(hidden.value).toBe('150000000') // posts correctly even pre-blur
  })

  it('without the attribute Korean characters are stripped as before', () => {
    const el = makeInput({ 'data-numkey': '' })
    bind(el)
    feed(el, '3만5천')
    expect(el.value).toBe('35')
  })

  it('typing 1.5억 char by char keeps the decimal until the unit arrives', () => {
    // regression: the live reformat used to strip the '.' on an integer
    // field before 억 was typed, silently turning 1.5억 into 15억
    const el = makeInput({ 'data-numkey': '', 'data-numkey-korean-entry': '' })
    bind(el)
    let v = ''
    for (const ch of '1.5억') {
      v += ch
      feed(el, v)
      v = el.value // simulate the browser: next keystroke appends to what's shown
    }
    expect(el.value).toBe('1.5억')
    el.dispatchEvent(new Event('blur'))
    expect(el.value).toBe('150,000,000')
  })

  it('a bare decimal draft on an integer field truncates on blur', () => {
    const el = makeInput({ 'data-numkey': '', 'data-numkey-korean-entry': '' })
    bind(el)
    feed(el, '1.5') // user stopped before typing the unit
    expect(el.value).toBe('1.5') // protected while it could still become 1.5억
    el.dispatchEvent(new Event('blur'))
    expect(el.value).toBe('1') // integer field: fraction truncated, not "15"
  })
})

describe('adjustDeleteCaret — one-keystroke deletion across separators', () => {
  it('Backspace right after a separator steps past it', () => {
    const el = makeInput({ 'data-numkey': '' })
    el.value = '1,234'
    el.setSelectionRange(2, 2) // "1,|234"
    adjustDeleteCaret(el, 'Backspace')
    expect(el.selectionStart).toBe(1) // default action now deletes the 1
  })

  it('Delete right before a separator steps past it', () => {
    const el = makeInput({ 'data-numkey': '' })
    el.value = '1,234'
    el.setSelectionRange(1, 1) // "1|,234"
    adjustDeleteCaret(el, 'Delete')
    expect(el.selectionStart).toBe(2) // default action now deletes the 2
  })

  it('leaves range selections and non-separator positions alone', () => {
    const el = makeInput({ 'data-numkey': '' })
    el.value = '1,234'
    el.setSelectionRange(0, 3)
    adjustDeleteCaret(el, 'Backspace')
    expect(el.selectionStart).toBe(0)
    expect(el.selectionEnd).toBe(3)

    el.setSelectionRange(4, 4) // "1,23|4" — plain digit behind
    adjustDeleteCaret(el, 'Backspace')
    expect(el.selectionStart).toBe(4)
  })

  it('the bound keydown handler applies it automatically', () => {
    const el = makeInput({ 'data-numkey': '' })
    bind(el)
    el.value = '1,234'
    el.setSelectionRange(2, 2)
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))
    expect(el.selectionStart).toBe(1)
  })
})

describe('data-numkey-min / data-numkey-max — clamped on blur only', () => {
  it('does not interfere while typing, clamps on blur', () => {
    const el = makeInput({ 'data-numkey': '', 'data-numkey-min': '10' })
    bind(el)
    feed(el, '5') // on the way to 50 — must not be rejected mid-typing
    expect(el.value).toBe('5')
    el.dispatchEvent(new Event('blur'))
    expect(el.value).toBe('10')
  })

  it('clamps the maximum with grouping intact', () => {
    const el = makeInput({ 'data-numkey': '', 'data-numkey-max': '100000' })
    bind(el)
    feed(el, '9999999')
    el.dispatchEvent(new Event('blur'))
    expect(el.value).toBe('100,000')
  })

  it('clamps Korean shorthand on settle too', () => {
    const el = makeInput({
      'data-numkey': '',
      'data-numkey-korean-entry': '',
      'data-numkey-max': '1000000'
    })
    bind(el)
    feed(el, '1.5억')
    el.dispatchEvent(new Event('blur'))
    expect(el.value).toBe('1,000,000')
  })
})

describe('observe — auto-init', () => {
  it('binds existing and later-added [data-numkey] inputs', async () => {
    const existing = makeInput({ 'data-numkey': '' })
    const stop = observe()
    feed(existing, '1234')
    expect(existing.value).toBe('1,234')

    const added = document.createElement('input')
    added.setAttribute('data-numkey', '')
    document.body.appendChild(added)
    await new Promise((r) => setTimeout(r, 0)) // MutationObserver microtask
    feed(added, '5678')
    expect(added.value).toBe('5,678')
    stop()
  })
})
