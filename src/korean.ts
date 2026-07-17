/**
 * Korean amount reading — the "150만" hint that banking/fintech UIs render
 * next to amount inputs, in the mixed digits-plus-units style:
 *
 *   toKorean('1500000')      // "150만"
 *   toKorean('927483041001') // "9,274억 8,304만 1,001"
 *
 * Digits are grouped by 만 (10^4); zero groups are omitted; each group keeps
 * its own 3-digit comma grouping. The reading covers the INTEGER part only
 * (a fraction, rare on 금액 fields, is ignored). Append "원" (or style it in
 * via CSS ::after) yourself — the unit of account is the caller's business.
 */
import { finalize, format } from './core'

const UNITS = ['', '만', '억', '조', '경', '해', '자', '양']

export interface ToKoreanOptions {
  /** Space between unit groups ("150만 5,000" vs "150만5,000"). Default true. */
  spacing?: boolean
}

/** Canonical numeric string → mixed Korean unit reading. */
export function toKorean(canonical: string, opts?: ToKoreanOptions): string {
  const settled = finalize(canonical)
  if (settled === '') return ''

  const neg = settled.startsWith('-')
  let int = neg ? settled.slice(1) : settled
  const point = int.indexOf('.')
  if (point !== -1) int = int.slice(0, point)
  if (int === '' || /^0*$/.test(int)) return '0'

  // split from the right into 만-groups of 4 digits
  const groups: string[] = []
  for (let i = int.length; i > 0; i -= 4) {
    groups.unshift(int.slice(Math.max(0, i - 4), i))
  }
  if (groups.length > UNITS.length) return format(settled) // beyond 양 (10^32)

  const parts: string[] = []
  for (let i = 0; i < groups.length; i++) {
    const value = parseInt(groups[i] as string, 10)
    if (value === 0) continue
    parts.push(format(String(value)) + UNITS[groups.length - 1 - i])
  }
  return (neg ? '-' : '') + parts.join(opts?.spacing === false ? '' : ' ')
}
