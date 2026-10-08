import { describe, expect, it } from 'vitest'
import { decidePoll, quotaShare, reasonText, type PollInput, type PollReason } from './pollPolicy'

const ok: PollInput = { quotaShare: 1, visible: true, paused: false, idleMs: 0, failures: 0, blocked: null }

describe('decidePoll', () => {
  it.each<[string, Partial<PollInput>, number | null, PollReason]>([
    ['normal', {}, 5000, 'normal'],
    ['unknown quota', { quotaShare: null }, 5000, 'normal'],
    ['paused', { paused: true }, null, 'paused'],
    ['paused beats hidden', { paused: true, visible: false }, null, 'paused'],
    ['hidden', { visible: false }, null, 'hidden'],
    ['quota error', { blocked: 'quota' }, null, 'quota_exhausted'],
    ['bad request', { blocked: 'bad_request' }, null, 'bad_request'],
    ['below 5%', { quotaShare: 0.049 }, null, 'quota_stop'],
    ['exactly 5%', { quotaShare: 0.05 }, 60000, 'quota_slow'],
    ['below 20%', { quotaShare: 0.199 }, 60000, 'quota_slow'],
    ['exactly 20%', { quotaShare: 0.2 }, 15000, 'quota_saving'],
    ['below 50%', { quotaShare: 0.499 }, 15000, 'quota_saving'],
    ['exactly 50%', { quotaShare: 0.5 }, 5000, 'normal'],
    ['idle for 10 minutes exactly', { idleMs: 600_000 }, 5000, 'normal'],
    ['idle beyond 10 minutes', { idleMs: 600_001 }, 60000, 'idle'],
    ['low quota beats idle', { quotaShare: 0.1, idleMs: 700_000 }, 60000, 'quota_slow'],
    ['idle beats saving', { quotaShare: 0.4, idleMs: 700_000 }, 60000, 'idle'],
    ['one failure', { failures: 1 }, 10000, 'retrying'],
    ['three failures', { failures: 3 }, 40000, 'retrying'],
    ['backoff is capped', { failures: 9 }, 60000, 'retrying'],
    ['a failure never speeds up a slow interval', { failures: 1, quotaShare: 0.1 }, 60000, 'retrying'],
    ['a failure while saving', { failures: 1, quotaShare: 0.4 }, 15000, 'retrying'],
    ['stop beats failures', { failures: 2, quotaShare: 0.01 }, null, 'quota_stop'],
  ])('%s', (_name, patch, intervalMs, reason) => {
    expect(decidePoll({ ...ok, ...patch })).toEqual({ intervalMs, reason })
  })
})

describe('quotaShare', () => {
  it('takes the tightest of the three limits', () => {
    expect(quotaShare(null)).toBeNull()
    expect(quotaShare({})).toBe(1)
    expect(quotaShare({ tokensPerHour: { consumed: 3, remaining: 20_000 } })).toBe(0.5)
    expect(quotaShare({
      tokensPerHour: { consumed: 3, remaining: 36_000 }, // 0.9
      tokensPerProjectPerHour: { consumed: 3, remaining: 1_400 }, // 0.1
      tokensPerDay: { consumed: 3, remaining: 100_000 }, // 0.5
    })).toBeCloseTo(0.1)
    // consumed is what one request spent, so it plays no part
    expect(quotaShare({ tokensPerDay: { consumed: 50_000, remaining: 150_000 } })).toBe(0.75)
    expect(quotaShare({ tokensPerDay: { consumed: 0, remaining: 999_999 } })).toBe(1)
  })
})

describe('reasonText', () => {
  it('words every reason', () => {
    expect(reasonText({ intervalMs: 5000, reason: 'normal' })).toBe('5초마다 갱신 중')
    expect(reasonText({ intervalMs: null, reason: 'paused' })).toBe('일시정지했어요')
    expect(reasonText({ intervalMs: null, reason: 'hidden' })).toBe('')
    expect(reasonText({ intervalMs: null, reason: 'quota_exhausted' })).toBe('실시간 조회 한도를 다 써서 자동 갱신을 멈췄어요. 한 시간쯤 뒤에 다시 시도해 주세요.')
    expect(reasonText({ intervalMs: null, reason: 'bad_request' })).toBe('불러오지 못했어요. 자동 갱신을 멈췄어요.')
    expect(reasonText({ intervalMs: null, reason: 'quota_stop' })).toBe('실시간 조회 한도가 거의 남지 않아서 자동 갱신을 멈췄어요')
    expect(reasonText({ intervalMs: 10000, reason: 'retrying' })).toBe('불러오지 못해서 다시 시도하고 있어요')
    expect(reasonText({ intervalMs: 60000, reason: 'quota_slow' })).toBe('실시간 조회 한도가 얼마 남지 않아서 1분마다 갱신해요')
    expect(reasonText({ intervalMs: 60000, reason: 'idle' })).toBe('한동안 조작이 없어서 1분마다 갱신해요')
    expect(reasonText({ intervalMs: 15000, reason: 'quota_saving' })).toBe('실시간 조회 한도를 아끼려고 15초마다 갱신해요')
  })
})
