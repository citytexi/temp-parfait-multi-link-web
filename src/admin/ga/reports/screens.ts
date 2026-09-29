import type { DateRange } from '../../lib/period'
import type { RunReportRequest, RunReportResponse } from '../types'
import { compared, CURRENT_RANGE, displayDim, splitByDateRange, type Compared } from './common'

export type ScreenItem = { name: string; views: Compared; ratio: number }
export type ScreensModel = { total: number; items: ScreenItem[] }

export function buildScreensRequest(r: { current: DateRange; previous: DateRange }): RunReportRequest {
  return {
    dateRanges: [r.current, r.previous],
    dimensions: [{ name: 'unifiedScreenName' }],
    metrics: [{ name: 'screenPageViews' }],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 100,
    metricAggregations: ['TOTAL'],
  }
}

/** GA returns one totals row per date range; pick the current one, else the first. */
function reportedTotal(res: RunReportResponse): number | null {
  const totals = res.totals ?? []
  const current = totals.find((t) => t.dimensionValues?.some((d) => d.value === CURRENT_RANGE)) ?? totals[0]
  const value = Number(current?.metricValues?.[0]?.value)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function parseScreens(res: RunReportResponse): ScreensModel {
  const { current, previous } = splitByDateRange(res)
  const prevViews = new Map(previous.map((row) => [row.dims.unifiedScreenName, row.mets.screenPageViews ?? 0]))
  const rowSum = current.reduce((sum, row) => sum + (row.mets.screenPageViews ?? 0), 0)
  const total = reportedTotal(res) ?? rowSum
  const items = current
    .map((row) => {
      const views = row.mets.screenPageViews ?? 0
      return {
        name: displayDim(row.dims.unifiedScreenName),
        views: compared(views, prevViews.get(row.dims.unifiedScreenName) ?? 0),
        ratio: total === 0 ? 0 : views / total,
      }
    })
    .sort((a, b) => b.views.current - a.views.current)
    .slice(0, 10)
  return { total, items }
}
