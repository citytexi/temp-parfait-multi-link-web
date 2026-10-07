import type { MenuLookup } from '../menu/registry'
import type { Period, PresetId } from './period'

export type MenuId = string
export type UrlState = { menu: MenuId; period: Period; pageParams: Readonly<Record<string, string>> }

/** Params owned by the shell; every other param belongs to the page. */
export const RESERVED_PARAMS: readonly string[] = ['menu', 'period', 'start', 'end']
const PRESETS: readonly PresetId[] = ['7d', '28d', '90d']
const YMD = /^\d{4}-\d{2}-\d{2}$/

function isRealDate(ymd: string): boolean {
  if (!YMD.test(ymd)) return false
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export function parseUrlState(search: string, lookup: MenuLookup): UrlState {
  const params = new URLSearchParams(search)
  const menuParam = params.get('menu')
  const menu = menuParam !== null && lookup.isMenu(menuParam) ? menuParam : lookup.defaultMenu

  const pageParams = new Map<string, string>()
  for (const [key, value] of params) {
    if (!RESERVED_PARAMS.includes(key) && !pageParams.has(key)) pageParams.set(key, value)
  }
  const rest = { pageParams: Object.fromEntries(pageParams) }

  const start = params.get('start')
  const end = params.get('end')
  if (start && end && isRealDate(start) && isRealDate(end)) {
    return { menu, period: { kind: 'custom', start, end }, ...rest }
  }
  const preset = PRESETS.find((p) => p === params.get('period')) ?? '7d'
  return { menu, period: { kind: 'preset', preset }, ...rest }
}

export function toSearch(state: UrlState, lookup: MenuLookup): string {
  const { menu, period, pageParams } = state
  const parts = [`menu=${encodeURIComponent(menu)}`]
  if (lookup.usesPeriod(menu)) {
    parts.push(
      period.kind === 'preset'
        ? `period=${period.preset}`
        : `start=${period.start}&end=${period.end}`,
    )
  }
  for (const [key, value] of Object.entries(pageParams)) {
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
  }
  return `?${parts.join('&')}`
}
