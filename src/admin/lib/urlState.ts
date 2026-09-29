import type { Period, PresetId } from './period'

export type MenuId = 'overview' | 'users' | 'events' | 'retention' | 'tech' | 'realtime'
export type UrlState = { menu: MenuId; period: Period }

const MENUS: readonly MenuId[] = ['overview', 'users', 'events', 'retention', 'tech', 'realtime']
const PRESETS: readonly PresetId[] = ['7d', '28d', '90d']
const YMD = /^\d{4}-\d{2}-\d{2}$/

function isRealDate(ymd: string): boolean {
  if (!YMD.test(ymd)) return false
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search)
  const menuParam = params.get('menu')
  const menu = MENUS.find((m) => m === menuParam) ?? 'overview'

  const start = params.get('start')
  const end = params.get('end')
  if (start && end && isRealDate(start) && isRealDate(end)) {
    return { menu, period: { kind: 'custom', start, end } }
  }
  const preset = PRESETS.find((p) => p === params.get('period')) ?? '7d'
  return { menu, period: { kind: 'preset', preset } }
}

export function toSearch(state: UrlState): string {
  const { menu, period } = state
  return period.kind === 'preset'
    ? `?menu=${menu}&period=${period.preset}`
    : `?menu=${menu}&start=${period.start}&end=${period.end}`
}
