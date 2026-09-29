import { describe, expect, it } from 'vitest'
import { periodLabel, resolveRanges, seoulToday, validatePeriod, type Period } from './period'

const p7: Period = { kind: 'preset', preset: '7d' }
const custom = (start: string, end: string): Period => ({ kind: 'custom', start, end })

describe('seoulToday', () => {
  it('uses Asia/Seoul date', () => {
    expect(seoulToday(new Date('2026-09-28T16:30:00Z'))).toBe('2026-09-29')
    expect(seoulToday(new Date('2026-09-28T14:59:00Z'))).toBe('2026-09-28')
  })
})

describe('resolveRanges', () => {
  it('resolves 7d preset', () => {
    expect(resolveRanges(p7, '2026-09-29')).toEqual({
      current: { startDate: '2026-09-22', endDate: '2026-09-28' },
      previous: { startDate: '2026-09-15', endDate: '2026-09-21' },
      days: 7,
    })
  })
  it('crosses month boundary', () => {
    expect(resolveRanges(p7, '2026-03-01').current).toEqual({
      startDate: '2026-02-22',
      endDate: '2026-02-28',
    })
  })
  it('resolves 28d and 90d', () => {
    expect(resolveRanges({ kind: 'preset', preset: '28d' }, '2026-09-29').days).toBe(28)
    const r = resolveRanges({ kind: 'preset', preset: '90d' }, '2026-09-29')
    expect(r.days).toBe(90)
    expect(r.current.endDate).toBe('2026-09-28')
  })
  it('resolves custom with previous of same length', () => {
    expect(resolveRanges(custom('2026-09-01', '2026-09-10'), '2026-09-29')).toEqual({
      current: { startDate: '2026-09-01', endDate: '2026-09-10' },
      previous: { startDate: '2026-08-22', endDate: '2026-08-31' },
      days: 10,
    })
  })
})

describe('validatePeriod', () => {
  const today = '2026-09-29'
  it('accepts presets and valid custom', () => {
    expect(validatePeriod(p7, today)).toBeNull()
    expect(validatePeriod(custom('2026-09-01', '2026-09-28'), today)).toBeNull()
  })
  it('rejects start after end', () => {
    expect(validatePeriod(custom('2026-09-10', '2026-09-01'), today)).toBe('시작일이 종료일보다 늦어요')
  })
  it('rejects end today or later', () => {
    expect(validatePeriod(custom('2026-09-01', today), today)).toBe('종료일은 어제까지 고를 수 있어요')
    expect(validatePeriod(custom('2026-09-01', '2026-10-01'), today)).toBe('종료일은 어제까지 고를 수 있어요')
  })
  it('rejects more than 366 days', () => {
    expect(validatePeriod(custom('2025-09-28', '2026-09-28'), today)).toBeNull() // 366 days
    expect(validatePeriod(custom('2025-09-27', '2026-09-28'), today)).toBe('최대 366일까지 볼 수 있어요')
  })
})

describe('periodLabel', () => {
  it('labels presets and custom', () => {
    expect(periodLabel(p7)).toBe('최근 7일')
    expect(periodLabel({ kind: 'preset', preset: '28d' })).toBe('최근 28일')
    expect(periodLabel({ kind: 'preset', preset: '90d' })).toBe('최근 90일')
    expect(periodLabel(custom('2026-09-01', '2026-09-28'))).toBe('2026.09.01 ~ 2026.09.28')
  })
})
