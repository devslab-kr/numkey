import { describe, expect, it } from 'vitest'
import { toKorean } from './korean'

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
