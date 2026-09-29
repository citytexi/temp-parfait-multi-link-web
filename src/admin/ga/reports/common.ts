import { computeDelta, type Delta } from '../../lib/format'
import type { RunReportResponse } from '../types'

export type Compared = { current: number; previous: number; delta: Delta }
export type Row = { dims: Record<string, string>; mets: Record<string, number> }

export const CURRENT_RANGE = 'date_range_0'
export const PREVIOUS_RANGE = 'date_range_1'

const toNumber = (value: string | undefined): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function toRows(res: RunReportResponse): Row[] {
  const dimNames = (res.dimensionHeaders ?? []).map((h) => h.name)
  const metNames = (res.metricHeaders ?? []).map((h) => h.name)
  return (res.rows ?? []).map((row) => {
    const dims: Record<string, string> = {}
    const mets: Record<string, number> = {}
    dimNames.forEach((name, i) => {
      dims[name] = row.dimensionValues?.[i]?.value ?? ''
    })
    metNames.forEach((name, i) => {
      mets[name] = toNumber(row.metricValues[i]?.value)
    })
    return { dims, mets }
  })
}

export function splitByDateRange(res: RunReportResponse): { current: Row[]; previous: Row[] } {
  const rows = toRows(res)
  return {
    current: rows.filter((r) => r.dims.dateRange === CURRENT_RANGE),
    previous: rows.filter((r) => r.dims.dateRange === PREVIOUS_RANGE),
  }
}

export function compared(current: number, previous: number): Compared {
  return { current, previous, delta: computeDelta(current, previous) }
}

export function displayDim(value: string): string {
  if (value === '(not set)' || value === '') return '알 수 없음'
  if (value === '(other)') return '기타'
  return value
}
