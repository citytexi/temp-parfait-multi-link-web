import { describe, expect, it } from 'vitest'
import {
  buildStreamRequest, diffSnapshots, filterOptions, mergeHighlights, parseStream, parseWatch, toLines, toggleWatch,
} from './report'
import stream from './__fixtures__/stream.json'
import empty from './__fixtures__/stream-empty.json'
import { withExtra } from './__fixtures__/withExtra'

const ALL = { platform: null, version: null }

describe('event stream report', () => {
  it('builds the request', () => {
    expect(buildStreamRequest()).toEqual({
      dimensions: [{ name: 'eventName' }, { name: 'minutesAgo' }, { name: 'platform' }, { name: 'appVersion' }],
      metrics: [{ name: 'eventCount' }],
      minuteRanges: [{ startMinutesAgo: 29, endMinutesAgo: 0 }],
      orderBys: [{ dimension: { dimensionName: 'minutesAgo', orderType: 'NUMERIC' } }],
      limit: 250000,
    })
  })
  it('parses rows, merges empty and (not set), and reads quota', () => {
    const s = parseStream(stream, 1000)
    expect(s.fetchedAt).toBe(1000)
    expect(s.truncated).toBe(false)
    expect(s.quota?.tokensPerHour?.remaining).toBe(39000)
    expect(s.rows.filter((r) => r.event === 'session_start').map((r) => r.version)).toEqual(['(not set)', '(not set)'])
  })
  it('survives a response without rows, rowCount or quota', () => {
    expect(parseStream(empty, 5)).toEqual({ rows: [], truncated: false, fetchedAt: 5, quota: null })
  })
  it('flags truncation when rowCount exceeds the rows received', () => {
    expect(parseStream({ ...stream, rowCount: 999 }, 0).truncated).toBe(true)
  })
  it('lists filter options and keeps a selected value that is absent', () => {
    const s = parseStream(stream, 0)
    expect(filterOptions(s, ALL)).toEqual({ platforms: ['Android', 'iOS'], versions: ['(not set)', '1.4.0', '1.5.0'] })
    expect(filterOptions(s, { platform: 'web', version: '9.9' }).platforms).toContain('web')
    expect(filterOptions(s, { platform: 'web', version: '9.9' }).versions).toContain('9.9')
  })
  it('sums now, last 5 minutes, 30 minutes and fills 30 buckets oldest first', () => {
    const [first] = toLines(parseStream(stream, 0), ALL, '', [])
    expect(first).toMatchObject({ name: 'screen_view', label: '화면 조회', inCatalog: true, now: 3, last5: 9, total: 14 })
    expect(first.perMinute).toHaveLength(30)
    expect(first.perMinute[29]).toBe(3)
    expect(first.perMinute[28]).toBe(2)
    expect(first.perMinute[19]).toBe(5)
  })
  it('applies platform and version filters to the sums', () => {
    const lines = toLines(parseStream(stream, 0), { platform: 'iOS', version: null }, '', [])
    expect(lines.map((l) => [l.name, l.total])).toEqual([['screen_view', 2], ['session_start', 1]])
  })
  it('sorts watched first, then by 30-minute total, then by name', () => {
    const names = toLines(parseStream(stream, 0), ALL, '', ['purchase_done']).map((l) => l.name)
    expect(names).toEqual(['purchase_done', 'screen_view', 'session_start'])
  })
  it('searches name and label literally and case-insensitively', () => {
    const s = parseStream(stream, 0)
    expect(toLines(s, ALL, 'PURCHASE', []).map((l) => l.name)).toEqual(['purchase_done'])
    expect(toLines(s, ALL, '화면', []).map((l) => l.name)).toEqual(['screen_view'])
    expect(() => toLines(s, ALL, '([\\.', [])).not.toThrow()
    expect(toLines(s, ALL, '([\\.', [])).toEqual([])
  })
  it('keeps watched events regardless of the search and adds a zero row when absent', () => {
    const lines = toLines(parseStream(stream, 0), ALL, 'purchase', ['screen_view', 'not_yet'])
    expect(lines.map((l) => l.name)).toEqual(['screen_view', 'not_yet', 'purchase_done'])
    expect(lines[1]).toMatchObject({ watched: true, inCatalog: false, label: 'not_yet', now: 0, last5: 0, total: 0 })
    expect(lines[1].perMinute).toEqual(Array(30).fill(0))
  })
  it('orders watched events by total, not by the order in the URL', () => {
    const names = toLines(parseStream(stream, 0), ALL, '', ['not_yet', 'screen_view']).map((l) => l.name)
    expect(names.slice(0, 2)).toEqual(['screen_view', 'not_yet'])
  })
  it('marks catalogue membership', () => {
    const lines = toLines(parseStream(stream, 0), ALL, '', [])
    expect(lines.find((l) => l.name === 'purchase_done')).toMatchObject({ inCatalog: false, label: 'purchase_done' })
    expect(lines.find((l) => l.name === 'session_start')).toMatchObject({ inCatalog: true, label: '앱 실행' })
  })
  it('diffs against the previous snapshot under the current filter', () => {
    const prev = parseStream(stream, 0)
    const next = parseStream(withExtra(stream, [['screen_view', 0, 'iOS', '1.4.0', 2], ['new_event', 0, 'Android', '1.5.0', 1]]), 5000)
    const all = diffSnapshots(prev, next, ALL)
    expect(all.get('screen_view')).toEqual({ kind: 'up', delta: 2 })
    expect(all.get('new_event')).toEqual({ kind: 'new', delta: 1 })
    expect(all.has('purchase_done')).toBe(false)
    expect(diffSnapshots(prev, next, { platform: 'Android', version: null }).has('screen_view')).toBe(false)
  })
  it('reports nothing without a baseline or with a stale one', () => {
    const next = parseStream(stream, 100_000)
    expect(diffSnapshots(null, next, ALL).size).toBe(0)
    expect(diffSnapshots(parseStream(empty, 9_999), next, ALL).size).toBe(0)
    expect(diffSnapshots(parseStream(empty, 10_000), next, ALL).size).toBe(3)
  })
  it('keeps highlights for 60 seconds and accumulates repeats', () => {
    let h = mergeHighlights(new Map(), new Map([['a', { kind: 'new' as const, delta: 1 }]]), 1000)
    h = mergeHighlights(h, new Map([['a', { kind: 'up' as const, delta: 2 }]]), 31_000)
    expect(h.get('a')).toEqual({ kind: 'new', delta: 3, at: 31_000 })
    expect(mergeHighlights(h, new Map(), 90_999).has('a')).toBe(true)
    expect(mergeHighlights(h, new Map(), 91_000).has('a')).toBe(false)
  })
  it('parses and toggles the watch param', () => {
    expect(parseWatch(null)).toEqual([])
    expect(parseWatch(',a,,a, b')).toEqual(['a', 'b'])
    expect(toggleWatch(['a', 'b'], 'a')).toBe('b')
    expect(toggleWatch(['a'], 'c')).toBe('a,c')
    expect(toggleWatch(['a'], 'a')).toBeNull()
  })
})
