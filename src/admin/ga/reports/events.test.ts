import { describe, expect, it } from 'vitest'
import { buildEventsRequest, parseEvents } from './events'
import events from './__fixtures__/events.json'
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
      limit: 100,
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
  it('finds previous rows that appear after 20 other rows', () => {
    const row = (name: string, range: string, count: number) => ({
      dimensionValues: [{ value: name }, { value: range }],
      metricValues: [{ value: String(count) }, { value: '1' }],
    })
    const filler = Array.from({ length: 25 }, (_, i) => row(`f${i}`, 'date_range_0', 10000 - i))
    const res = {
      ...events,
      rows: [
        row('screen_view', 'date_range_0', 20000),
        ...filler,
        row('screen_view', 'date_range_1', 10000),
      ],
    }
    const items = parseEvents(res)
    expect(items.find((e) => e.name === 'f0')!.count.delta.text).toBe('비교 불가')
    expect(items.find((e) => e.name === 'screen_view')!.count.delta.text).toBe('▲ 100%')
  })
  it('handles empty', () => {
    expect(parseEvents({})).toEqual([])
  })
})
