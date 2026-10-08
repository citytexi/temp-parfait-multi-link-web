import { toRows } from '../../../ga/reports/common'
import type { Metadata, RunRealtimeReportRequest, RunReportRequest, RunReportResponse } from '../../../ga/types'
import type { DateRange } from '../../../lib/period'

const ROW_LIMIT = 10_000
const RECENT_MINUTES = 30
const CUSTOM_EVENT_PREFIX = 'customEvent:'

export type PlatformCount = { platform: string; count: number; users: number }
export type Observed = ReadonlyMap<string, { count: number; users: number; byPlatform: PlatformCount[] }>
export type Recent = ReadonlyMap<string, { platform: string; count: number }[]>
export type GaParam = { name: string; uiName: string; description: string; kind: 'dimension' | 'metric' }

export function buildObservedRequest(current: DateRange): RunReportRequest {
  return {
    dateRanges: [{ startDate: current.startDate, endDate: current.endDate }],
    dimensions: [{ name: 'eventName' }, { name: 'platform' }],
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
    limit: ROW_LIMIT,
  }
}

export function parseObserved(res: RunReportResponse): Observed {
  const observed = new Map<string, { count: number; users: number; byPlatform: PlatformCount[] }>()
  for (const r of toRows(res)) {
    const name = r.dims.eventName ?? ''
    const count = r.mets.eventCount ?? 0
    const users = r.mets.totalUsers ?? 0
    let entry = observed.get(name)
    if (!entry) {
      entry = { count: 0, users: 0, byPlatform: [] }
      observed.set(name, entry)
    }
    entry.count += count
    entry.users += users
    entry.byPlatform.push({ platform: r.dims.platform ?? '', count, users })
  }
  for (const entry of observed.values()) entry.byPlatform.sort((a, b) => b.count - a.count)
  return observed
}

export function buildRecentRequest(): RunRealtimeReportRequest {
  return {
    dimensions: [{ name: 'eventName' }, { name: 'platform' }],
    metrics: [{ name: 'eventCount' }],
    minuteRanges: [{ startMinutesAgo: RECENT_MINUTES - 1, endMinutesAgo: 0 }],
    limit: ROW_LIMIT,
  }
}

export function parseRecent(res: RunReportResponse): Recent {
  const recent = new Map<string, { platform: string; count: number }[]>()
  for (const r of toRows(res)) {
    const name = r.dims.eventName ?? ''
    const list = recent.get(name) ?? []
    list.push({ platform: r.dims.platform ?? '', count: r.mets.eventCount ?? 0 })
    recent.set(name, list)
  }
  return recent
}

export function parseMetadata(meta: Metadata): GaParam[] {
  const pick = (
    items: Metadata['dimensions'] | Metadata['metrics'],
    kind: GaParam['kind'],
  ): GaParam[] =>
    (items ?? [])
      .filter((i) => i.apiName.startsWith(CUSTOM_EVENT_PREFIX))
      .map((i) => ({
        name: i.apiName.slice(CUSTOM_EVENT_PREFIX.length),
        uiName: i.uiName ?? '',
        description: i.description ?? '',
        kind,
      }))
  return [...pick(meta.dimensions, 'dimension'), ...pick(meta.metrics, 'metric')].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )
}
