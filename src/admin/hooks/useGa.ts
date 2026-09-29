import { createContext, createElement, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { GA_PROPERTY_ID } from '../config'
import { createGaClient, type GaClient } from '../ga/client'
import { isRetryable } from '../ga/errors'
import type { PropertyQuota } from '../ga/types'
import {
  periodLabel as toPeriodLabel,
  resolveRanges,
  seoulToday,
  validatePeriod,
  type DateRange,
  type Period,
} from '../lib/period'
import { parseUrlState, toSearch, type MenuId, type UrlState } from '../lib/urlState'

export type Ranges = { current: DateRange; previous: DateRange; days: number }

type GaValue = {
  client: GaClient
  /** null while the chosen period is invalid — pages pass `enabled: ranges !== null`. */
  ranges: Ranges | null
  periodLabel: string
  /** Seoul date (YYYY-MM-DD) fixed when the dashboard mounted. */
  today: string
  menu: MenuId
  period: Period
  periodError: string | null
  setMenu(menu: MenuId): void
  setPeriod(period: Period): void
}

/** Defaults for every GA query (set on the QueryClient). */
export const gaQueryDefaults = {
  staleTime: 10 * 60 * 1000,
  retry: (count: number, e: unknown) => isRetryable(e) && count < 1,
  refetchOnWindowFocus: false,
}

const GaContext = createContext<GaValue | null>(null)
const QuotaContext = createContext<number | null>(null)

function quotaPercent(q: PropertyQuota): number | null {
  const t = q.tokensPerDay
  if (!t) return null
  const total = t.consumed + t.remaining
  return total > 0 ? Math.round((t.remaining / total) * 100) : null
}

export function GaProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth()
  const [state, setState] = useState<UrlState>(() => parseUrlState(window.location.search))
  const [today] = useState(() => seoulToday(new Date()))
  const [quota, setQuota] = useState<number | null>(null)

  const client = useMemo(
    () =>
      createGaClient({
        propertyId: GA_PROPERTY_ID,
        getToken,
        onQuota: (q) => {
          const pct = quotaPercent(q)
          if (pct !== null) setQuota(pct)
        },
      }),
    [getToken],
  )

  const update = useCallback((next: UrlState) => {
    setState(next)
    window.history.replaceState(null, '', window.location.pathname + toSearch(next))
  }, [])

  const setMenu = useCallback((menu: MenuId) => update({ ...state, menu }), [state, update])
  const setPeriod = useCallback((period: Period) => update({ ...state, period }), [state, update])

  const value = useMemo<GaValue>(() => {
    const periodError = validatePeriod(state.period, today)
    return {
      client,
      ranges: periodError ? null : resolveRanges(state.period, today),
      periodLabel: toPeriodLabel(state.period),
      today,
      menu: state.menu,
      period: state.period,
      periodError,
      setMenu,
      setPeriod,
    }
  }, [client, state, today, setMenu, setPeriod])

  return createElement(
    GaContext.Provider,
    { value },
    createElement(QuotaContext.Provider, { value: quota }, children),
  )
}

export function useGa(): GaValue {
  const ctx = useContext(GaContext)
  if (!ctx) throw new Error('useGa must be used within GaProvider')
  return ctx
}

/** Remaining share (0–100) of today's GA quota, or null until the first response reports it. */
export function useQuota(): number | null {
  return useContext(QuotaContext)
}
