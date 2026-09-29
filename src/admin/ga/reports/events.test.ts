import { describe, expect, it } from 'vitest'
import { buildEventsRequest, parseEvents } from './events'
import res from './__fixtures__/events.json'

const r = {
  current: { startDate: '2026-09-15', endDate: '2026-09-21' },
  previous: { startDate: '2026-09-08', endDate: '2026-09-14' },
}

describe('events', () => {
  it('builds request', () => {
    expect(buildEventsRequest(r)).toEqual({
      dateRanges: [r.current, r.previous],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 20,
    })
  })
  it('parses top 10 by current count with labels and registration', () => {
    const items = parseEvents(res)
    expect(items).toHaveLength(10)
    expect(items[0]).toMatchObject({ name: 'screen_view', label: '화면 조회', registered: true, users: 100 })
    expect(items[0].count.delta.text).toBe('▲ 25%')
    const custom = items.find((i) => i.name === 'link_click')!
    expect(custom).toMatchObject({ label: 'link_click', registered: false })
    const noPrev = items.find((i) => i.name === 'user_engagement')!
    expect(noPrev.count.previous).toBe(0)
    expect(noPrev.count.delta.text).toBe('비교 불가')
    const counts = items.map((i) => i.count.current)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
    expect(items.some((i) => i.name === 'custom_zero')).toBe(false)
  })
  it('handles empty', () => {
    expect(parseEvents({})).toEqual([])
  })
})
