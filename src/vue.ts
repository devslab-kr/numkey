/**
 * Vue 3 adapters.
 *
 * `vNumkey` — directive for plain (non-v-model) inputs. The value is an
 * options object, a number shorthand for `{ decimals: n }`, or nothing
 * (options come from the `data-numkey*` attributes):
 *
 *   <input v-numkey>
 *   <input v-numkey="2">
 *   <input v-numkey="{ decimals: 2, negative: true }">
 *
 * `NumkeyInput` — component that formats before emitting, so `v-model`
 * works: the bound ref always receives the CANONICAL value ("1234567"),
 * while the field displays "1,234,567" (the directive mutates the DOM after
 * v-model reads it, which fights the binding).
 *
 *   <NumkeyInput v-model="amount" :decimals="2" negative />
 */
import { defineComponent, h, type Directive, type PropType } from 'vue'
import { finalize, format, parse, type NumkeyOptions } from './core'
import { applyToInput, bind, finalizeInput } from './dom'

type DirectiveValue = NumkeyOptions | number | undefined

function toOptions(value: DirectiveValue): NumkeyOptions | undefined {
  return typeof value === 'number' ? { decimals: value } : value
}

const unbinds = new WeakMap<HTMLInputElement, () => void>()

export const vNumkey: Directive<HTMLInputElement, DirectiveValue> = {
  mounted(el, binding) {
    unbinds.set(el, bind(el, toOptions(binding.value)))
  },
  updated(el, binding) {
    if (JSON.stringify(binding.value) !== JSON.stringify(binding.oldValue)) {
      unbinds.get(el)?.()
      unbinds.set(el, bind(el, toOptions(binding.value)))
    }
  },
  unmounted(el) {
    unbinds.get(el)?.()
    unbinds.delete(el)
  }
}

export const NumkeyInput = defineComponent({
  name: 'NumkeyInput',
  inheritAttrs: false,
  props: {
    /** Canonical value ("1234567"), not the display value. */
    modelValue: { type: String, default: '' },
    decimals: { type: Number, default: 0 },
    negative: { type: Boolean, default: false },
    /** Escape hatch for group/separator/decimalPoint. */
    options: {
      type: Object as PropType<NumkeyOptions>,
      default: undefined
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit, attrs }) {
    const opts = (): NumkeyOptions => ({
      decimals: props.decimals,
      negative: props.negative,
      ...props.options
    })

    let composing = false

    const formatAndEmit = (e: Event): void => {
      const el = e.target as HTMLInputElement
      const o = opts()
      applyToInput(el, o)
      emit('update:modelValue', parse(el.value, o))
    }

    return () =>
      h('input', {
        style: 'text-align: right',
        inputmode: props.decimals > 0 ? 'decimal' : 'numeric',
        ...attrs,
        value: format(props.modelValue, opts()),
        onCompositionstart: () => {
          composing = true
        },
        onCompositionend: (e: Event) => {
          composing = false
          formatAndEmit(e)
        },
        onInput: (e: Event) => {
          if (!composing) formatAndEmit(e)
        },
        onBlur: (e: Event) => {
          const el = e.target as HTMLInputElement
          const o = opts()
          finalizeInput(el, o)
          emit('update:modelValue', finalize(parse(el.value, o)))
        }
      })
  }
})
