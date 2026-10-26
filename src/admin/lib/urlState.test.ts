import { describe, expect, it } from 'vitest'
import type { MenuLookup } from '../menu/registry'
import { parseUrlState, toSearch, type UrlState } from './urlState'

const lookup: MenuLookup = {
  defaultMenu: 'overview',
  isMenu: (id) => ['overview', 'users', 'events', 'tech', 'realtime', 'utm'].includes(id),
  usesPeriod: (id) => !['realtime', 'utm'].includes(id),
}

const DEFAULT: UrlState = { menu: 'overview', period: { kind: 'preset', preset: '7d' }, pageParams: {} }

describe('parseUrlState', () => {
  it('defaults on empty, unknown menu or period', () => {
    expect(parseUrlState('', lookup)).toEqual(DEFAULT)
    expect(parseUrlState('?menu=nope&period=5d', lookup)).toEqual(DEFAULT)
  })
  it('keeps a valid menu with default period', () => {
    expect(parseUrlState('?menu=tech', lookup)).toEqual({ ...DEFAULT, menu: 'tech' })
  })
  it('defaults period for malformed or impossible custom dates', () => {
    expect(parseUrlState('?menu=events&start=2026-9-1&end=2026-09-28', lookup).period).toEqual(DEFAULT.period)
    expect(parseUrlState('?start=2026-02-30&end=2026-03-05', lookup).period).toEqual(DEFAULT.period)
    expect(parseUrlState('?start=2026-09-01', lookup).period).toEqual(DEFAULT.period)
  })
  it('round-trips preset and custom', () => {
    const a: UrlState = { menu: 'events', period: { kind: 'preset', preset: '28d' }, pageParams: {} }
    const b: UrlState = { menu: 'users', period: { kind: 'custom', start: '2026-09-01', end: '2026-09-28' }, pageParams: {} }
    expect(parseUrlState(toSearch(a, lookup), lookup)).toEqual(a)
    expect(parseUrlState(toSearch(b, lookup), lookup)).toEqual(b)
  })
})

describe('toSearch', () => {
  it('formats preset and custom', () => {
    expect(toSearch({ menu: 'events', period: { kind: 'preset', preset: '28d' }, pageParams: {} }, lookup)).toBe('?menu=events&period=28d')
    expect(
      toSearch({ menu: 'events', period: { kind: 'custom', start: '2026-09-01', end: '2026-09-28' }, pageParams: {} }, lookup),
    ).toBe('?menu=events&start=2026-09-01&end=2026-09-28')
  })
  it('omits period params for a menu that does not use the period', () => {
    expect(toSearch({ menu: 'utm', period: { kind: 'preset', preset: '28d' }, pageParams: {} }, lookup)).toBe('?menu=utm')
  })
  it('keeps page params after the shell params, in insertion order', () => {
    expect(toSearch({ menu: 'events', period: { kind: 'preset', preset: '7d' }, pageParams: { q: 'a', tab: 'b' } }, lookup)).toBe('?menu=events&period=7d&q=a&tab=b')
  })
})

describe('page params', () => {
  it('parses period params even for a menu that does not use the period', () => {
    expect(parseUrlState('?menu=utm&period=28d', lookup)).toEqual({ menu: 'utm', period: { kind: 'preset', preset: '28d' }, pageParams: {} })
  })
  it('round-trips page param values that need encoding', () => {
    const state: UrlState = { menu: 'utm', period: { kind: 'preset', preset: '7d' }, pageParams: { url: 'https://a.b/c?x=1&y=2', name: '가을 이벤트 #1' } }
    expect(parseUrlState(toSearch(state, lookup), lookup)).toEqual(state)
  })
  it('takes the first value of a repeated page param', () => {
    expect(parseUrlState('?menu=utm&q=1&q=2', lookup).pageParams).toEqual({ q: '1' })
  })
  it('falls back to the default menu for an unknown id', () => {
    expect(parseUrlState('?menu=nope', lookup).menu).toBe('overview')
  })
})
