export type PresetId = '7d' | '28d' | '90d'
export type Period =
  | { kind: 'preset'; preset: PresetId }
  | { kind: 'custom'; start: string; end: string }
export type DateRange = { startDate: string; endDate: string }

const PRESET_DAYS: Record<PresetId, number> = { '7d': 7, '28d': 28, '90d': 90 }
const DAY_MS = 86_400_000

const toUtc = (ymd: string): number => {
  const [y, m, d] = ymd.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const fromUtc = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
const addDays = (ymd: string, n: number): string => fromUtc(toUtc(ymd) + n * DAY_MS)
const inclusiveDays = (start: string, end: string): number =>
  Math.round((toUtc(end) - toUtc(start)) / DAY_MS) + 1

export function seoulToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now)
}

export function resolveRanges(
  period: Period,
  today: string,
): { current: DateRange; previous: DateRange; days: number } {
  let startDate: string
  let endDate: string
  if (period.kind === 'preset') {
    endDate = addDays(today, -1)
    startDate = addDays(endDate, -(PRESET_DAYS[period.preset] - 1))
  } else {
    startDate = period.start
    endDate = period.end
  }
  const days = inclusiveDays(startDate, endDate)
  return {
    current: { startDate, endDate },
    previous: { startDate: addDays(startDate, -days), endDate: addDays(startDate, -1) },
    days,
  }
}

export function validatePeriod(period: Period, today: string): string | null {
  if (period.kind === 'preset') return null
  if (period.start > period.end) return '시작일이 종료일보다 늦어요'
  if (period.end >= today) return '종료일은 어제까지 고를 수 있어요'
  if (inclusiveDays(period.start, period.end) > 366) return '최대 366일까지 볼 수 있어요'
  return null
}

export function periodLabel(period: Period): string {
  if (period.kind === 'preset') return `최근 ${PRESET_DAYS[period.preset]}일`
  const dot = (ymd: string) => ymd.replaceAll('-', '.')
  return `${dot(period.start)} ~ ${dot(period.end)}`
}
