// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { applyToInput, bind, getValue, observe, setValue } from './dom'

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
