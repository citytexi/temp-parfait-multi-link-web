import { describe, expect, it } from 'vitest'
import { computeDelta, formatDuration, formatNumber } from './format'

describe('formatNumber', () => {
  it('adds thousands separators', () => {
    expect(formatNumber(1234)).toBe('1,234')
    expect(formatNumber(0)).toBe('0')
  })
})

describe('formatDuration', () => {
  it.each([
    [0, '0초'],
    [45, '45초'],
    [59.9, '59초'],
    [120, '2분'],
    [192, '3분 12초'],
    [3600, '1시간'],
    [3725, '1시간 2분'],
    [-5, '0초'],
    [NaN, '0초'],
  ])('%s -> %s', (sec, expected) => {
    expect(formatDuration(sec)).toBe(expected)
  })
})

describe('computeDelta', () => {
  it('returns none when previous is 0', () => {
    expect(computeDelta(0, 0)).toEqual({ ratio: null, text: '비교 불가', tone: 'none' })
    expect(computeDelta(5, 0)).toEqual({ ratio: null, text: '비교 불가', tone: 'none' })
  })
  it('returns flat when equal', () => {
    expect(computeDelta(100, 100)).toEqual({ ratio: 0, text: '변화 없음', tone: 'flat' })
  })
  it('returns up', () => {
    const d = computeDelta(112, 100)
    expect(d.text).toBe('▲ 12%')
    expect(d.tone).toBe('up')
    expect(d.ratio).toBeCloseTo(0.12)
  })
  it('returns down', () => {
    const d = computeDelta(97, 100)
    expect(d.text).toBe('▼ 3%')
    expect(d.tone).toBe('down')
  })
  it('treats rounded-zero change as flat but keeps ratio', () => {
    const d = computeDelta(1001, 1000)
    expect(d.text).toBe('변화 없음')
    expect(d.tone).toBe('flat')
    expect(d.ratio).toBeCloseTo(0.001)
  })
})
