import type { DateRange } from '../../lib/period'
import type { RunReportRequest, RunReportResponse } from '../types'
import { compared, splitByDateRange, toRows, type Compared } from './common'

export type NewVsReturningLabel = '신규' | '재방문' | '알 수 없음'
export type UsersModel = {
  trend: { date: string; dau: number; wau: number; mau: number }[]
  newVsReturning: { label: NewVsReturningLabel; users: Compared }[]
}

export function buildUsersRequests(r: {
  current: DateRange
  previous: DateRange
}): RunReportRequest[] {
  return [
    {
      dateRanges: [r.current],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'active1DayUsers' },
        { name: 'active7DayUsers' },
        { name: 'active28DayUsers' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
      // Days with no activity come back as zero rows instead of gaps in the chart.
      keepEmptyRows: true,
    },
    {
      dateRanges: [r.current, r.previous],
      dimensions: [{ name: 'newVsReturning' }],
      metrics: [{ name: 'activeUsers' }],
    },
  ]
}

const LABELS: Record<string, NewVsReturningLabel> = { new: '신규', returning: '재방문' }
const ORDER: NewVsReturningLabel[] = ['신규', '재방문', '알 수 없음']

export function parseUsers(reports: RunReportResponse[]): UsersModel {
  const trend = toRows(reports[0] ?? {}).map((row) => ({
    date: row.dims.date,
    dau: row.mets.active1DayUsers ?? 0,
    wau: row.mets.active7DayUsers ?? 0,
    mau: row.mets.active28DayUsers ?? 0,
  }))
  const { current, previous } = splitByDateRange(reports[1] ?? {})
  const sum = (rows: typeof current): Record<string, number> => {
    const out: Record<string, number> = {}
    for (const row of rows) {
      const label = LABELS[row.dims.newVsReturning] ?? '알 수 없음'
      out[label] = (out[label] ?? 0) + (row.mets.activeUsers ?? 0)
    }
    return out
  }
  const cur = sum(current)
  const prev = sum(previous)
  const newVsReturning = ORDER.filter((l) => l in cur || l in prev).map((label) => ({
    label,
    users: compared(cur[label] ?? 0, prev[label] ?? 0),
  }))
  return { trend, newVsReturning }
}
