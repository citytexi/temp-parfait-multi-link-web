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
  metricAggregations?: ('TOTAL' | 'MAXIMUM' | 'MINIMUM' | 'COUNT')[]
  keepEmptyRows?: boolean
  returnPropertyQuota?: boolean
}

export type RunRealtimeReportRequest = {
  dimensions?: { name: string }[]
  metrics?: { name: string }[]
  minuteRanges?: { name?: string; startMinutesAgo?: number; endMinutesAgo?: number }[]
  orderBys?: OrderBy[]
  limit?: number
  returnPropertyQuota?: boolean
}

type QuotaStatus = { consumed: number; remaining: number }

export type PropertyQuota = {
  tokensPerDay?: QuotaStatus
  tokensPerHour?: QuotaStatus
  tokensPerProjectPerHour?: QuotaStatus
  concurrentRequests?: QuotaStatus
  serverErrorsPerProjectPerHour?: QuotaStatus
}

export type DimensionMetadata = {
  apiName: string
  uiName?: string
  description?: string
  customDefinition?: boolean
}

export type MetricMetadata = DimensionMetadata

export type Metadata = { dimensions?: DimensionMetadata[]; metrics?: MetricMetadata[] }

export type RunReportResponse = {
  dimensionHeaders?: { name: string }[]
  metricHeaders?: { name: string; type?: string }[]
  rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[]
  totals?: { dimensionValues?: { value: string }[]; metricValues: { value: string }[] }[]
  rowCount?: number
  propertyQuota?: PropertyQuota
}

export type BatchRunReportsResponse = { reports: RunReportResponse[] }
