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
  /**
   * Digits per group in the integer part. Default 3 (use 4 for 만-style
   * grouping). A `[primary, secondary]` pair groups the last `primary`
   * digits and every `secondary` digits above them — the Indian system is
   * `[3, 2]` (`12,34,567` — lakh and crore). 0 turns grouping off.
   */
  group?: number | [number, number]
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
  /**
   * DOM layer only: accept Korean-shorthand entry ("3만5천"). While the
   * value contains Korean number characters the field is left alone (no
   * live reformat — that would fight the IME), and blur converts it via
   * `fromKorean` ("3만5천" → "35,000"). Default false.
   */
  koreanEntry?: boolean
  /**
   * Lower/upper bounds, applied on blur only — clamping mid-keystroke is
   * hostile (you cannot type 50 in a min-10 field if 5 gets rejected).
   * Compared numerically; exact through the IEEE 754 safe-integer range.
   */
  min?: string | number
  max?: string | number
}

type Resolved = Required<NumkeyOptions>

export interface LocaleFormat {
  separator: string
  decimalPoint: string
  /** `[primary, secondary]` group sizes — `[3, 3]` in most locales, `[3, 2]` in India. */
  group: [number, number]
}

const localeCache = new Map<string, LocaleFormat>()

/**
 * Read the group sizes out of a formatted sample: the last group is the
 * primary size and the one above it the secondary, which is how CLDR models
 * grouping ("1,23,45,678" → `[3, 2]`).
 */
function groupSizesFromParts(
  parts: Intl.NumberFormatPart[]
): [number, number] {
  const runs = parts.filter((p) => p.type === 'integer').map((p) => p.value.length)
  if (runs.length < 2) return [3, 3]
  const primary = runs[runs.length - 1] as number
  const secondary = runs[runs.length - 2] as number
  return [primary, secondary]
}

/**
 * The group separator, decimal mark and group sizes a locale uses
 * ("de-DE" → `.` / `,` / `[3,3]`, "en-IN" → `,` / `.` / `[3,2]`).
 * "auto" (or empty) resolves the browser language; unknown tags and non-Intl
 * environments fall back to `,` / `.` / `[3,3]`.
 */
export function localeSeparators(locale?: string): LocaleFormat {
  const tag =
    !locale || locale === 'auto'
      ? typeof navigator !== 'undefined'
        ? navigator.language
        : undefined
      : locale
  const key = tag ?? ''
  const cached = localeCache.get(key)
  if (cached) return cached

  let out: LocaleFormat = { separator: ',', decimalPoint: '.', group: [3, 3] }
  try {
    const parts = new Intl.NumberFormat(tag).formatToParts(1234567.8)
    out = {
      separator: parts.find((p) => p.type === 'group')?.value ?? ',',
      decimalPoint: parts.find((p) => p.type === 'decimal')?.value ?? '.',
      // 1234567.8 has enough integer groups to expose both sizes
      group: groupSizesFromParts(parts)
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
  let group = opts?.group
  if (
    opts?.locale &&
    (separator === undefined || decimalPoint === undefined || group === undefined)
  ) {
    const derived = localeSeparators(opts.locale)
    separator ??= derived.separator
    decimalPoint ??= derived.decimalPoint
    group ??= derived.group
  }
  return {
    decimals: opts?.decimals ?? 0,
    negative: opts?.negative ?? false,
    group: group ?? 3,
    separator: separator ?? ',',
    decimalPoint: decimalPoint ?? '.',
    locale: opts?.locale ?? '',
    koreanEntry: opts?.koreanEntry ?? false,
    min: opts?.min ?? '',
    max: opts?.max ?? ''
  }
}

/**
 * Clamp a settled canonical value to `min`/`max`. Transient states and
 * empty values pass through untouched; bounds are returned in canonical
 * form (`clamp('5', { min: 10 })` → `"10"`).
 */
export function clamp(canonical: string, opts?: NumkeyOptions): string {
  if (canonical === '' || canonical === '-' || canonical.endsWith('.')) {
    return canonical
  }
  const o = resolveOptions(opts)
  const n = Number(canonical)
  if (Number.isNaN(n)) return canonical
  if (o.min !== '' && n < Number(o.min)) return String(Number(o.min))
  if (o.max !== '' && n > Number(o.max)) return String(Number(o.max))
  return canonical
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
  if (ch === '（') return '('
  if (ch === '）') return ')'
  return ch
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

/**
 * Accounting notation writes negatives in parentheses — "(1,234)" is -1234 —
 * which is what Excel's accounting format and most ERP exports produce. The
 * parens must actually enclose digits, so a stray bracket in pasted text
 * ("(주)한국 1234") does not flip the sign; currency signs may sit outside
 * them ("₩(1,234)", "(1,234)원").
 */
function isAccountingNegative(normalized: string): boolean {
  const open = normalized.indexOf('(')
  if (open === -1) return false
  const close = normalized.lastIndexOf(')')
  if (close < open) return false
  return /\d/.test(normalized.slice(open + 1, close))
}

/**
 * Display (or any pasted mess) → canonical numeric string.
 *
 * Keeps digits, an optional leading minus (when `negative`), and the first
 * decimal mark (when `decimals > 0`); everything else — separators, letters,
 * currency signs — is dropped. Leading zeros collapse ("007" → "7") but a
 * lone zero and "0.x" survive. The fraction is cut at `decimals` digits.
 * A trailing decimal mark and a lone minus are preserved (transient states).
 *
 * Parenthesised input is read as an accounting negative when `negative` is
 * on ("(1,234)" → "-1234"); a minus alongside the parens does not negate
 * twice.
 */
export function parse(input: string, opts?: NumkeyOptions): string {
  const o = resolveOptions(opts)
  let text = ''
  for (const raw of input) text += normalizeChar(raw)

  let intPart = ''
  let fracPart = ''
  let seenPoint = false
  let seenAny = false
  let neg = o.negative && isAccountingNegative(text)

  for (const ch of text) {
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

/** `group` as a `[primary, secondary]` pair — a plain number means both. */
export function groupSizes(
  group: number | [number, number]
): [number, number] {
  if (typeof group === 'number') return [group, group]
  const primary = group[0]
  const secondary = group[1]
  return [primary, secondary > 0 ? secondary : primary]
}

/**
 * Insert separators right-to-left: the last `primary` digits form one group
 * and everything above them is cut every `secondary` digits. With equal
 * sizes this is ordinary thousands grouping; `[3, 2]` gives the Indian
 * lakh/crore system (`12,34,567`).
 */
function groupInteger(
  intPart: string,
  group: number | [number, number],
  separator: string
): string {
  const [primary, secondary] = groupSizes(group)
  if (primary <= 0 || intPart.length <= primary) return intPart

  const head = intPart.slice(0, intPart.length - primary)
  const tail = intPart.slice(intPart.length - primary)
  const parts: string[] = []
  let i = head.length
  while (i > secondary) {
    parts.unshift(head.slice(i - secondary, i))
    i -= secondary
  }
  parts.unshift(head.slice(0, i))
  return parts.join(separator) + separator + tail
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

  let out = (neg ? '-' : '') + groupInteger(intPart, o.group, o.separator)
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
