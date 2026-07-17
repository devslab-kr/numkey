// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { applyToInput, createRefBinder } from './dom'
import { NumkeyInput, vNumkey } from './vue'

function makeInput(): HTMLInputElement {
  const el = document.createElement('input')
  document.body.appendChild(el)
  return el
}

function feed(el: HTMLInputElement, value: string, caret?: number): void {
  el.value = value
  const pos = caret ?? value.length
  el.setSelectionRange(pos, pos)
  el.dispatchEvent(new Event('input'))
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('createRefBinder (React useNumkey core)', () => {
  it('binds on element, unbinds on null', () => {
    const binder = createRefBinder()
    const el = makeInput()
    binder(el)
    feed(el, '1234')
    expect(el.value).toBe('1,234')

    binder(null)
    feed(el, '5678')
    expect(el.value).toBe('5678')
  })

  it('moves the binding when the element changes', () => {
    const binder = createRefBinder()
    const first = makeInput()
    const second = makeInput()
    binder(first)
    binder(second)

    feed(first, '1234')
    expect(first.value).toBe('1234') // old element released
    feed(second, '1234')
    expect(second.value).toBe('1,234')
  })
})

describe('applyToInput (component building block)', () => {
  it('formats in place, preserves the caret, reports change', () => {
    const el = makeInput()
    el.value = '1234567'
    el.setSelectionRange(7, 7)
    expect(applyToInput(el)).toBe(true)
    expect(el.value).toBe('1,234,567')
    expect(el.selectionStart).toBe(9)
    expect(applyToInput(el)).toBe(false)
  })
})

describe('NumkeyInput (Vue component)', () => {
  function mount(component: ReturnType<typeof defineComponent>) {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const app = createApp(component)
    app.mount(host)
    return { host, app }
  }

  it('v-model receives the canonical value while the field shows the display', async () => {
    const model = ref('')
    const { host, app } = mount(
      defineComponent({
        setup: () => () =>
          h(NumkeyInput, {
            modelValue: model.value,
            'onUpdate:modelValue': (v: string) => {
              model.value = v
            }
          })
      })
    )
    const el = host.querySelector('input')!
    expect(el.style.textAlign).toBe('right')
    expect(el.getAttribute('inputmode')).toBe('numeric')

    feed(el, '1234567')
    expect(el.value).toBe('1,234,567')
    expect(model.value).toBe('1234567')
    await nextTick()
    expect(el.value).toBe('1,234,567') // v-model patch does not revert it
    app.unmount()
  })

  it('renders the formatted display from an initial canonical model', () => {
    const { host, app } = mount(
      defineComponent({
        setup: () => () => h(NumkeyInput, { modelValue: '9876543' })
      })
    )
    expect(host.querySelector('input')!.value).toBe('9,876,543')
    app.unmount()
  })

  it('settles transient decimals on blur', async () => {
    const model = ref('')
    const { host, app } = mount(
      defineComponent({
        setup: () => () =>
          h(NumkeyInput, {
            modelValue: model.value,
            decimals: 2,
            'onUpdate:modelValue': (v: string) => {
              model.value = v
            }
          })
      })
    )
    const el = host.querySelector('input')!
    feed(el, '1234.')
    expect(model.value).toBe('1234.')
    el.dispatchEvent(new Event('blur'))
    expect(el.value).toBe('1,234')
    expect(model.value).toBe('1234')
    app.unmount()
  })

  it('waits for the IME composition to end before formatting', () => {
    const model = ref('')
    const { host, app } = mount(
      defineComponent({
        setup: () => () =>
          h(NumkeyInput, {
            modelValue: model.value,
            'onUpdate:modelValue': (v: string) => {
              model.value = v
            }
          })
      })
    )
    const el = host.querySelector('input')!
    el.dispatchEvent(new CompositionEvent('compositionstart'))
    feed(el, '1234ㅁ')
    expect(el.value).toBe('1234ㅁ') // untouched mid-composition
    expect(model.value).toBe('')
    el.dispatchEvent(new CompositionEvent('compositionend'))
    expect(el.value).toBe('1,234')
    expect(model.value).toBe('1234')
    app.unmount()
  })
})

describe('vNumkey (Vue directive)', () => {
  type Hooks = {
    mounted: (el: HTMLInputElement, b: Record<string, unknown>) => void
    updated: (el: HTMLInputElement, b: Record<string, unknown>) => void
    unmounted: (el: HTMLInputElement) => void
  }
  const dir = vNumkey as unknown as Hooks

  it('mounted binds with the directive value (number = decimals)', () => {
    const el = makeInput()
    dir.mounted(el, { value: 2 })
    feed(el, '1234.5')
    expect(el.value).toBe('1,234.5')
    dir.unmounted(el)
  })

  it('mounted without value falls back to data-numkey attributes', () => {
    const el = makeInput()
    el.setAttribute('data-numkey', '')
    el.setAttribute('data-numkey-negative', '')
    dir.mounted(el, { value: undefined })
    feed(el, '-1234')
    expect(el.value).toBe('-1,234')
    dir.unmounted(el)
  })

  it('updated rebinds when the options change', () => {
    const el = makeInput()
    dir.mounted(el, { value: 0 })
    dir.updated(el, { value: 2, oldValue: 0 })
    feed(el, '1.5')
    expect(el.value).toBe('1.5')
    dir.unmounted(el)
  })

  it('unmounted stops formatting', () => {
    const el = makeInput()
    dir.mounted(el, { value: undefined })
    dir.unmounted(el)
    feed(el, '1234')
    expect(el.value).toBe('1234')
  })
})
