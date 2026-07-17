/**
 * React adapters.
 *
 * `useNumkey` — ref-callback hook for uncontrolled inputs:
 *
 *   import { useNumkey } from '@devslab/numkey/react'
 *   <input ref={useNumkey({ decimals: 2 })} defaultValue="1234567" />
 *
 * `NumkeyInput` — component that formats inside the React data flow, so
 * CONTROLLED inputs work. `value` is the CANONICAL string ("1234567"); the
 * field displays "1,234,567"; `onValueChange` receives the canonical value
 * (the ref-based hook mutates the DOM after React reads it, which fights
 * `value=`/`setState`).
 *
 *   <NumkeyInput value={v} onValueChange={setV} decimals={2} negative />
 */
import {
  createElement,
  forwardRef,
  useMemo,
  useRef,
  type ChangeEvent,
  type CompositionEvent,
  type CSSProperties,
  type FocusEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type Ref
} from 'react'
import {
  caretIndex,
  clamp,
  countSignificant,
  finalize,
  format,
  parse,
  type NumkeyOptions
} from './core'
import { adjustDeleteCaret, applyToInput, createRefBinder } from './dom'

export function useNumkey(
  opts?: NumkeyOptions
): (el: HTMLInputElement | null) => void {
  const key = JSON.stringify(opts ?? null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => createRefBinder(opts), [key])
}

type OverriddenHandlers =
  | 'value'
  | 'defaultValue'
  | 'onChange'
  | 'onBlur'
  | 'onKeyDown'
  | 'onCompositionStart'
  | 'onCompositionEnd'

export type NumkeyInputProps = {
  /** Canonical value ("1234567"), not the display value. */
  value?: string
  defaultValue?: string
  decimals?: number
  negative?: boolean
  /** Escape hatch for group/separator/decimalPoint. */
  options?: NumkeyOptions
  /** Fires with the canonical value after every change (and settled on blur). */
  onValueChange?: (canonical: string) => void
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  onCompositionStart?: (e: CompositionEvent<HTMLInputElement>) => void
  onCompositionEnd?: (e: CompositionEvent<HTMLInputElement>) => void
} & Omit<InputHTMLAttributes<HTMLInputElement>, OverriddenHandlers>

/**
 * Set the value through the prototype setter so React's internal value
 * tracker sees the change and the dispatched `input` event isn't deduped.
 */
function setValueNative(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set
  if (setter) setter.call(el, value)
  else el.value = value
}

export const NumkeyInput = forwardRef(function NumkeyInput(
  {
    value,
    defaultValue,
    decimals = 0,
    negative = false,
    options,
    onValueChange,
    onChange,
    onBlur,
    onKeyDown,
    onCompositionStart,
    onCompositionEnd,
    style,
    ...rest
  }: NumkeyInputProps,
  ref: Ref<HTMLInputElement>
): ReactElement {
  const composing = useRef(false)
  const opts: NumkeyOptions = { decimals, negative, ...options }

  return createElement('input', {
    ...rest,
    ref,
    inputMode: rest.inputMode ?? (decimals > 0 ? 'decimal' : 'numeric'),
    style: { textAlign: 'right', ...style } as CSSProperties,
    value: value !== undefined ? format(value, opts) : undefined,
    defaultValue:
      defaultValue !== undefined ? format(defaultValue, opts) : undefined,
    onCompositionStart: (e: CompositionEvent<HTMLInputElement>) => {
      composing.current = true
      onCompositionStart?.(e)
    },
    onCompositionEnd: (e: CompositionEvent<HTMLInputElement>) => {
      composing.current = false
      const el = e.currentTarget
      const raw = el.value
      const next = format(parse(raw, opts), opts)
      if (next !== raw) {
        const caret = el.selectionStart
        setValueNative(el, next)
        if (caret !== null) {
          const pos = caretIndex(
            next,
            countSignificant(raw.slice(0, caret), opts),
            opts
          )
          el.setSelectionRange(pos, pos)
        }
        // re-fire so controlled state picks up the formatted value
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
      onCompositionEnd?.(e)
    },
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      // format before the consumer reads e.target.value
      if (!composing.current) applyToInput(e.currentTarget, opts)
      onValueChange?.(parse(e.currentTarget.value, opts))
      onChange?.(e)
    },
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (!composing.current) adjustDeleteCaret(e.currentTarget, e.key, opts)
      onKeyDown?.(e)
    },
    onBlur: (e: FocusEvent<HTMLInputElement>) => {
      const el = e.currentTarget
      const canonical = clamp(finalize(parse(el.value, opts)), opts)
      const display = format(canonical, opts)
      if (display !== el.value) {
        setValueNative(el, display)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
      onValueChange?.(canonical)
      onBlur?.(e)
    }
  })
})
