import { describe, expect, it } from 'vitest'
import { buildUsersRequests, parseUsers } from './users'
import trend from './__fixtures__/users-trend.json'
import nvr from './__fixtures__/users-new-vs-returning.json'

const r = {
  current: { startDate: '2026-09-15', endDate: '2026-09-21' },
  previous: { startDate: '2026-09-08', endDate: '2026-09-14' },
}

describe('users', () => {
  it('builds requests', () => {
    const [a, b] = buildUsersRequests(r)
    expect(a.dimensions).toEqual([{ name: 'date' }])
    expect(a.metrics).toEqual([{ name: 'active1DayUsers' }, { name: 'active7DayUsers' }, { name: 'active28DayUsers' }])
    expect(a.dateRanges).toEqual([r.current])
    expect(b.dimensions).toEqual([{ name: 'newVsReturning' }])
    expect(b.metrics).toEqual([{ name: 'activeUsers' }])
    expect(b.dateRanges).toEqual([r.current, r.previous])
  })
  it('parses trend and new vs returning', () => {
    const m = parseUsers([trend, nvr])
    expect(m.trend[1]).toEqual({ date: '20260921', dau: 110, wau: 420, mau: 910 })
    expect(m.newVsReturning.map((x) => x.label)).toEqual(['신규', '재방문', '알 수 없음'])
    expect(m.newVsReturning[0].users).toMatchObject({ current: 300, previous: 250 })
    expect(m.newVsReturning[0].users.delta.text).toBe('▲ 20%')
    expect(m.newVsReturning[2].users.delta.tone).toBe('none')
  })
  it('handles empty', () => {
    expect(parseUsers([{}, {}])).toEqual({ trend: [], newVsReturning: [] })
    expect(parseUsers([])).toEqual({ trend: [], newVsReturning: [] })
  })
})
