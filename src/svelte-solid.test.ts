// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createRoot, createSignal } from 'solid-js'
import { numkey as svelteNumkey } from './svelte'
import { numkey as solidNumkey, useNumkey } from './solid'

function makeInput(value = ''): HTMLInputElement {
  const el = document.createElement('input')
  el.value = value
  document.body.appendChild(el)
  return el
}

function type(el: HTMLInputElement, value: string): void {
  el.value = value
  el.setSelectionRange(value.length, value.length)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('numkey (Svelte action)', () => {
  it('formats as you type, updates options, destroys', () => {
    const el = makeInput()
    const action = svelteNumkey(el, 2)

    type(el, '1234567.89')
    expect(el.value).toBe('1,234,567.89')

    // integers now: the point is not a decimal mark, so its digits survive
    action.update(0)
    type(el, '1234567.89')
    expect(el.value).toBe('123,456,789')

    action.destroy()
    type(el, '7654321')
    expect(el.value).toBe('7654321')
  })

  it('accepts an options object and the decimals shorthand alike', () => {
    const el = makeInput()
    const action = svelteNumkey(el, { negative: true })
    type(el, '-1234567')
    expect(el.value).toBe('-1,234,567')
    action.destroy()
  })

  it('without a parameter falls back to the data-numkey attributes', () => {
    const el = makeInput()
    el.setAttribute('data-numkey', '2')
    const action = svelteNumkey(el)
    type(el, '1234.5')
    expect(el.value).toBe('1,234.5')
    action.destroy()
  })

  it('resyncs so an earlier-registered listener (bind:value) sees the formatted value', () => {
    const el = makeInput()
    // Svelte registers bind:value's input listener before the action runs
    let bound = ''
    el.addEventListener('input', () => {
      bound = el.value
    })
    const action = svelteNumkey(el, 0)
    type(el, '1234567')
    expect(el.value).toBe('1,234,567')
    expect(bound).toBe('1,234,567') // picked up via the re-dispatched event
    action.destroy()
  })

  it('reports the canonical value through onValue, without duplicates', () => {
    const el = makeInput()
    const seen: string[] = []
    const action = svelteNumkey(el, {
      decimals: 2,
      onValue: (v) => seen.push(v)
    })

    type(el, '1234567.89')
    el.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(seen[seen.length - 1]).toBe('1234567.89') // canonical, not "1,234,567.89"
    expect(seen).toEqual([...new Set(seen)]) // resync does not double-report
    action.destroy()
  })

  it('formats a server-rendered value on mount and reports it', () => {
    const el = makeInput('1234567')
    const seen: string[] = []
    const action = svelteNumkey(el, { onValue: (v) => seen.push(v) })
    expect(el.value).toBe('1,234,567')
    expect(seen).toEqual(['1234567'])
    action.destroy()
  })

  it('stops reporting after destroy', () => {
    const el = makeInput()
    const seen: string[] = []
    const action = svelteNumkey(el, { onValue: (v) => seen.push(v) })
    action.destroy()
    type(el, '1234567')
    expect(seen).toEqual([''])
  })
})

describe('numkey (Solid directive)', () => {
  it('binds reactively to a signal and cleans up on dispose', () => {
    const el = makeInput()
    // set up inside the root, drive from outside it — updates inside the
    // createRoot callback are batched and would not re-run the effect yet
    let setDecimals!: (n: number) => number
    let dispose!: () => void
    createRoot((d) => {
      dispose = d
      const [decimals, set] = createSignal(2)
      setDecimals = set
      solidNumkey(el, decimals)
    })

    type(el, '1234567.89')
    expect(el.value).toBe('1,234,567.89')

    // integers now: the point is not a decimal mark, so its digits survive
    setDecimals(0)
    type(el, '1234567.89')
    expect(el.value).toBe('123,456,789')

    dispose()
    type(el, '7654321')
    expect(el.value).toBe('7654321')
  })

  it('reports the canonical value through onValue', () => {
    const el = makeInput()
    const seen: string[] = []
    let dispose!: () => void
    createRoot((d) => {
      dispose = d
      solidNumkey(el, () => ({ decimals: 2, onValue: (v) => seen.push(v) }))
    })

    type(el, '1234567.89')
    expect(seen[seen.length - 1]).toBe('1234567.89')

    dispose()
    type(el, '1')
    expect(seen[seen.length - 1]).toBe('1234567.89') // no reports after dispose
  })

  it('useNumkey returns a ref binder', () => {
    const el = makeInput()
    useNumkey({ decimals: 2 })(el)
    type(el, '1234567.8')
    expect(el.value).toBe('1,234,567.8')
  })
})
