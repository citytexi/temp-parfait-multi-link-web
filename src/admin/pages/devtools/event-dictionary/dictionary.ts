import { targetPlatforms, type CatalogEvent, type EventPlatform } from '../../../ga/eventCatalog'
import type { GaParam, Observed, PlatformCount, Recent } from './report'

export type EventStatus = 'unknown' | 'missing' | 'partial' | 'undocumented' | 'ok'
export type ProblemStatus = Exclude<EventStatus, 'ok'>

export const STATUS_LABEL: Record<EventStatus, string> = {
  unknown: '사전에 없음',
  missing: '안 들어옴',
  partial: '일부 플랫폼만',
  undocumented: '설명 없음',
  ok: '정상',
}

const PROBLEM_STATUSES: readonly ProblemStatus[] = ['unknown', 'missing', 'partial', 'undocumented']
const NEEDS_OBSERVATION: readonly ProblemStatus[] = ['unknown', 'missing', 'partial']

export type DictionaryEntry = {
  name: string
  label: string
  catalog: CatalogEvent | null
  status: EventStatus
  count: number | null
  users: number | null
  byPlatform: PlatformCount[]
  recent: { platform: string; count: number }[]
  recentOnly: boolean
  missingPlatforms: EventPlatform[]
}

function judge(
  catalog: CatalogEvent | null,
  arrived: boolean,
  missingPlatforms: readonly EventPlatform[],
): EventStatus {
  if (!catalog) return 'unknown'
  if (catalog.kind === 'app' && !arrived) return 'missing'
  if (catalog.kind === 'app' && missingPlatforms.length > 0) return 'partial'
  if (catalog.description.trim() === '') return 'undocumented'
  return 'ok'
}

export function buildDictionary(input: {
  catalog: readonly CatalogEvent[]
  observed: Observed | null
  recent: Recent | null
}): DictionaryEntry[] {
  const { observed, recent } = input
  const catalogByName = new Map<string, CatalogEvent>()
  for (const e of input.catalog) catalogByName.set(e.name, e)

  // Without period data nothing can be judged as arrived, so only the catalogue is listed.
  const names = new Set<string>(catalogByName.keys())
  if (observed) {
    for (const n of observed.keys()) names.add(n)
    if (recent) for (const n of recent.keys()) names.add(n)
  }

  const entries: DictionaryEntry[] = []
  for (const name of names) {
    const catalog = catalogByName.get(name) ?? null
    const seen = observed?.get(name)
    const recentList = recent?.get(name) ?? []
    let missingPlatforms: EventPlatform[] = []
    let arrived = false
    if (observed) {
      arrived = seen !== undefined || recentList.length > 0
      if (catalog && catalog.kind === 'app') {
        const seenPlatforms = new Set([
          ...(seen?.byPlatform ?? []).map((x) => x.platform),
          ...recentList.map((x) => x.platform),
        ])
        missingPlatforms = targetPlatforms(catalog).filter((pl) => !seenPlatforms.has(pl))
      }
    }
    entries.push({
      name,
      label: catalog?.label ? catalog.label : name,
      catalog,
      status: observed ? judge(catalog, arrived, missingPlatforms) : judge(catalog, true, []),
      count: observed ? (seen?.count ?? 0) : null,
      users: observed ? (seen?.users ?? 0) : null,
      byPlatform: seen ? [...seen.byPlatform] : [],
      recent: [...recentList],
      recentOnly: observed !== null && seen === undefined && recentList.length > 0,
      missingPlatforms,
    })
  }

  return entries.sort((a, b) => {
    const pa = a.status === 'ok' ? 1 : 0
    const pb = b.status === 'ok' ? 1 : 0
    if (pa !== pb) return pa - pb
    const byCount = (b.count ?? 0) - (a.count ?? 0)
    if (byCount !== 0) return byCount
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  })
}

export function statusCounts(
  entries: readonly DictionaryEntry[],
  observedKnown: boolean,
): { all: number } & Record<ProblemStatus, number | null> {
  const result: { all: number } & Record<ProblemStatus, number | null> = {
    all: entries.length,
    unknown: 0,
    missing: 0,
    partial: 0,
    undocumented: 0,
  }
  for (const e of entries) {
    if (e.status !== 'ok') result[e.status] = (result[e.status] ?? 0) + 1
  }
  if (!observedKnown) for (const s of NEEDS_OBSERVATION) result[s] = null
  return result
}

export function parseStatus(param: string | null): ProblemStatus | null {
  return PROBLEM_STATUSES.find((s) => s === param) ?? null
}

export function filterEntries(
  entries: readonly DictionaryEntry[],
  f: { q: string; status: ProblemStatus | null },
): DictionaryEntry[] {
  const q = f.q.toLowerCase()
  return entries.filter((e) => {
    if (f.status && e.status !== f.status) return false
    if (q === '') return true
    const haystack = [e.name, e.label, e.catalog?.description ?? '', ...(e.catalog?.params ?? []).map((p) => p.name)]
    return haystack.some((s) => s.toLowerCase().includes(q))
  })
}

export function catalogSnippet(name: string): string {
  return `{ name: '${name}', label: '', description: '', kind: 'app', params: [] },`
}

export function unlistedParams(params: readonly GaParam[], catalog: readonly CatalogEvent[]): Set<string> {
  const listed = new Set<string>()
  for (const e of catalog) for (const p of e.params) listed.add(p.name)
  return new Set(params.filter((p) => !listed.has(p.name)).map((p) => p.name))
}

export const CSV_HEADERS: string[] = ['이벤트 이름', '한글 라벨', '구분', '상태', '횟수', '사람 수', '설명', '파라미터']

export function toCsvRows(entries: readonly DictionaryEntry[]): (string | number)[][] {
  return entries.map((e) => [
    e.name,
    e.label,
    e.catalog ? (e.catalog.kind === 'auto' ? '자동 수집' : '앱 정의') : '',
    STATUS_LABEL[e.status],
    e.count ?? '',
    e.users ?? '',
    e.catalog?.description ?? '',
    (e.catalog?.params ?? []).map((p) => p.name).join(', '),
  ])
}
