export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0초'
  const total = Math.floor(sec)
  if (total < 60) return `${total}초`
  if (total < 3600) {
    const m = Math.floor(total / 60)
    const s = total % 60
    return s === 0 ? `${m}분` : `${m}분 ${s}초`
  }
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

export type Delta = {
  ratio: number | null
  text: string
  tone: 'up' | 'down' | 'flat' | 'none'
}

export function computeDelta(current: number, previous: number): Delta {
  if (previous === 0) return { ratio: null, text: '비교 불가', tone: 'none' }
  const ratio = (current - previous) / previous
  const percent = Math.round(Math.abs(ratio) * 100)
  if (percent === 0) return { ratio, text: '변화 없음', tone: 'flat' }
  return ratio > 0
    ? { ratio, text: `▲ ${percent}%`, tone: 'up' }
    : { ratio, text: `▼ ${percent}%`, tone: 'down' }
}

/** GA `date` dimension ('YYYYMMDD') → 'MM.DD' for chart axes. */
export function formatShortDate(gaDate: string): string {
  return /^\d{8}$/.test(gaDate) ? `${gaDate.slice(4, 6)}.${gaDate.slice(6, 8)}` : gaDate
}
