export type DateRange = { startDate: string; endDate: string; name?: string }

export type OrderBy = {
  desc?: boolean
  metric?: { metricName: string }
  dimension?: { dimensionName: string; orderType?: string }
}

export type CohortSpec = {
  cohorts: {
    name?: string
    dimension: 'firstSessionDate'
    dateRange: { startDate: string; endDate: string }
  }[]
  cohortsRange: {
    granularity: 'DAILY' | 'WEEKLY' | 'MONTHLY'
    startOffset?: number
    endOffset: number
  }
}

export type RunReportRequest = {
  dateRanges?: DateRange[]
  dimensions?: { name: string }[]
  metrics?: { name: string }[]
  orderBys?: OrderBy[]
  limit?: number
  cohortSpec?: CohortSpec
  returnPropertyQuota?: boolean
}

export type RunRealtimeReportRequest = {
  dimensions?: { name: string }[]
  metrics?: { name: string }[]
  minuteRanges?: { name?: string; startMinutesAgo?: number; endMinutesAgo?: number }[]
  limit?: number
}

export type PropertyQuota = {
  tokensPerDay?: { consumed: number; remaining: number }
}

export type RunReportResponse = {
  dimensionHeaders?: { name: string }[]
  metricHeaders?: { name: string; type?: string }[]
  rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[]
  rowCount?: number
  propertyQuota?: PropertyQuota
}

export type BatchRunReportsResponse = { reports: RunReportResponse[] }
