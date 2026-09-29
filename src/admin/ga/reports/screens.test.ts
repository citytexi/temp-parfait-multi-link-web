import { describe, expect, it } from 'vitest'
import type { RunReportResponse } from '../types'
import { buildScreensRequest, parseScreens } from './screens'
import screens from './__fixtures__/screens.json'

const r = {
  current: { startDate: '2026-09-15', endDate: '2026-09-21' },
  previous: { startDate: '2026-09-08', endDate: '2026-09-14' },
}

describe('screens', () => {
  it('builds the request', () => {
    expect(buildScreensRequest(r)).toEqual({
      dateRanges: [r.current, r.previous],
      dimensions: [{ name: 'unifiedScreenName' }],
      metrics: [{ name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 100,
      metricAggregations: ['TOTAL'],
    })
  })

  it('keeps the top 10 current screens sorted by views', () => {
    const m = parseScreens(screens)
    expect(m.items).toHaveLength(10)
    expect(m.items.map((i) => i.views.current)).toEqual([5000, 3000, 2000, 1500, 1200, 1000, 900, 800, 700, 600])
    expect(m.items[0].name).toBe('home')
    expect(m.items[0].views).toMatchObject({ previous: 4000 })
    expect(m.items[0].views.delta.text).toBe('▲ 25%')
    expect(m.items[2].name).toBe('알 수 없음')
  })

  it('treats a missing previous row as 0', () => {
    const login = parseScreens(screens).items.find((i) => i.name === 'login')!
    expect(login.views.previous).toBe(0)
    expect(login.views.delta.text).toBe('비교 불가')
  })

  it('computes the ratio from the current-range total', () => {
    const m = parseScreens(screens)
    expect(m.total).toBe(20000)
    expect(m.items[0].ratio).toBeCloseTo(0.25)
  })

  it('uses the first totals row when it has no dateRange value', () => {
    const res: RunReportResponse = {
      ...screens,
      totals: [{ dimensionValues: [{ value: 'RESERVED_TOTAL' }], metricValues: [{ value: '10000' }] }],
    }
    expect(parseScreens(res).total).toBe(10000)
    expect(parseScreens(res).items[0].ratio).toBeCloseTo(0.5)
  })

  it('falls back to the sum of current rows without totals', () => {
    const { totals: _omit, ...res } = screens
    const m = parseScreens(res)
    expect(m.total).toBe(17600)
    expect(m.items[0].ratio).toBeCloseTo(5000 / 17600)
  })

  it('handles an empty response', () => {
    expect(parseScreens({})).toEqual({ total: 0, items: [] })
  })

  it('gives a ratio of 0 when the total is 0', () => {
    const res: RunReportResponse = {
      dimensionHeaders: [{ name: 'unifiedScreenName' }, { name: 'dateRange' }],
      metricHeaders: [{ name: 'screenPageViews' }],
      rows: [{ dimensionValues: [{ value: 'home' }, { value: 'date_range_0' }], metricValues: [{ value: '0' }] }],
    }
    expect(parseScreens(res).items[0].ratio).toBe(0)
  })
})
