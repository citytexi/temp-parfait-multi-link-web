import { describe, expect, it } from 'vitest'
import { parseUrlState, toSearch, type UrlState } from './urlState'

const DEFAULT: UrlState = { menu: 'overview', period: { kind: 'preset', preset: '7d' } }

describe('parseUrlState', () => {
  it('defaults on empty, unknown menu or period', () => {
    expect(parseUrlState('')).toEqual(DEFAULT)
    expect(parseUrlState('?menu=nope&period=5d')).toEqual(DEFAULT)
  })
  it('keeps a valid menu with default period', () => {
    expect(parseUrlState('?menu=tech')).toEqual({ ...DEFAULT, menu: 'tech' })
  })
  it('defaults period for malformed or impossible custom dates', () => {
    expect(parseUrlState('?menu=events&start=2026-9-1&end=2026-09-28').period).toEqual(DEFAULT.period)
    expect(parseUrlState('?start=2026-02-30&end=2026-03-05').period).toEqual(DEFAULT.period)
    expect(parseUrlState('?start=2026-09-01').period).toEqual(DEFAULT.period)
  })
  it('round-trips preset and custom', () => {
    const a: UrlState = { menu: 'events', period: { kind: 'preset', preset: '28d' } }
    const b: UrlState = { menu: 'users', period: { kind: 'custom', start: '2026-09-01', end: '2026-09-28' } }
    expect(parseUrlState(toSearch(a))).toEqual(a)
    expect(parseUrlState(toSearch(b))).toEqual(b)
  })
})

describe('toSearch', () => {
  it('formats preset and custom', () => {
    expect(toSearch({ menu: 'events', period: { kind: 'preset', preset: '28d' } })).toBe('?menu=events&period=28d')
    expect(
      toSearch({ menu: 'events', period: { kind: 'custom', start: '2026-09-01', end: '2026-09-28' } }),
    ).toBe('?menu=events&start=2026-09-01&end=2026-09-28')
  })
})
