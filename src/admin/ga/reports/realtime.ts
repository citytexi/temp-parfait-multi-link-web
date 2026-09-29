import type { RunRealtimeReportRequest, RunReportResponse } from '../types'
import { toRows } from './common'

export function buildRealtimeRequests(): RunRealtimeReportRequest[] {
  return [
    { metrics: [{ name: 'activeUsers' }] },
    {
      dimensions: [{ name: 'minutesAgo' }],
      metrics: [{ name: 'activeUsers' }],
      minuteRanges: [{ startMinutesAgo: 29, endMinutesAgo: 0 }],
    },
  ]
}

export function parseRealtime(
  total: RunReportResponse,
  byMinute: RunReportResponse,
): { activeUsers: number; perMinute: { minutesAgo: number; users: number }[] } {
  const users = new Map(
    toRows(byMinute).map((row) => [Number(row.dims.minutesAgo), row.mets.activeUsers ?? 0]),
  )
  return {
    activeUsers: toRows(total)[0]?.mets.activeUsers ?? 0,
    perMinute: Array.from({ length: 30 }, (_, i) => ({
      minutesAgo: 29 - i,
      users: users.get(29 - i) ?? 0,
    })),
  }
}
