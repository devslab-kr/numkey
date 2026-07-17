import { describe, expect, it } from 'vitest'
import {
  caretIndex,
  countSignificant,
  finalize,
  format,
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

describe('finalize — settle transient states', () => {
  it('drops a trailing decimal mark and a lone minus', () => {
    expect(finalize('1234.')).toBe('1234')
    expect(finalize('-')).toBe('')
    expect(finalize('1234.5')).toBe('1234.5')
    expect(finalize('')).toBe('')
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
