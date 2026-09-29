import type { DateRange } from '../../lib/period'
import type { RunReportRequest, RunReportResponse } from '../types'
import { compared, splitByDateRange, toRows, type Compared } from './common'

export type RetentionCohort = { label: string; size: number; weeks: (number | null)[] }

const DAY_MS = 86_400_000
const WEEKS = 4
const toUtc = (ymd: string): number => {
  const [y, m, d] = ymd.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const addDays = (ymd: string, n: number): string =>
  new Date(toUtc(ymd) + n * DAY_MS).toISOString().slice(0, 10)

export function buildRetentionRequest(today: string): RunReportRequest {
  const dow = new Date(toUtc(today)).getUTCDay()
  const lastSaturday = addDays(today, -(dow + 1))
  const cohorts = Array.from({ length: WEEKS }, (_, i) => {
    const startDate = addDays(lastSaturday, -6 - 7 * (WEEKS - 1 - i))
    const endDate = addDays(startDate, 6)
    return {
      name: `${startDate}~${endDate}`,
      dimension: 'firstSessionDate' as const,
      dateRange: { startDate, endDate },
    }
  })
  return {
    cohortSpec: {
      cohorts,
      cohortsRange: { granularity: 'WEEKLY', startOffset: 0, endOffset: 4 },
    },
    dimensions: [{ name: 'cohort' }, { name: 'cohortNthWeek' }],
    metrics: [{ name: 'cohortActiveUsers' }],
  }
}

export function buildEngagementRequest(r: {
  current: DateRange
  previous: DateRange
}): RunReportRequest {
  return {
    dateRanges: [r.current, r.previous],
    metrics: [
      { name: 'sessionsPerUser' },
      { name: 'userEngagementDuration' },
      { name: 'activeUsers' },
    ],
  }
}

const mmdd = (ymd: string): string => ymd.slice(5).replace('-', '.')

export function parseRetention(res: RunReportResponse, today: string): { cohorts: RetentionCohort[] } {
  const byCohort = new Map<string, Map<number, number>>()
  for (const row of toRows(res)) {
    const name = row.dims.cohort
    const week = Number(row.dims.cohortNthWeek)
    if (!byCohort.has(name)) byCohort.set(name, new Map())
    byCohort.get(name)!.set(week, row.mets.cohortActiveUsers ?? 0)
  }
  const cohorts = [...byCohort.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, active]) => {
      const [start, end] = name.split('~')
      const size = active.get(0) ?? 0
      const weeks = Array.from({ length: WEEKS + 1 }, (_, n): number | null => {
        if (addDays(start, 7 * n + 6) >= today) return null
        return size === 0 ? 0 : (active.get(n) ?? 0) / size
      })
      return { label: `${mmdd(start)} ~ ${mmdd(end)}`, size, weeks }
    })
  return { cohorts }
}

export function parseEngagement(res: RunReportResponse): {
  sessionsPerUser: Compared
  avgEngagementSec: Compared
} {
  const { current, previous } = splitByDateRange(res)
  const cur = current[0]?.mets ?? {}
  const prev = previous[0]?.mets ?? {}
  const avg = (total = 0, users = 0): number => (users === 0 ? 0 : total / users)
  return {
    sessionsPerUser: compared(cur.sessionsPerUser ?? 0, prev.sessionsPerUser ?? 0),
    avgEngagementSec: compared(
      avg(cur.userEngagementDuration, cur.activeUsers),
      avg(prev.userEngagementDuration, prev.activeUsers),
    ),
  }
}
