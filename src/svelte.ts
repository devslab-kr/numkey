/**
 * Svelte adapters — actions for `use:`. Dependency-free: Svelte actions are
 * plain functions, so nothing here imports the `svelte` package and no peer
 * dependency is needed.
 *
 *   <input use:numkey />                            <!-- integers -->
 *   <input use:numkey={2} />                        <!-- 2 decimals -->
 *   <input use:numkey={{ decimals: 2, negative: true }} />
 *   <input use:numkey bind:value={display} />       <!-- "1,234,567" -->
 *   <input use:numkey={{ onValue: (v) => (amount = v) }} />  <!-- "1234567" -->
 *
 * `bind:value` works: Svelte attaches its own `input` listener before the
 * action runs, so the action binds with `resync` — after a reformat changes
 * the value it re-dispatches `input`, and the second (idempotent) pass lets
 * `bind:value` read the formatted display.
 *
 * `bind:value` holds the DISPLAY value ("1,234,567"). For the CANONICAL
 * value — the money-safe string you submit — use `onValue`, the action's
 * counterpart to the React component's `onValueChange`.
 */
import type { NumkeyOptions } from './core'
import { bind, getValue } from './dom'

/** Action parameter: options, a decimals shorthand, or nothing. */
export type NumkeyActionParam = NumkeyActionOptions | number | undefined

export type NumkeyActionOptions = NumkeyOptions & {
  /** Called with the CANONICAL value whenever it changes ("1234567"). */
  onValue?: (canonical: string) => void
}

/** Structural match for svelte's ActionReturn — no svelte import needed. */
export interface NumkeyActionReturn {
  update: (param?: NumkeyActionParam) => void
  destroy: () => void
}

function toOptions(param: NumkeyActionParam): NumkeyActionOptions | undefined {
  return typeof param === 'number' ? { decimals: param } : param
}

export function numkey(
  node: HTMLInputElement,
  param?: NumkeyActionParam
): NumkeyActionReturn {
  let opts = toOptions(param)
  let unbind: () => void
  let stopValue: (() => void) | null = null

  const start = (): void => {
    // `onValue` is ours, not a core option — pass the rest through untouched.
    const { onValue, ...core } = opts ?? {}
    const hasCore = Object.keys(core).length > 0
    unbind = bind(node, hasCore ? core : undefined, { resync: true })

    if (!onValue) return
    // The resynced `input` event re-enters this listener, so report only
    // when the canonical value actually changed.
    let last: string | null = null
    const report = (): void => {
      const canonical = getValue(node, hasCore ? core : undefined)
      if (canonical === last) return
      last = canonical
      onValue(canonical)
    }
    node.addEventListener('input', report)
    node.addEventListener('blur', report)
    stopValue = () => {
      node.removeEventListener('input', report)
      node.removeEventListener('blur', report)
    }
    report() // server-rendered / initial value
  }

  const stop = (): void => {
    stopValue?.()
    stopValue = null
    unbind()
  }

  start()
  return {
    update(next?: NumkeyActionParam) {
      stop()
      opts = toOptions(next)
      start()
    },
    destroy: stop
  }
}
