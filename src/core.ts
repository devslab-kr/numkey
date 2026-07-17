/**
 * Core — pure string-in/string-out numeric formatting.
 *
 * String-first value model: the CANONICAL value is a plain ASCII numeric
 * string ("-1234567.89") that never touches IEEE 754 (money-safe), and the
 * DISPLAY value is what sits in the input ("-1,234,567.89").
 * `parse` goes display → canonical, `format` goes canonical → display.
 *
 * Transient states survive so progressive typing works: "1234." and "-" are
 * valid canonicals mid-keystroke; `finalize` settles them (used on blur).
 */

export interface NumkeyOptions {
  /** Max fraction digits. 0 (default) allows integers only. */
  decimals?: number
  /** Allow a leading minus sign. Default false. */
  negative?: boolean
  /** Digits per group in the integer part. Default 3 (use 4 for 만-style grouping). */
  group?: number
  /** Group separator in the display value. Default ','. */
  separator?: string
  /** Decimal mark in the display value. The canonical value always uses '.'. Default '.'. */
  decimalPoint?: string
  /**
   * Derive `separator`/`decimalPoint` from a locale via `Intl.NumberFormat`:
   * a BCP 47 tag ("de-DE") or "auto" (the browser language). OPT-IN — by
   * default the display is deterministic (`,` / `.`) regardless of the
   * visitor's browser, which is what business forms usually need. Explicit
   * `separator`/`decimalPoint` win over the locale.
   */
  locale?: string
}

type Resolved = Required<NumkeyOptions>

const localeCache = new Map<string, { separator: string; decimalPoint: string }>()

/**
 * The group separator and decimal mark a locale uses ("de-DE" → `.` / `,`).
 * "auto" (or empty) resolves the browser language; unknown tags and non-Intl
 * environments fall back to `,` / `.`.
 */
export function localeSeparators(locale?: string): {
  separator: string
  decimalPoint: string
} {
  const tag =
    !locale || locale === 'auto'
      ? typeof navigator !== 'undefined'
        ? navigator.language
        : undefined
      : locale
  const key = tag ?? ''
  const cached = localeCache.get(key)
  if (cached) return cached

  let out = { separator: ',', decimalPoint: '.' }
  try {
    const parts = new Intl.NumberFormat(tag).formatToParts(1234567.8)
    out = {
      separator: parts.find((p) => p.type === 'group')?.value ?? ',',
      decimalPoint: parts.find((p) => p.type === 'decimal')?.value ?? '.'
    }
  } catch {
    /* invalid tag → deterministic defaults */
  }
  localeCache.set(key, out)
  return out
}

export function resolveOptions(opts?: NumkeyOptions): Resolved {
  let separator = opts?.separator
  let decimalPoint = opts?.decimalPoint
  if (opts?.locale && (separator === undefined || decimalPoint === undefined)) {
    const derived = localeSeparators(opts.locale)
    separator ??= derived.separator
    decimalPoint ??= derived.decimalPoint
  }
  return {
    decimals: opts?.decimals ?? 0,
    negative: opts?.negative ?? false,
    group: opts?.group ?? 3,
    separator: separator ?? ',',
    decimalPoint: decimalPoint ?? '.',
    locale: opts?.locale ?? ''
  }
}

/** Full-width digits/signs (Korean and Japanese IMEs emit these) → ASCII. */
function normalizeChar(ch: string): string {
  const code = ch.charCodeAt(0)
  if (code >= 0xff10 && code <= 0xff19) {
    return String.fromCharCode(code - 0xff10 + 48)
  }
  if (ch === '．') return '.'
  if (ch === '，') return ','
  if (ch === '－' || ch === '−' || ch === '﹣') return '-'
  return ch
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

/**
 * Display (or any pasted mess) → canonical numeric string.
 *
 * Keeps digits, an optional leading minus (when `negative`), and the first
 * decimal mark (when `decimals > 0`); everything else — separators, letters,
 * currency signs — is dropped. Leading zeros collapse ("007" → "7") but a
 * lone zero and "0.x" survive. The fraction is cut at `decimals` digits.
 * A trailing decimal mark and a lone minus are preserved (transient states).
 */
export function parse(input: string, opts?: NumkeyOptions): string {
  const o = resolveOptions(opts)
  let intPart = ''
  let fracPart = ''
  let seenPoint = false
  let seenAny = false
  let neg = false

  for (const raw of input) {
    const ch = normalizeChar(raw)
    if (isDigit(ch)) {
      seenAny = true
      if (seenPoint) fracPart += ch
      else intPart += ch
    } else if (ch === o.decimalPoint && o.decimals > 0 && !seenPoint) {
      seenAny = true
      seenPoint = true
    } else if (ch === '-' && o.negative && !seenAny && !neg) {
      neg = true
    }
  }

  fracPart = fracPart.slice(0, o.decimals)
  intPart = intPart.replace(/^0+(?=\d)/, '')
  if (intPart === '' && seenPoint) intPart = '0'

  let body = intPart
  if (seenPoint) body += '.' + fracPart
  if (body === '') return neg ? '-' : ''
  return (neg ? '-' : '') + body
}

/** Canonical → display: group separators in, display decimal mark. */
export function format(canonical: string, opts?: NumkeyOptions): string {
  const o = resolveOptions(opts)
  if (canonical === '' || canonical === '-') return canonical

  const neg = canonical.startsWith('-')
  const body = neg ? canonical.slice(1) : canonical
  const pointIdx = body.indexOf('.')
  const intPart = pointIdx === -1 ? body : body.slice(0, pointIdx)
  const fracPart = pointIdx === -1 ? null : body.slice(pointIdx + 1)

  const grouper = new RegExp(`\\B(?=(\\d{${o.group}})+(?!\\d))`, 'g')
  let out = (neg ? '-' : '') + intPart.replace(grouper, o.separator)
  if (fracPart !== null) out += o.decimalPoint + fracPart
  return out
}

/** Settle transient typing states: "1234." → "1234", "-" → "". */
export function finalize(canonical: string): string {
  if (canonical === '-') return ''
  if (canonical.endsWith('.')) return canonical.slice(0, -1)
  return canonical
}

/**
 * Whether a character survives `parse` under the given options — the unit the
 * caret math counts in. Counting significant chars before the old caret and
 * placing the new caret after the same count in the new display is what keeps
 * the cursor stable while separators appear and disappear around it.
 */
function isSignificant(raw: string, o: Resolved): boolean {
  const ch = normalizeChar(raw)
  if (isDigit(ch)) return true
  if (ch === '-') return o.negative
  if (ch === o.decimalPoint) return o.decimals > 0
  return false
}

/** Count significant chars in `text` (typically the slice before the caret). */
export function countSignificant(text: string, opts?: NumkeyOptions): number {
  const o = resolveOptions(opts)
  let n = 0
  for (const ch of text) if (isSignificant(ch, o)) n++
  return n
}

/** Index in `display` just after `count` significant chars. */
export function caretIndex(
  display: string,
  count: number,
  opts?: NumkeyOptions
): number {
  const o = resolveOptions(opts)
  let seen = 0
  let i = 0
  for (; i < display.length && seen < count; i++) {
    if (isSignificant(display[i] as string, o)) seen++
  }
  return i
}
