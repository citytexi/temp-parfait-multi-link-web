import { describe, expect, it } from 'vitest'
import { buildOverviewRequests, buildSummary, parseOverview } from './overview'
import { compared } from './common'
import totals from './__fixtures__/overview-totals.json'
import trend from './__fixtures__/overview-trend.json'
import platformTrend from './__fixtures__/overview-platform-trend.json'
import screens from './__fixtures__/screens.json'
import { buildScreensRequest } from './screens'

const r = {
  current: { startDate: '2026-09-15', endDate: '2026-09-21' },
  previous: { startDate: '2026-09-08', endDate: '2026-09-14' },
}

describe('overview', () => {
  it('builds requests', () => {
    const [a, b] = buildOverviewRequests(r)
    expect(a.dateRanges).toEqual([r.current, r.previous])
    expect(a.metrics).toEqual([{ name: 'activeUsers' }, { name: 'newUsers' }, { name: 'userEngagementDuration' }])
    expect(a.dimensions).toBeUndefined()
    expect(b.dateRanges).toEqual([r.current])
    expect(b.dimensions).toEqual([{ name: 'date' }])
    expect(b.metrics).toEqual([{ name: 'activeUsers' }])
    expect(b.orderBys).toEqual([{ dimension: { dimensionName: 'date' }, desc: false }])
    expect(b.keepEmptyRows).toBe(true)
    expect(a.keepEmptyRows).toBeUndefined()
  })
  it('appends the platform trend and screens requests to the same batch', () => {
    const requests = buildOverviewRequests(r)
    expect(requests).toHaveLength(4)
    const [, , c, d] = requests
    expect(c).toEqual({
      dateRanges: [r.current],
      dimensions: [{ name: 'date' }, { name: 'platform' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
      keepEmptyRows: true,
    })
    expect(d).toEqual(buildScreensRequest(r))
  })
  it('merges Android and iOS into the trend by date', () => {
    const m = parseOverview([totals, trend, platformTrend, screens])
    expect(m.trend).toEqual([
      { date: '20260920', activeUsers: 150, android: 90, ios: 50 },
      { date: '20260921', activeUsers: 170, android: 170, ios: 0 },
    ])
    expect(m.screens.items[0].name).toBe('home')
    expect(m.screens.total).toBe(20000)
  })
  it('falls back to platform dates when the total trend is empty', () => {
    const m = parseOverview([totals, {}, platformTrend])
    expect(m.trend).toEqual([
      { date: '20260920', activeUsers: 0, android: 90, ios: 50 },
      { date: '20260921', activeUsers: 0, android: 170, ios: 0 },
    ])
  })
  it('parses totals, avg engagement and trend', () => {
    const m = parseOverview([totals, trend])
    expect(m.users).toMatchObject({ current: 1120, previous: 1000 })
    expect(m.users.delta.text).toBe('▲ 12%')
    expect(m.newUsers.delta.text).toBe('▼ 6%')
    expect(m.avgEngagementSec.current).toBe(200)
    expect(m.avgEngagementSec.previous).toBe(150)
    expect(m.avgEngagementSec.delta.text).toBe('▲ 33%')
    expect(m.trend).toEqual([
      { date: '20260920', activeUsers: 150, android: 0, ios: 0 },
      { date: '20260921', activeUsers: 170, android: 0, ios: 0 },
    ])
  })
  it('handles empty responses', () => {
    const m = parseOverview([{}, {}])
    expect(m.users.current).toBe(0)
    expect(m.avgEngagementSec.current).toBe(0)
    expect(m.users.delta.tone).toBe('none')
    expect(m.trend).toEqual([])
    expect(m.screens).toEqual({ total: 0, items: [] })
    expect(() => parseOverview([])).not.toThrow()
  })
  it('builds four summary sentences', () => {
    expect(buildSummary('지난 7일', 7, compared(1234, 1100))).toBe(
      '지난 7일 동안 1,234명이 파르페를 썼어요. 그 전 7일보다 12% 늘었어요.',
    )
    expect(buildSummary('지난 7일', 7, compared(97, 100))).toBe(
      '지난 7일 동안 97명이 파르페를 썼어요. 그 전 7일보다 3% 줄었어요.',
    )
    expect(buildSummary('지난 7일', 7, compared(100, 100))).toBe(
      '지난 7일 동안 100명이 파르페를 썼어요. 그 전 7일과 같아요.',
    )
    expect(buildSummary('직접 선택', null, compared(50, 0))).toBe('선택한 기간 동안 50명이 파르페를 썼어요.')
    expect(buildSummary('직접 선택', null, compared(50, 25))).toBe(
      '선택한 기간 동안 50명이 파르페를 썼어요. 그 전 같은 기간보다 100% 늘었어요.',
    )
    expect(buildSummary('직접 선택', null, compared(50, 50))).toContain('그 전 같은 기간과 같아요.')
  })
})
