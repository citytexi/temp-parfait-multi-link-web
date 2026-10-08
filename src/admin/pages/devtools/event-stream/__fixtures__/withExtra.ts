import type { RunReportResponse } from '../../../../ga/types'

export function withExtra(
  res: RunReportResponse,
  rows: [event: string, minutesAgo: number, platform: string, version: string, count: number][],
): RunReportResponse {
  const added = rows.map(([event, minutesAgo, platform, version, count]) => ({
    dimensionValues: [event, String(minutesAgo), platform, version].map((value) => ({ value })),
    metricValues: [{ value: String(count) }],
  }))
  const all = [...(res.rows ?? []), ...added]
  return { ...res, rows: all, rowCount: all.length }
}
