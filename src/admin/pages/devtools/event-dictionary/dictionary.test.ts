import { describe, expect, it } from 'vitest'
import type { CatalogEvent } from '../../../ga/eventCatalog'
import type { GaParam, Observed, Recent } from './report'
import {
  buildDictionary,
  catalogSnippet,
  filterEntries,
  parseStatus,
  statusCounts,
  toCsvRows,
  unlistedParams,
} from './dictionary'

const cat: CatalogEvent[] = [
  { name: 'screen_view', label: '화면 조회', description: '화면을 볼 때 기록돼요.', kind: 'auto', params: [] },
  { name: 'app_remove', label: '앱 삭제', description: '앱을 지울 때 기록돼요.', kind: 'auto', params: [] },
  {
    name: 'purchase_done',
    label: '구매 완료',
    description: '구매가 끝나면 기록돼요.',
    kind: 'app',
    params: [{ name: 'item_id', type: 'string', description: '상품 ID' }],
  },
  { name: 'only_android', label: '안드로이드 전용', description: '', kind: 'app', params: [], platforms: ['Android'] },
  { name: 'both_needed', label: '둘 다', description: '둘 다 보내요.', kind: 'app', params: [] },
  { name: 'never_sent', label: '', description: '설명이 있어요.', kind: 'app', params: [] },
]

const p = (platform: string, count: number, users: number) => ({ platform, count, users })
const observed: Observed = new Map([
  ['screen_view', { count: 160, users: 65, byPlatform: [p('Android', 100, 40), p('iOS', 60, 25)] }],
  ['purchase_done', { count: 41, users: 15, byPlatform: [p('Android', 30, 10), p('iOS', 11, 5)] }],
  ['only_android', { count: 7, users: 3, byPlatform: [p('Android', 7, 3)] }],
  ['both_needed', { count: 5, users: 2, byPlatform: [p('Android', 5, 2)] }],
  ['typo_evnt', { count: 2, users: 1, byPlatform: [p('Android', 2, 1)] }],
])
const recent: Recent = new Map([
  ['today_only', [{ platform: 'iOS', count: 1 }]],
  ['both_needed', [{ platform: 'iOS', count: 3 }]],
])

