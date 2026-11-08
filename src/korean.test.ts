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

describe('toKorean — style: "hangul" (spoken reading, leading 일 dropped)', () => {
  it('reads every digit and position in Hangul', () => {
    expect(toKorean('1500000', { style: 'hangul' })).toBe('백오십만')
    expect(toKorean('927483041001', { style: 'hangul' })).toBe(
      '구천이백칠십사억 팔천삼백사만 천일'
    )
    expect(toKorean('123456789', { style: 'hangul' })).toBe('일억 이천삼백사십오만 육천칠백팔십구')
  })

  it('drops 일 before 십/백/천 and before a bare 만, keeps it before 억 and above', () => {
    expect(toKorean('1234', { style: 'hangul' })).toBe('천이백삼십사')
    expect(toKorean('10000', { style: 'hangul' })).toBe('만')
    expect(toKorean('15000', { style: 'hangul' })).toBe('만 오천')
    expect(toKorean('100000000', { style: 'hangul' })).toBe('일억')
    expect(toKorean('1000000000000', { style: 'hangul' })).toBe('일조')
    expect(toKorean('110000', { style: 'hangul' })).toBe('십일만')
  })

  it('handles single digits, zero, sign, fraction, and zero groups', () => {
    expect(toKorean('1', { style: 'hangul' })).toBe('일')
    expect(toKorean('0', { style: 'hangul' })).toBe('영')
    expect(toKorean('', { style: 'hangul' })).toBe('')
    expect(toKorean('-15000', { style: 'hangul' })).toBe('-만 오천')
    expect(toKorean('1500000.75', { style: 'hangul' })).toBe('백오십만')
    expect(toKorean('100000001', { style: 'hangul' })).toBe('일억 일')
  })

  it('spacing: false joins the groups', () => {
    expect(toKorean('1505000', { style: 'hangul', spacing: false })).toBe('백오십만오천')
  })

  it('round-trips through fromKorean', () => {
    for (const v of ['1500000', '927483041001', '15000', '110000', '100000001']) {
      expect(fromKorean(toKorean(v, { style: 'hangul' }))).toBe(v)
    }
  })
})

describe('toKorean — style: "formal" (contracts/receipts, every 일 written, no spaces)', () => {
  it('writes 일 at every position so nothing can be inserted', () => {
    expect(toKorean('1500000', { style: 'formal' })).toBe('일백오십만')
    expect(toKorean('15000', { style: 'formal' })).toBe('일만오천')
    expect(toKorean('1234', { style: 'formal' })).toBe('일천이백삼십사')
    expect(toKorean('110000', { style: 'formal' })).toBe('일십일만')
    expect(toKorean('100000001', { style: 'formal' })).toBe('일억일')
    expect(toKorean('927483041001', { style: 'formal' })).toBe(
      '구천이백칠십사억팔천삼백사만일천일'
    )
  })

  it('spacing: true opts back into group spacing', () => {
    expect(toKorean('15000', { style: 'formal', spacing: true })).toBe('일만 오천')
  })

  it('handles zero and sign', () => {
    expect(toKorean('0', { style: 'formal' })).toBe('영')
    expect(toKorean('-1500000', { style: 'formal' })).toBe('-일백오십만')
  })

  it('round-trips through fromKorean', () => {
    for (const v of ['1500000', '927483041001', '15000', '110000']) {
      expect(fromKorean(toKorean(v, { style: 'formal' }))).toBe(v)
    }
  })
})

describe('toKorean — style: "hanja" (갖은자 anti-forgery numerals)', () => {
  it('uses 갖은자 for digits and positions, every 壹 written, no spaces', () => {
    expect(toKorean('1500000', { style: 'hanja' })).toBe('壹佰伍拾萬')
    expect(toKorean('15000', { style: 'hanja' })).toBe('壹萬伍仟')
    expect(toKorean('1234', { style: 'hanja' })).toBe('壹仟貳佰參拾肆')
    expect(toKorean('927483041001', { style: 'hanja' })).toBe(
      '玖仟貳佰柒拾肆億捌仟參佰肆萬壹仟壹'
    )
    expect(toKorean('6780', { style: 'hanja' })).toBe('陸仟柒佰捌拾')
  })

  it('handles zero, sign, and spacing opt-in', () => {
    expect(toKorean('0', { style: 'hanja' })).toBe('零')
    expect(toKorean('-10000', { style: 'hanja' })).toBe('-壹萬')
    expect(toKorean('15000', { style: 'hanja', spacing: true })).toBe('壹萬 伍仟')
  })
})

describe('toKorean — style fallbacks', () => {
  it('"mixed" and an unknown style both give the existing reading', () => {
    expect(toKorean('1500000', { style: 'mixed' })).toBe('150만')
    // @ts-expect-error — unknown styles fall back rather than throw (DOM attr typos)
    expect(toKorean('1500000', { style: 'nope' })).toBe('150만')
  })

  it('falls back to plain grouping beyond the known units in every style', () => {
    const huge = '1' + '0'.repeat(32) // 10^32 — past 양
    expect(toKorean(huge, { style: 'hangul' })).toBe(toKorean(huge))
  })
})
