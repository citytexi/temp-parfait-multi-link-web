import type { DateRange } from '../../lib/period'
import type { RunReportRequest, RunReportResponse } from '../types'
import { eventLabel } from '../eventLabels'
import { compared, splitByDateRange, type Compared } from './common'

export type EventItem = {
  name: string
  label: string
  registered: boolean
  count: Compared
  users: number
}

export function buildEventsRequest(r: { current: DateRange; previous: DateRange }): RunReportRequest {
  return {
    dateRanges: [r.current, r.previous],
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 20,
  }
}

export function parseEvents(res: RunReportResponse): EventItem[] {
  const { current, previous } = splitByDateRange(res)
  const prevCount = new Map(previous.map((row) => [row.dims.eventName, row.mets.eventCount ?? 0]))
  return current
    .map((row) => {
      const name = row.dims.eventName
      return {
        name,
        ...eventLabel(name),
        count: compared(row.mets.eventCount ?? 0, prevCount.get(name) ?? 0),
        users: row.mets.totalUsers ?? 0,
      }
    })
    .sort((a, b) => b.count.current - a.count.current)
    .slice(0, 10)
}
