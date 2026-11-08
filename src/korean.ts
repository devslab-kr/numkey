/**
 * Korean amount reading — the "150만" hint that banking/fintech UIs render
 * next to amount inputs, plus the fully spelled-out readings that contracts,
 * receipts, and bank paper use. One function, four `style`s:
 *
 *   toKorean('1500000')                     // "150만"            mixed (default)
 *   toKorean('1500000', { style: 'hangul' }) // "백오십만"          spoken reading
 *   toKorean('1500000', { style: 'formal' }) // "일백오십만"        계약서·영수증
 *   toKorean('1500000', { style: 'hanja' })  // "壹佰伍拾萬"        갖은자 (수표·어음)
 *   toKorean('927483041001')                // "9,274억 8,304만 1,001"
 *
 * Digits are grouped by 만 (10^4); zero groups are omitted. `mixed` keeps
 * each group as comma-grouped digits; the other styles spell every position
 * (천·백·십) and digit. `hangul` drops the leading 일 the way people speak
 * (천오백, 만 오천 — but 일억, 일조); `formal` and `hanja` write every 일/壹
 * because their job is to leave no gap a forger could fill, and for the
 * same reason they default to no spaces between groups. The reading covers
 * the INTEGER part only (a fraction, rare on 금액 fields, is ignored).
 * Append "원" / "금 … 원정" yourself — the unit of account and the document
 * frame are the caller's business.
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

/**
 * How the reading is spelled.
 *
 * - `mixed`  — digits + units, "150만" (default; what banking UIs show)
 * - `hangul` — spoken Hangul, "백오십만" (leading 일 dropped as in speech)
 * - `formal` — document Hangul, "일백오십만" (every 일 written; 계약서·영수증)
 * - `hanja`  — 갖은자, "壹佰伍拾萬" (anti-forgery numerals; 수표·어음·입금표)
 */
export type KoreanReadingStyle = 'mixed' | 'hangul' | 'formal' | 'hanja'

export interface ToKoreanOptions {
  /** Reading style. Default `'mixed'`; unknown values fall back to it. */
  style?: KoreanReadingStyle
  /**
   * Space between unit groups ("150만 5,000" vs "150만5,000"). Default true
   * for `mixed` and `hangul`, false for `formal` and `hanja` (document styles
   * are written as one unbroken token).
   */
  spacing?: boolean
}

/** Spelling tables for the spelled-out styles: digits 1–9, positions 십백천, big units. */
interface Spelling {
  digits: readonly string[] // index 1..9
  small: readonly string[] // ['', 십, 백, 천]
  big: readonly string[] // ['', 만, 억, …]
  zero: string
  /** Drop the digit 1 before 십/백/천 and before a bare 만 (spoken reading). */
  dropOne: boolean
  /** Default group spacing when the caller does not say. */
  spacing: boolean
}

const HANGUL_DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
const HANGUL_SMALL = ['', '십', '백', '천']

const SPELLINGS: Record<Exclude<KoreanReadingStyle, 'mixed'>, Spelling> = {
  hangul: { digits: HANGUL_DIGITS, small: HANGUL_SMALL, big: UNITS, zero: '영', dropOne: true, spacing: true },
  formal: { digits: HANGUL_DIGITS, small: HANGUL_SMALL, big: UNITS, zero: '영', dropOne: false, spacing: false },
  hanja: {
    digits: ['', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖'],
    small: ['', '拾', '佰', '仟'],
    big: ['', '萬', '億', '兆', '京', '垓', '秭', '穰'],
    zero: '零',
    dropOne: false,
    spacing: false
  }
}

/**
 * Spell one 만-group (up to 4 digits, value > 0) position by position.
 * `dropOne` omits the 일 before 십/백/천 ("천오백" not "일천오백"); the lone
 * 일 in the ones position is always written ("십일", "일").
 */
function spellGroup(group: string, sp: Spelling): string {
  let out = ''
  const n = group.length
  for (let i = 0; i < n; i++) {
    const d = group.charCodeAt(i) - 48
    if (d === 0) continue
    const pos = n - 1 - i // 0 = ones, 1 = 십, 2 = 백, 3 = 천
    if (!(d === 1 && pos > 0 && sp.dropOne)) out += sp.digits[d]
    out += sp.small[pos]
  }
  return out
}

/** Spelled-out reading for the hangul/formal/hanja styles. */
function spellOut(groups: string[], neg: boolean, sp: Spelling, spacing: boolean): string {
  const parts: string[] = []
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i] as string
    if (/^0+$/.test(group)) continue
    const unitIndex = groups.length - 1 - i
    // spoken reading says "만" for exactly 1만, but "일억", "일조" above it
    const bareMan = sp.dropOne && unitIndex === 1 && parseInt(group, 10) === 1
    parts.push((bareMan ? '' : spellGroup(group, sp)) + sp.big[unitIndex])
  }
  return (neg ? '-' : '') + parts.join(spacing ? ' ' : '')
}

/** Canonical numeric string → Korean amount reading in the chosen style. */
export function toKorean(canonical: string, opts?: ToKoreanOptions): string {
  const settled = finalize(canonical)
  if (settled === '') return ''

  const style = opts?.style
  const spelling = style !== undefined && style !== 'mixed' ? SPELLINGS[style] : undefined

  const neg = settled.startsWith('-')
  let int = neg ? settled.slice(1) : settled
  const point = int.indexOf('.')
  if (point !== -1) int = int.slice(0, point)
  if (int === '' || /^0*$/.test(int)) return spelling ? spelling.zero : '0'

  // split from the right into 만-groups of 4 digits
  const groups: string[] = []
  for (let i = int.length; i > 0; i -= 4) {
    groups.unshift(int.slice(Math.max(0, i - 4), i))
  }
  if (groups.length > UNITS.length) return format(settled) // beyond 양 (10^32)

  if (spelling) {
    return spellOut(groups, neg, spelling, opts?.spacing ?? spelling.spacing)
  }

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