describe('dictionary', () => {
  it('assigns one status per event in the spec order', () => {
    const byName = Object.fromEntries(buildDictionary({ catalog: cat, observed, recent }).map((e) => [e.name, e.status]))
    expect(byName).toEqual({
      typo_evnt: 'unknown',
      today_only: 'unknown',
      never_sent: 'missing',
      only_android: 'undocumented',
      both_needed: 'ok',
      purchase_done: 'ok',
      screen_view: 'ok',
      app_remove: 'ok',
    })
  })
  it('marks a partial platform and lists what is missing', () => {
    const e = buildDictionary({ catalog: cat, observed, recent: new Map() }).find((x) => x.name === 'both_needed')!
    expect(e.status).toBe('partial')
    expect(e.missingPlatforms).toEqual(['iOS'])
  })
  it('flags events seen only in the last 30 minutes', () => {
    const e = buildDictionary({ catalog: cat, observed, recent }).find((x) => x.name === 'today_only')!
    expect(e).toMatchObject({ recentOnly: true, count: 0, catalog: null, label: 'today_only' })
  })
  it('does not judge arrival without period observation', () => {
    const entries = buildDictionary({ catalog: cat, observed: null, recent })
    expect(entries.map((e) => e.name).sort()).toEqual(cat.map((e) => e.name).sort())
    expect(new Set(entries.map((e) => e.status))).toEqual(new Set(['undocumented', 'ok']))
    expect(entries.every((e) => e.count === null)).toBe(true)
  })
  it('judges with period data alone when recent is missing', () => {
    const e = buildDictionary({ catalog: cat, observed, recent: null }).find((x) => x.name === 'both_needed')!
    expect(e.status).toBe('partial')
  })
  it('uses the name when the label is empty', () => {
    expect(buildDictionary({ catalog: cat, observed, recent }).find((x) => x.name === 'never_sent')!.label).toBe('never_sent')
  })
  it('sorts problems first, then by count, then by name', () => {
    const names = buildDictionary({ catalog: cat, observed, recent }).map((e) => e.name)
    expect(names.indexOf('typo_evnt')).toBeLessThan(names.indexOf('screen_view'))
    expect(names.slice(-1)).toEqual(['app_remove'])
  })
  it('counts statuses and hides the unknowable ones before observation', () => {
    const entries = buildDictionary({ catalog: cat, observed, recent })
    expect(statusCounts(entries, true)).toEqual({ all: 8, unknown: 2, missing: 1, partial: 0, undocumented: 1 })
    expect(statusCounts(buildDictionary({ catalog: cat, observed: null, recent: null }), false)).toEqual({
      all: 6,
      unknown: null,
      missing: null,
      partial: null,
      undocumented: 1,
    })
  })
  it('parses the status param', () => {
    expect(parseStatus('unknown')).toBe('unknown')
    expect(parseStatus('ok')).toBeNull()
    expect(parseStatus('nope')).toBeNull()
    expect(parseStatus('toString')).toBeNull()
    expect(parseStatus(null)).toBeNull()
  })
  it('filters by status and searches name, label, description and param names literally', () => {
    const entries = buildDictionary({ catalog: cat, observed, recent })
    expect(filterEntries(entries, { q: '', status: 'unknown' }).map((e) => e.name).sort()).toEqual(['today_only', 'typo_evnt'])
    expect(filterEntries(entries, { q: 'ITEM_ID', status: null }).map((e) => e.name)).toEqual(['purchase_done'])
    expect(filterEntries(entries, { q: '구매가', status: null }).map((e) => e.name)).toEqual(['purchase_done'])
    expect(() => filterEntries(entries, { q: '([\\.', status: null })).not.toThrow()
    expect(filterEntries(entries, { q: '(', status: null })).toEqual([])
  })
  it('handles event names that collide with object keys', () => {
    const o: Observed = new Map([['toString', { count: 1, users: 1, byPlatform: [p('Android', 1, 1)] }]])
    const e = buildDictionary({ catalog: [], observed: o, recent: null })
    expect(e).toHaveLength(1)
    expect(e[0]).toMatchObject({ name: 'toString', status: 'unknown' })
    const c: CatalogEvent = { name: 'constructor', label: '', description: 'x', kind: 'app', params: [] }
    expect(buildDictionary({ catalog: [c], observed: new Map(), recent: new Map() })[0]).toMatchObject({
      name: 'constructor',
      status: 'missing',
    })
  })
  it('writes the catalog snippet', () => {
    expect(catalogSnippet('purchase_done')).toBe("{ name: 'purchase_done', label: '', description: '', kind: 'app', params: [] },")
  })
  it('finds GA params that no catalog event lists', () => {
    const ga: GaParam[] = [
      { name: 'item_id', uiName: '', description: '', kind: 'dimension' },
      { name: 'price', uiName: '', description: '', kind: 'metric' },
    ]
    expect(unlistedParams(ga, cat)).toEqual(new Set(['price']))
  })
  it('builds CSV rows', () => {
    const rows = toCsvRows(buildDictionary({ catalog: cat, observed, recent }))
    expect(rows.find((r) => r[0] === 'purchase_done')).toEqual([
      'purchase_done',
      '구매 완료',
      '앱 정의',
      '정상',
      41,
      15,
      '구매가 끝나면 기록돼요.',
      'item_id',
    ])
    expect(rows.find((r) => r[0] === 'typo_evnt')!.slice(1, 4)).toEqual(['typo_evnt', '', '사전에 없음'])
    const before = toCsvRows(buildDictionary({ catalog: cat, observed: null, recent: null }))
    expect(before.find((r) => r[0] === 'screen_view')!.slice(2, 6)).toEqual(['자동 수집', '정상', '', ''])
  })
})
