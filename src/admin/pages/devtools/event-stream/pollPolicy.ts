import type { PropertyQuota } from '../../../ga/types'
import {
  BASE_INTERVAL_MS, IDLE_AFTER_MS, MAX_BACKOFF_MS, REALTIME_LIMITS, SAVING_INTERVAL_MS, SHARE_SAVING, SHARE_SLOW,
  SHARE_STOP, SLOW_INTERVAL_MS,
} from './config'

export type PollReason =
  | 'paused' | 'hidden' | 'quota_exhausted' | 'bad_request' | 'quota_stop'
  | 'retrying' | 'quota_slow' | 'idle' | 'quota_saving' | 'normal'

export type PollInput = {
  quotaShare: number | null
  visible: boolean
  paused: boolean
  idleMs: number
  failures: number
  blocked: 'quota' | 'bad_request' | null
}

export type PollDecision = { intervalMs: number | null; reason: PollReason }

const LIMIT_KEYS = ['tokensPerHour', 'tokensPerProjectPerHour', 'tokensPerDay'] as const

// Smallest remaining share across the realtime limits; null until the first response.
export function quotaShare(q: PropertyQuota | null): number | null {
  if (!q) return null
  let share = 1
  for (const key of LIMIT_KEYS) {
    const status = q[key]
    if (!status) continue
    share = Math.min(share, Math.min(1, Math.max(0, status.remaining / REALTIME_LIMITS[key])))
  }
  return share
}

export function decidePoll(input: PollInput): PollDecision {
  const { quotaShare: share, visible, paused, idleMs, failures, blocked } = input
  if (paused) return { intervalMs: null, reason: 'paused' }
  if (!visible) return { intervalMs: null, reason: 'hidden' }
  if (blocked === 'quota') return { intervalMs: null, reason: 'quota_exhausted' }
  if (blocked === 'bad_request') return { intervalMs: null, reason: 'bad_request' }
  if (share !== null && share < SHARE_STOP) return { intervalMs: null, reason: 'quota_stop' }

  let base: PollDecision
  if (share !== null && share < SHARE_SLOW) base = { intervalMs: SLOW_INTERVAL_MS, reason: 'quota_slow' }
  else if (idleMs > IDLE_AFTER_MS) base = { intervalMs: SLOW_INTERVAL_MS, reason: 'idle' }
  else if (share !== null && share < SHARE_SAVING) base = { intervalMs: SAVING_INTERVAL_MS, reason: 'quota_saving' }
  else base = { intervalMs: BASE_INTERVAL_MS, reason: 'normal' }

  if (failures > 0) {
    const backoff = BASE_INTERVAL_MS * 2 ** failures
    return { intervalMs: Math.min(MAX_BACKOFF_MS, Math.max(base.intervalMs!, backoff)), reason: 'retrying' }
  }
  return base
}

export function reasonText(d: PollDecision): string {
  const seconds = d.intervalMs === null ? 0 : d.intervalMs / 1000
  switch (d.reason) {
    case 'paused': return '일시정지했어요'
    case 'hidden': return ''
    case 'quota_exhausted': return '실시간 조회 한도를 다 써서 자동 갱신을 멈췄어요. 한 시간쯤 뒤에 다시 시도해 주세요.'
    case 'bad_request': return '불러오지 못했어요. 자동 갱신을 멈췄어요.'
    case 'quota_stop': return '실시간 조회 한도가 거의 남지 않아서 자동 갱신을 멈췄어요'
    case 'retrying': return '불러오지 못해서 다시 시도하고 있어요'
    case 'quota_slow': return '실시간 조회 한도가 얼마 남지 않아서 1분마다 갱신해요'
    case 'idle': return '한동안 조작이 없어서 1분마다 갱신해요'
    case 'quota_saving': return `실시간 조회 한도를 아끼려고 ${seconds}초마다 갱신해요`
    case 'normal': return `${seconds}초마다 갱신 중`
  }
}
