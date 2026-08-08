/**
 * Solid adapters.
 *
 * `useNumkey` — ref factory (Solid refs are called once with the element,
 * and listeners die with it, so no explicit cleanup is needed):
 *
 *   import { useNumkey } from '@devslab/numkey/solid'
 *   <input ref={useNumkey({ decimals: 2 })} value="1234567" />
 *
 * `numkey` — `use:` directive, reactive to a signal:
 *
 *   <input use:numkey={{ decimals: 2, onValue: setAmount }} />
 *   <input use:numkey={decimals()} />
 *
 * Solid needs no resync: `input` is delegated at the document level, so the
 * element-level formatting listener runs first and `onInput` already reads
 * the formatted value.
 */
import { createRenderEffect, onCleanup } from 'solid-js'
import type { NumkeyOptions } from './core'
import { bind, createRefBinder, getValue } from './dom'

export type NumkeyDirectiveParam = NumkeyDirectiveOptions | number | undefined

export type NumkeyDirectiveOptions = NumkeyOptions & {
  /** Called with the CANONICAL value whenever it changes ("1234567"). */
  onValue?: (canonical: string) => void
}

function toOptions(
  param: NumkeyDirectiveParam
): NumkeyDirectiveOptions | undefined {
  return typeof param === 'number' ? { decimals: param } : param
}

export function useNumkey(
  opts?: NumkeyOptions
): (el: HTMLInputElement) => void {
  return createRefBinder(opts)
}

export function numkey(
  el: HTMLInputElement,
  param: () => NumkeyDirectiveParam
): void {
  createRenderEffect(() => {
    const { onValue, ...core } = toOptions(param()) ?? {}
    const opts = Object.keys(core).length > 0 ? core : undefined
    onCleanup(bind(el, opts))

    if (!onValue) return
    let last: string | null = null
    const report = (): void => {
      const canonical = getValue(el, opts)
      if (canonical === last) return
      last = canonical
      onValue(canonical)
    }
    el.addEventListener('input', report)
    el.addEventListener('blur', report)
    onCleanup(() => {
      el.removeEventListener('input', report)
      el.removeEventListener('blur', report)
    })
    report() // server-rendered / initial value
  })
}

declare module 'solid-js' {
  namespace JSX {
    interface Directives {
      numkey: NumkeyDirectiveParam
    }
  }
}
