import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import type { Period } from '../lib/period'
import { parseUrlState, RESERVED_PARAMS, toSearch, type MenuId, type UrlState } from '../lib/urlState'
import { REGISTRY, type MenuLookup } from './registry'

export type NavValue = {
  menu: MenuId
  period: Period
  setMenu(menu: MenuId): void
  setPeriod(period: Period): void
}

type ParamsValue = {
  pageParams: Readonly<Record<string, string>>
  setParam(key: string, value: string | null): void
}

const NavContext = createContext<NavValue | null>(null)
const ParamsContext = createContext<ParamsValue | null>(null)

function samePeriod(a: Period, b: Period): boolean {
  if (a.kind === 'preset') return b.kind === 'preset' && a.preset === b.preset
  return b.kind === 'custom' && a.start === b.start && a.end === b.end
}

/**
 * Owns menu, period and page params, and mirrors them into the URL. A menu change adds a
 * history entry (so the back button returns to the previous menu); period and page param
 * changes replace the current one. Setters are stable and read the latest state from a ref.
 */
export function NavProvider({
  lookup = REGISTRY.lookup,
  children,
}: {
  lookup?: MenuLookup
  children: ReactNode
}): ReactElement {
  const [state, setState] = useState<UrlState>(() => parseUrlState(window.location.search, lookup))
  const stateRef = useRef(state)
  const lookupRef = useRef(lookup)
  lookupRef.current = lookup

  // Record the next state, then sync React state. History calls stay out of updaters.
  const commit = useCallback((next: UrlState, mode: 'push' | 'replace') => {
    stateRef.current = next
    setState(next)
    const url = window.location.pathname + toSearch(next, lookupRef.current)
    if (mode === 'push') window.history.pushState(null, '', url)
    else window.history.replaceState(null, '', url)
  }, [])

  const setMenu = useCallback(
    (menu: MenuId) => {
      const cur = stateRef.current
      if (menu === cur.menu) return
      commit({ menu, period: cur.period, pageParams: {} }, 'push')
    },
    [commit],
  )

  const setPeriod = useCallback(
    (period: Period) => {
      const cur = stateRef.current
      if (samePeriod(period, cur.period)) return
      commit({ ...cur, period }, 'replace')
    },
    [commit],
  )

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const cur = stateRef.current
      const has = Object.hasOwn(cur.pageParams, key)
      if (value === null ? !has : has && cur.pageParams[key] === value) return
      const pageParams = Object.fromEntries(
        Object.entries(cur.pageParams).filter(([k]) => k !== key || value !== null),
      )
      if (value !== null) pageParams[key] = value
      commit({ ...cur, pageParams }, 'replace')
    },
    [commit],
  )

  useEffect(() => {
    const onPopState = () => {
      const parsed = parseUrlState(window.location.search, lookupRef.current)
      const cur = stateRef.current
      // A menu without a period has no period in its URL; keep the one chosen in memory.
      const period = lookupRef.current.usesPeriod(parsed.menu) ? parsed.period : cur.period
      const next = { ...parsed, period }
      stateRef.current = next
      setState(next)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const nav = useMemo<NavValue>(
    () => ({ menu: state.menu, period: state.period, setMenu, setPeriod }),
    [state.menu, state.period, setMenu, setPeriod],
  )
  const params = useMemo<ParamsValue>(
    () => ({ pageParams: state.pageParams, setParam }),
    [state.pageParams, setParam],
  )

  return createElement(
    NavContext.Provider,
    { value: nav },
    createElement(ParamsContext.Provider, { value: params }, children),
  )
}

export function useNav(): NavValue {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNav must be used within NavProvider')
  return ctx
}

/** A page-owned URL param: [value or null, setter]. Passing null removes it. */
export function usePageParam(key: string): [string | null, (value: string | null) => void] {
  if (RESERVED_PARAMS.includes(key)) throw new Error(`"${key}" is reserved by the shell and cannot be a page param`)
  const ctx = useContext(ParamsContext)
  if (!ctx) throw new Error('usePageParam must be used within NavProvider')
  const { pageParams, setParam } = ctx
  const set = useCallback((value: string | null) => setParam(key, value), [setParam, key])
  return [Object.hasOwn(pageParams, key) ? pageParams[key] : null, set]
}
