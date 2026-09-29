import type { DateRange } from '../../lib/period'
import type { RunReportRequest, RunReportResponse } from '../types'
import { displayDim, toRows } from './common'

export type Share = { label: string; users: number; ratio: number }
export type TechModel = { platforms: Share[]; countries: Share[]; appVersions: Share[] }

const usersDesc = [{ metric: { metricName: 'activeUsers' }, desc: true }]

export function buildTechRequests(r: { current: DateRange }): RunReportRequest[] {
  const base = { dateRanges: [r.current], metrics: [{ name: 'activeUsers' }], orderBys: usersDesc }
  return [
    { ...base, dimensions: [{ name: 'platform' }] },
    { ...base, dimensions: [{ name: 'country' }], limit: 10 },
    { ...base, dimensions: [{ name: 'appVersion' }], limit: 10 },
  ]
}

function toShares(res: RunReportResponse | undefined): Share[] {
  const rows = toRows(res ?? {})
  const dimName = res?.dimensionHeaders?.[0]?.name ?? ''
  const total = rows.reduce((sum, row) => sum + (row.mets.activeUsers ?? 0), 0)
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
