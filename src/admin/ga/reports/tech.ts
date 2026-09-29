import type { DateRange } from '../../lib/period'
import type { RunReportRequest, RunReportResponse } from '../types'
import { displayDim, toRows } from './common'

export type Share = { label: string; users: number; ratio: number }
export type TechModel = { platforms: Share[]; countries: Share[]; appVersions: Share[] }

export function buildTechRequests(r: { current: DateRange }): RunReportRequest[] {
  const base = (dimension: string, limit?: number): RunReportRequest => ({
    dateRanges: [r.current],
    dimensions: [{ name: dimension }],
    metrics: [{ name: 'activeUsers' }],
    metricAggregations: ['TOTAL'],
    orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
    ...(limit === undefined ? {} : { limit }),
  })
  return [base('platform'), base('country', 10), base('appVersion', 10)]
}

function toShares(res: RunReportResponse | undefined): Share[] {
  const rows = toRows(res ?? {})
  const dimName = res?.dimensionHeaders?.[0]?.name ?? ''
  const rowSum = rows.reduce((sum, row) => sum + (row.mets.activeUsers ?? 0), 0)
  const reported = Number(res?.totals?.[0]?.metricValues?.[0]?.value)
  const total = Number.isFinite(reported) && reported > 0 ? reported : rowSum
  return rows.map((row) => {
    const users = row.mets.activeUsers ?? 0
    return { label: displayDim(row.dims[dimName]), users, ratio: total === 0 ? 0 : users / total }
  })
}

export function parseTech(reports: RunReportResponse[]): TechModel {
  return {
    platforms: toShares(reports[0]),
    countries: toShares(reports[1]),
    appVersions: toShares(reports[2]),
  }
}
