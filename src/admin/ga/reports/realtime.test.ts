import { describe, expect, it } from 'vitest'
import { buildRealtimeRequests, parseRealtime } from './realtime'
import total from './__fixtures__/realtime-total.json'
import byMinute from './__fixtures__/realtime-by-minute.json'

describe('realtime', () => {
  it('builds requests', () => {
    const [a, b] = buildRealtimeRequests()
    expect(a).toEqual({ metrics: [{ name: 'activeUsers' }] })
    expect(b).toEqual({
      dimensions: [{ name: 'minutesAgo' }],
      metrics: [{ name: 'activeUsers' }],
      minuteRanges: [{ startMinutesAgo: 29, endMinutesAgo: 0 }],
    })
  })
  it('fills 30 minutes, past to present, missing minutes 0', () => {
    const m = parseRealtime(total, byMinute)
    expect(m.activeUsers).toBe(42)
    expect(m.perMinute).toHaveLength(30)
    expect(m.perMinute[0]).toEqual({ minutesAgo: 29, users: 2 })
    expect(m.perMinute[29]).toEqual({ minutesAgo: 0, users: 5 })
    expect(m.perMinute[26]).toEqual({ minutesAgo: 3, users: 7 })
    expect(m.perMinute[10].users).toBe(0)
  })
  it('handles empty', () => {
    const m = parseRealtime({}, {})
    expect(m.activeUsers).toBe(0)
    expect(m.perMinute).toHaveLength(30)
    expect(m.perMinute.every((p) => p.users === 0)).toBe(true)
  })
})
