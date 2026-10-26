// Polling intervals and limits for the realtime event stream.
export const BASE_INTERVAL_MS = 5_000
export const SAVING_INTERVAL_MS = 15_000
export const SLOW_INTERVAL_MS = 60_000
export const MAX_BACKOFF_MS = 60_000
export const IDLE_AFTER_MS = 10 * 60_000

// Remaining-quota shares that switch the interval down, and stop polling.
export const SHARE_SAVING = 0.5
export const SHARE_SLOW = 0.2
export const SHARE_STOP = 0.05

export const REALTIME_LIMITS = {
  tokensPerHour: 40_000,
  tokensPerProjectPerHour: 14_000,
  tokensPerDay: 200_000,
} as const

export const HIGHLIGHT_TTL_MS = 60_000
export const BASELINE_MAX_AGE_MS = 90_000
export const ROW_LIMIT = 250_000
