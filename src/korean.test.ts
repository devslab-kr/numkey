import { describe, expect, it } from 'vitest'
import { fromKorean, toKorean } from './korean'

describe('toKorean — mixed digits-plus-units reading', () => {
  it('reads 만-scale amounts the way banking UIs show them', () => {
    expect(toKorean('1500000')).toBe('150만')
    expect(toKorean('15000')).toBe('1만 5,000')
    expect(toKorean('50000000')).toBe('5,000만')
    expect(toKorean('100000000')).toBe('1억')
  })

  it('handles multi-unit values with per-group comma grouping', () => {
    expect(toKorean('927483041001')).toBe('9,274억 8,304만 1,001')
    expect(toKorean('123456789')).toBe('1억 2,345만 6,789')
  })

  it('omits zero groups entirely', () => {
    expect(toKorean('100000001')).toBe('1억 1')
    expect(toKorean('1000050000')).toBe('10억 5만')
  })

  it('below 만 there is no unit — plain comma grouping', () => {
    expect(toKorean('1234')).toBe('1,234')
    expect(toKorean('7')).toBe('7')
  })

  it('handles zero, empty, and transient states', () => {
    expect(toKorean('0')).toBe('0')
    expect(toKorean('')).toBe('')
    expect(toKorean('-')).toBe('') // finalize settles the lone minus
    expect(toKorean('1234.')).toBe('1,234')
  })

  it('keeps the sign and ignores the fraction', () => {
    expect(toKorean('-15000')).toBe('-1만 5,000')
    expect(toKorean('1500000.75')).toBe('150만')
  })

  it('spacing: false joins the groups', () => {
    expect(toKorean('1505000', { spacing: false })).toBe('150만5,000')
  })

  it('supports 조 and 경', () => {
    expect(toKorean('1000000000000')).toBe('1조')
    expect(toKorean('10000000000000000')).toBe('1경')
  })
})

describe('fromKorean — shorthand entry → canonical', () => {
  it('parses digits-plus-units shorthand', () => {
    expect(fromKorean('3만5천')).toBe('35000')
    expect(fromKorean('5천')).toBe('5000')
    expect(fromKorean('3백5십')).toBe('350')
    expect(fromKorean('1조2억')).toBe('1000200000000')
  })

  it('parses decimal units the way 부동산/주식 apps use them', () => {
    expect(fromKorean('1.5억')).toBe('150000000')
    expect(fromKorean('0.5만')).toBe('5000')
    expect(fromKorean('2.35억')).toBe('235000000')
  })

  it('parses full Hangul digits', () => {
    expect(fromKorean('삼만오천')).toBe('35000')
    expect(fromKorean('삼십오만')).toBe('350000')
    expect(fromKorean('천오백')).toBe('1500')
  })

  it('a bare unit means 1', () => {
    expect(fromKorean('만')).toBe('10000')
    expect(fromKorean('억')).toBe('100000000')
    expect(fromKorean('천')).toBe('1000')
  })

  it('round-trips toKorean output', () => {
    for (const v of ['35000', '927483041001', '100000001', '1000050000']) {
      expect(fromKorean(toKorean(v))).toBe(v)
    }
  })

  it('ignores commas, spaces, and 원; plain numbers pass through', () => {
    expect(fromKorean('9,274억 8,304만 1,001')).toBe('927483041001')
    expect(fromKorean('3만 5천 원')).toBe('35000')
    expect(fromKorean('12,345')).toBe('12345')
  })

  it('keeps the sign and handles empty/zero', () => {
    expect(fromKorean('-3만')).toBe('-30000')
    expect(fromKorean('−1.5억')).toBe('-150000000') // U+2212
    expect(fromKorean('')).toBe('')
    expect(fromKorean('0만')).toBe('0')
    expect(fromKorean('영')).toBe('0')
  })

  it('normalizes full-width digits', () => {
    expect(fromKorean('３만５천')).toBe('35000')
  })
})
