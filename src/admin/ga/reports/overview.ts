import { formatNumber, type Delta } from '../../lib/format'
import type { DateRange } from '../../lib/period'
import type { RunReportRequest, RunReportResponse } from '../types'
import { compared, splitByDateRange, toRows, type Compared } from './common'

export type OverviewModel = {
  users: Compared
  newUsers: Compared
  avgEngagementSec: Compared
  trend: { date: string; activeUsers: number }[]
}

export function buildOverviewRequests(r: {
  current: DateRange
  previous: DateRange
}): RunReportRequest[] {
  return [
    {
      dateRanges: [r.current, r.previous],
      metrics: [{ name: 'activeUsers' }, { name: 'newUsers' }, { name: 'userEngagementDuration' }],
    },
    {
      dateRanges: [r.current],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
      // Days with no activity come back as zero rows instead of gaps in the chart.
      keepEmptyRows: true,
    },
  ]
}

const avg = (total: number, users: number): number => (users === 0 ? 0 : total / users)

export function parseOverview(reports: RunReportResponse[]): OverviewModel {
  const { current, previous } = splitByDateRange(reports[0] ?? {})
  const cur = current[0]?.mets ?? {}
  const prev = previous[0]?.mets ?? {}
  const trend = toRows(reports[1] ?? {}).map((row) => ({
    date: row.dims.date,
    activeUsers: row.mets.activeUsers ?? 0,
  }))
  return {
    users: compared(cur.activeUsers ?? 0, prev.activeUsers ?? 0),
    newUsers: compared(cur.newUsers ?? 0, prev.newUsers ?? 0),
    avgEngagementSec: compared(
      avg(cur.userEngagementDuration ?? 0, cur.activeUsers ?? 0),
      avg(prev.userEngagementDuration ?? 0, prev.activeUsers ?? 0),
    ),
    trend,
  }
}

function comparison(delta: Delta, before: string): string | null {
  if (delta.tone === 'none') return null
  if (delta.tone === 'flat' || delta.ratio === null) return `${before}과 같아요.`
  const percent = Math.round(Math.abs(delta.ratio) * 100)
  return `${before}보다 ${percent}% ${delta.tone === 'up' ? '늘었어요' : '줄었어요'}.`
}

export function buildSummary(label: string, days: number | null, users: Compared): string {
  const head = days === null ? '선택한 기간' : label
  const before = days === null ? '그 전 같은 기간' : `그 전 ${days}일`
  const first = `${head} 동안 ${formatNumber(users.current)}명이 파르페를 썼어요.`
  const second = comparison(users.delta, before)
  return second === null ? first : `${first} ${second}`
}
