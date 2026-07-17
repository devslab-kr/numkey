import { describe, expect, it } from 'vitest'
import {
  caretIndex,
  clamp,
  countSignificant,
  finalize,
  format,
  localeSeparators,
  parse
} from './core'

describe('parse — display/paste mess → canonical', () => {
  it('strips separators and garbage', () => {
    expect(parse('1,234,567')).toBe('1234567')
    expect(parse('₩ 1,234원')).toBe('1234')
    expect(parse('abc')).toBe('')
    expect(parse('')).toBe('')
  })

  it('collapses leading zeros but keeps a lone zero', () => {
    expect(parse('007')).toBe('7')
    expect(parse('00')).toBe('0')
    expect(parse('0')).toBe('0')
    expect(parse('0075')).toBe('75')
  })

  it('normalizes full-width digits (Korean/Japanese IME)', () => {
    expect(parse('１２３４')).toBe('1234')
    expect(parse('１,２３４')).toBe('1234')
  })

  it('rejects the decimal mark unless decimals > 0', () => {
    expect(parse('1.5')).toBe('15')
    expect(parse('1.5', { decimals: 1 })).toBe('1.5')
  })

  it('keeps only the first decimal mark and cuts the fraction', () => {
    expect(parse('1.2.3', { decimals: 2 })).toBe('1.23')
    expect(parse('1.23456', { decimals: 2 })).toBe('1.23')
  })

  it('completes bare decimals: ".5" → "0.5", "00.5" → "0.5"', () => {
    expect(parse('.5', { decimals: 2 })).toBe('0.5')
    expect(parse('00.5', { decimals: 2 })).toBe('0.5')
  })

  it('preserves transient typing states', () => {
    expect(parse('1234.', { decimals: 2 })).toBe('1234.')
    expect(parse('-', { negative: true })).toBe('-')
  })

  it('rejects the minus unless negative, and only leading', () => {
    expect(parse('-123')).toBe('123')
    expect(parse('-123', { negative: true })).toBe('-123')
    expect(parse('1-23', { negative: true })).toBe('123')
    expect(parse('USD -5', { negative: true })).toBe('-5')
    expect(parse('−123', { negative: true })).toBe('-123') // U+2212
  })

  it('respects a custom decimal point (European style)', () => {
    expect(parse('1.234.567,89', { decimals: 2, decimalPoint: ',' })).toBe(
      '1234567.89'
    )
  })
})

describe('format — canonical → display', () => {
  it('groups thousands', () => {
    expect(format('1234567')).toBe('1,234,567')
    expect(format('123')).toBe('123')
    expect(format('0')).toBe('0')
    expect(format('')).toBe('')
  })

  it('formats decimals and negatives', () => {
    expect(format('-1234567.89', { decimals: 2, negative: true })).toBe(
      '-1,234,567.89'
    )
    expect(format('-')).toBe('-')
    expect(format('1234.', { decimals: 2 })).toBe('1,234.')
  })

  it('supports custom group size and separators', () => {
    expect(format('12345678', { group: 4 })).toBe('1234,5678')
    expect(
      format('1234567.89', { decimals: 2, separator: '.', decimalPoint: ',' })
    ).toBe('1.234.567,89')
  })

  it('round-trips: format(parse(x)) is stable', () => {
    for (const v of ['1,234,567', '007', '0.50', '-9,999']) {
      const o = { decimals: 2, negative: true }
      const once = format(parse(v, o), o)
      expect(format(parse(once, o), o)).toBe(once)
    }
  })
})

describe('locale — opt-in separator derivation via Intl', () => {
  it('derives separators from a BCP 47 tag', () => {
    expect(localeSeparators('de-DE')).toEqual({
      separator: '.',
      decimalPoint: ','
    })
    expect(localeSeparators('ko-KR')).toEqual({
      separator: ',',
      decimalPoint: '.'
    })
  })

  it('format/parse round-trip under a locale', () => {
    const o = { decimals: 2, locale: 'de-DE' }
    expect(format('1234567.89', o)).toBe('1.234.567,89')
    expect(parse('1.234.567,89', o)).toBe('1234567.89')
  })

  it('explicit separator/decimalPoint win over the locale', () => {
    expect(format('1234567', { locale: 'de-DE', separator: ' ' })).toBe(
      '1 234 567'
    )
  })

  it('falls back to deterministic defaults on an invalid tag', () => {
    expect(localeSeparators('no-such-locale-tag-!!!')).toEqual({
      separator: ',',
      decimalPoint: '.'
    })
  })

  it('without locale the display never depends on the environment', () => {
    expect(format('1234567.5', { decimals: 1 })).toBe('1,234,567.5')
  })
})

describe('finalize — settle transient states', () => {
  it('drops a trailing decimal mark and a lone minus', () => {
    expect(finalize('1234.')).toBe('1234')
    expect(finalize('-')).toBe('')
    expect(finalize('1234.5')).toBe('1234.5')
    expect(finalize('')).toBe('')
  })
})

describe('clamp — min/max on settled values', () => {
  it('clamps to the bounds and returns them canonically', () => {
    expect(clamp('5', { min: 10 })).toBe('10')
    expect(clamp('500', { max: 100 })).toBe('100')
    expect(clamp('50', { min: 10, max: 100 })).toBe('50')
    expect(clamp('-5', { negative: true, min: 0 })).toBe('0')
  })

  it('accepts string bounds and decimal values', () => {
    expect(clamp('99.99', { decimals: 2, max: '50.5' })).toBe('50.5')
  })

  it('passes transient and empty states through untouched', () => {
    expect(clamp('', { min: 10 })).toBe('')
    expect(clamp('-', { negative: true, min: 10 })).toBe('-')
    expect(clamp('123.', { decimals: 2, min: 500 })).toBe('123.')
  })

  it('without bounds it is the identity', () => {
    expect(clamp('123456789')).toBe('123456789')
  })
})

describe('caret math', () => {
  it('counts only chars that survive parse', () => {
    expect(countSignificant('1,234')).toBe(4)
    expect(countSignificant('1.2', { decimals: 2 })).toBe(3)
    expect(countSignificant('1.2')).toBe(2) // point not significant for integers
    expect(countSignificant('-1', { negative: true })).toBe(2)
    expect(countSignificant('-1')).toBe(1) // minus not significant
  })

  it('places the caret after N significant chars', () => {
    expect(caretIndex('1,234', 4)).toBe(5) // end
    expect(caretIndex('1,234,567', 4)).toBe(5) // "1,234|,567"
    expect(caretIndex('1,234', 1)).toBe(1) // "1|,234"
    expect(caretIndex('1,234', 0)).toBe(0)
    expect(caretIndex('123', 99)).toBe(3) // clamps to end
  })
})
