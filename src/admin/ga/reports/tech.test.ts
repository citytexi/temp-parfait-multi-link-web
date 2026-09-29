import { describe, expect, it } from 'vitest'
import { buildTechRequests, parseTech } from './tech'
import platform from './__fixtures__/tech-platform.json'
import country from './__fixtures__/tech-country.json'
import appVersion from './__fixtures__/tech-appversion.json'

const r = { current: { startDate: '2026-09-15', endDate: '2026-09-21' } }

describe('tech', () => {
  it('builds requests', () => {
    const [a, b, c] = buildTechRequests(r)
    for (const [req, dim, limit] of [[a, 'platform', undefined], [b, 'country', 10], [c, 'appVersion', 10]] as const) {
      expect(req.dimensions).toEqual([{ name: dim }])
      expect(req.metrics).toEqual([{ name: 'activeUsers' }])
      expect(req.dateRanges).toEqual([r.current])
      expect(req.orderBys).toEqual([{ metric: { metricName: 'activeUsers' }, desc: true }])
      expect(req.limit).toBe(limit)
      expect(req.metricAggregations).toEqual(['TOTAL'])
    }
  })
  it('parses shares with display labels and ratios summing to 1', () => {
    const m = parseTech([platform, country, appVersion])
    expect(m.platforms.map((s) => s.label)).toEqual(['Android', 'iOS', 'web'])
    expect(m.platforms[0]).toEqual({ label: 'Android', users: 600, ratio: 0.6 })
    expect(m.countries.map((s) => s.label)).toEqual(['South Korea', '알 수 없음', '기타'])
    expect(m.appVersions[2].label).toBe('알 수 없음')
    for (const list of [m.platforms, m.countries, m.appVersions]) {
      expect(list.reduce((s, x) => s + x.ratio, 0)).toBeCloseTo(1)
    }
  })
  it('uses GA totals as denominator when top rows are truncated', () => {
    const withTotals = { ...country, totals: [{ metricValues: [{ value: '1000' }] }] }
    const trimmed = { ...withTotals, rows: withTotals.rows.slice(0, 2) }
    const m = parseTech([platform, trimmed, appVersion])
    expect(m.countries[0].ratio).toBeCloseTo(0.7)
    expect(m.countries.reduce((s, x) => s + x.ratio, 0)).toBeCloseTo(0.9)
    expect(m.platforms.reduce((s, x) => s + x.ratio, 0)).toBeCloseTo(1)
  })
  it('handles empty', () => {
    expect(parseTech([{}, {}, {}])).toEqual({ platforms: [], countries: [], appVersions: [] })
    expect(parseTech([])).toEqual({ platforms: [], countries: [], appVersions: [] })
  })
})
