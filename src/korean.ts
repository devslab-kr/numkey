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

const BIG: Record<string, number> = { 만: 4, 억: 8, 조: 12, 경: 16 }
const SMALL: Record<string, number> = { 천: 3, 백: 2, 십: 1 }
const HANGUL_DIGIT: Record<string, string> = {
  영: '0', 공: '0', 일: '1', 이: '2', 삼: '3', 사: '4',
  오: '5', 육: '6', 칠: '7', 팔: '8', 구: '9'
}

/** Chars that mark a value as Korean-shorthand entry (used by the DOM layer). */
export const KOREAN_NUMBER_CHARS = /[만억조경천백십영공일이삼사오육칠팔구]/

/** Digits + optional small units within one 만-group: "3십5" → 35, "5천" → 5000. */
function parseSmallUnits(group: string): number {
  let result = 0
  let digits = ''
  for (const ch of group) {
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      digits += ch
    } else if (ch in SMALL) {
      const n = digits === '' ? 1 : parseFloat(digits)
      if (!Number.isNaN(n)) result += n * 10 ** (SMALL[ch] as number)
      digits = ''
    }
    // anything else is noise — dropped, same policy as parse()
  }
  if (digits !== '') {
    const n = parseFloat(digits)
    if (!Number.isNaN(n)) result += n
  }
  return result
}

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

/**
 * Korean-shorthand amount → canonical numeric string. The inverse direction
 * of `toKorean`, accepting what people actually type into 부동산/주식 apps:
 *
 *   fromKorean('3만5천')    // "35000"
 *   fromKorean('1.5억')     // "150000000"
 *   fromKorean('삼십오만')   // "350000"
 *   fromKorean('9,274억 8,304만 1,001') // "927483041001"
 *
 * Grammar: optional sign, then descending `[digits][.digits]?` × unit
 * segments (만/억/조/경, sub-units 천/백/십, full Hangul digits 일이삼…),
 * then optional trailing plain digits. Commas, spaces, and "원" are noise.
 * A bare unit means 1 ("만" → 10000). Plain numbers pass through
 * ("12,345" → "12345"). Computed with Number arithmetic — exact through the
 * money range (안전 한도 ~9,000조); returns '' for empty/unparseable input.
 */
export function fromKorean(text: string): string {
  let s = text
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 48))
    .replace(/[\s,，원]/g, '')
    .replace(/[영공일이삼사오육칠팔구]/g, (ch) => HANGUL_DIGIT[ch] as string)
  const neg = /^[-−－﹣]/.test(s)
  if (neg) s = s.slice(1)
  if (s === '') return ''

  let total = 0
  let group = ''
  for (const ch of s) {
    if (ch in BIG) {
      total += (group === '' ? 1 : parseSmallUnits(group)) * 10 ** (BIG[ch] as number)
      group = ''
    } else {
      group += ch
    }
  }
  if (group !== '') total += parseSmallUnits(group)

  if (!Number.isFinite(total)) return ''
  if (total === 0) return '0'
  return (neg ? '-' : '') + String(total)
}
