import { findEvent } from '../../../ga/eventCatalog'
import { toRows } from '../../../ga/reports/common'
import type { PropertyQuota, RunRealtimeReportRequest, RunReportResponse } from '../../../ga/types'
import { BASELINE_MAX_AGE_MS, HIGHLIGHT_TTL_MS, ROW_LIMIT } from './config'

export const NOT_SET = '(not set)'
const MINUTES = 30
const RECENT_MINUTES = 5

export type StreamRow = { event: string; minutesAgo: number; platform: string; version: string; count: number }
export type StreamSnapshot = { rows: StreamRow[]; truncated: boolean; fetchedAt: number; quota: PropertyQuota | null }
export type DimFilter = { platform: string | null; version: string | null }
export type EventLine = {
  name: string
  label: string // catalogue label; the name when missing or empty
  inCatalog: boolean
  watched: boolean
  now: number
  last5: number
  total: number
  perMinute: number[] // length 30, oldest first (index 0 = 29 minutes ago)
}
export type Change = { kind: 'new' | 'up'; delta: number }
export type Highlight = Change & { at: number }

export function buildStreamRequest(): RunRealtimeReportRequest {
  return {
    dimensions: [{ name: 'eventName' }, { name: 'minutesAgo' }, { name: 'platform' }, { name: 'appVersion' }],
    metrics: [{ name: 'eventCount' }],
    minuteRanges: [{ startMinutesAgo: MINUTES - 1, endMinutesAgo: 0 }],
    orderBys: [{ dimension: { dimensionName: 'minutesAgo', orderType: 'NUMERIC' } }],
    limit: ROW_LIMIT,
  }
}

const unify = (value: string | undefined): string => (!value || value === NOT_SET ? NOT_SET : value)

export function parseStream(res: RunReportResponse, fetchedAt: number): StreamSnapshot {
  const rows = toRows(res).map((r) => ({
    event: r.dims.eventName ?? '',
    minutesAgo: Number(r.dims.minutesAgo) || 0,
    platform: unify(r.dims.platform),
    version: unify(r.dims.appVersion),
    count: r.mets.eventCount ?? 0,
  }))
  return {
    rows,
    truncated: (res.rowCount ?? 0) > (res.rows?.length ?? 0),
    fetchedAt,
    quota: res.propertyQuota ?? null,
  }
}

export function filterOptions(s: StreamSnapshot, selected: DimFilter): { platforms: string[]; versions: string[] } {
  const platforms = new Set(s.rows.map((r) => r.platform))
  const versions = new Set(s.rows.map((r) => r.version))
  if (selected.platform !== null) platforms.add(selected.platform)
  if (selected.version !== null) versions.add(selected.version)
  return { platforms: [...platforms].sort(), versions: [...versions].sort() }
}

const matches = (r: StreamRow, dim: DimFilter): boolean =>
  (dim.platform === null || r.platform === dim.platform) && (dim.version === null || r.version === dim.version)

function sumByEvent(s: StreamSnapshot, dim: DimFilter): Map<string, number[]> {
  const sums = new Map<string, number[]>()
  for (const r of s.rows) {
    if (!matches(r, dim) || r.minutesAgo < 0 || r.minutesAgo >= MINUTES) continue
    let buckets = sums.get(r.event)
    if (!buckets) {
      buckets = Array<number>(MINUTES).fill(0)
      sums.set(r.event, buckets)
    }
    buckets[MINUTES - 1 - r.minutesAgo] += r.count
  }
  return sums
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)
const last5Of = (buckets: number[]): number => sum(buckets.slice(MINUTES - RECENT_MINUTES))

export function toLines(s: StreamSnapshot, dim: DimFilter, q: string, watch: readonly string[]): EventLine[] {
  const sums = sumByEvent(s, dim)
  const watched = new Set(watch)
  const names = new Set([...sums.keys(), ...watch])
  const needle = q.trim().toLowerCase()
  const lines: EventLine[] = []
  for (const name of names) {
    const entry = findEvent(name)
    const label = entry?.label || name
    const isWatched = watched.has(name)
    if (!isWatched && needle && !name.toLowerCase().includes(needle) && !label.toLowerCase().includes(needle)) continue
    const perMinute = sums.get(name) ?? Array<number>(MINUTES).fill(0)
    lines.push({
      name,
      label,
      inCatalog: entry !== undefined,
      watched: isWatched,
      now: perMinute[MINUTES - 1],
      last5: last5Of(perMinute),
      total: sum(perMinute),
      perMinute,
    })
  }
  return lines.sort(
    (a, b) => Number(b.watched) - Number(a.watched) || b.total - a.total || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  )
}

export function diffSnapshots(prev: StreamSnapshot | null, next: StreamSnapshot, dim: DimFilter): Map<string, Change> {
  const changes = new Map<string, Change>()
  if (!prev || next.fetchedAt - prev.fetchedAt > BASELINE_MAX_AGE_MS) return changes
  const before = sumByEvent(prev, dim)
  for (const [name, buckets] of sumByEvent(next, dim)) {
    const old = before.get(name)
    const last5 = last5Of(buckets)
    if (!old) changes.set(name, { kind: 'new', delta: last5 })
    else if (last5 > last5Of(old)) changes.set(name, { kind: 'up', delta: last5 - last5Of(old) })
  }
  return changes
}

export function mergeHighlights(
  current: ReadonlyMap<string, Highlight>,
  changes: ReadonlyMap<string, Change>,
  now: number,
): Map<string, Highlight> {
  const merged = new Map<string, Highlight>()
  for (const [name, h] of current) if (now - h.at < HIGHLIGHT_TTL_MS) merged.set(name, h)
  for (const [name, change] of changes) {
    const existing = merged.get(name)
    merged.set(
      name,
      existing
        ? { kind: existing.kind === 'new' ? 'new' : change.kind, delta: existing.delta + change.delta, at: now }
        : { ...change, at: now },
    )
  }
  return merged
}

export function parseWatch(param: string | null): string[] {
  if (!param) return []
  const names = param.split(',').map((p) => p.trim()).filter(Boolean)
  return [...new Set(names)]
}

export function toggleWatch(watch: readonly string[], name: string): string | null {
  const next = watch.includes(name) ? watch.filter((w) => w !== name) : [...watch, name]
  return next.length > 0 ? next.join(',') : null
}
