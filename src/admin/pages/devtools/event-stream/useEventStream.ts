import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GaError } from '../../../ga/errors'
import { useGa } from '../../../hooks/useGa'
import { BASE_INTERVAL_MS, IDLE_AFTER_MS } from './config'
import { decidePoll, quotaShare, type PollDecision, type PollInput } from './pollPolicy'
import {
  buildStreamRequest, diffSnapshots, mergeHighlights, parseStream, type DimFilter, type Highlight, type StreamSnapshot,
} from './report'

export type EventStream = {
  snapshot: StreamSnapshot | undefined
  highlights: ReadonlyMap<string, Highlight>
  decision: PollDecision
  /** Before the first response. */
  isPending: boolean
  /** Set only while there is no table to show; null once a snapshot exists. */
  error: unknown
  paused: boolean
  setPaused(paused: boolean): void
  refreshNow(): void
}

// Highlights with the filter they were found under.
type Marks = DimFilter & { map: ReadonlyMap<string, Highlight> }
type PollState = Omit<PollInput, 'quotaShare'>

const NO_HIGHLIGHTS: ReadonlyMap<string, Highlight> = new Map()
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'scroll'] as const
// scroll does not bubble, so it is caught on the way down.
const activityOptions = (type: string) => ({ passive: true, capture: type === 'scroll' })

const isVisible = (): boolean => document.visibilityState !== 'hidden'
const sameDim = (a: DimFilter, b: DimFilter): boolean => a.platform === b.platform && a.version === b.version
const decide = (state: PollState, snapshot: StreamSnapshot | undefined): PollDecision =>
  decidePoll({ ...state, quotaShare: quotaShare(snapshot?.quota ?? null) })

export function useEventStream(dim: DimFilter): EventStream {
  const { client } = useGa()
  const [paused, setPausedState] = useState(false)
  const [visible, setVisible] = useState(isVisible)
  const [idle, setIdle] = useState(false)
  const [failures, setFailures] = useState(0)
  const [blocked, setBlocked] = useState<PollInput['blocked']>(null)
  const [marks, setMarks] = useState<Marks>({ ...dim, map: NO_HIGHLIGHTS })
  // The query drops its error and goes back to pending while a retry runs; this keeps the error shown.
  const [lastError, setLastError] = useState<unknown>(null)
  // A change found under another filter would sit next to this filter's numbers.
  if (!sameDim(marks, dim)) setMarks({ platform: dim.platform, version: dim.version, map: NO_HIGHLIGHTS })

  const state = useMemo<PollState>(
    () => ({ visible, paused, idleMs: idle ? IDLE_AFTER_MS + 1 : 0, failures, blocked }),
    [visible, paused, idle, failures, blocked],
  )

  const { data: snapshot, error, errorUpdateCount, isPending, refetch } = useQuery({
    queryKey: ['event-stream'],
    queryFn: async () => parseStream(await client.runRealtimeReport(buildStreamRequest()), Date.now()),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    // Coming back online must not send a request the poll policy did not ask for.
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
    // The quota share comes from this query's own data, so the decision is taken here.
    refetchInterval: (query) => decide(state, query.state.data).intervalMs ?? false,
  })
  const decision = useMemo(() => decide(state, snapshot), [state, snapshot])
  // Joins a request already in flight instead of sending a second one.
  const fetchNow = useCallback(() => void refetch({ cancelRefetch: false }), [refetch])

  // What the document listeners and callbacks below read; they outlive a render.
  const latest = useRef({ state, snapshot, dim, marks })
  useEffect(() => {
    latest.current = { state, snapshot, dim, marks }
  })
  /** Whether polling would run with `change` applied to the current state. */
  const wouldPoll = useCallback((change: Partial<PollState>): boolean => {
    const { state, snapshot } = latest.current
    return decide({ ...state, ...change }, snapshot).intervalMs !== null
  }, [])

  // Success: results already there at mount are neither handled nor used as a baseline.
  const seen = useRef(snapshot)
  const baseline = useRef<StreamSnapshot | null>(null)
  useEffect(() => {
    if (!snapshot || snapshot === seen.current) return
    seen.current = snapshot
    const { dim: now, state: poll, marks: current } = latest.current
    const changes = diffSnapshots(baseline.current, snapshot, now)
    baseline.current = snapshot
    // Set only what changes: a quiet poll must not render a second time.
    if (poll.failures !== 0) setFailures(0)
    if (poll.blocked !== null) setBlocked(null)
    if (changes.size > 0 || current.map.size > 0) {
      setMarks({ platform: now.platform, version: now.version, map: mergeHighlights(current.map, changes, snapshot.fetchedAt) })
    }
  }, [snapshot])

  // Failure: only network and server errors back off; auth and forbidden are the shell's to handle.
  const seenErrors = useRef(errorUpdateCount)
  useEffect(() => {
    if (errorUpdateCount === seenErrors.current) return
    seenErrors.current = errorUpdateCount
    setLastError(error)
    const kind = error instanceof GaError ? error.kind : null
    if (kind === 'network' || kind === 'server') setFailures((n) => n + 1)
    else if (kind === 'quota' || kind === 'bad_request') setBlocked(kind)
  }, [errorUpdateCount, error])

  useEffect(() => {
    const onVisibility = () => {
      const now = isVisible()
      setVisible(now)
      if (now && !latest.current.state.visible && wouldPoll({ visible: true })) fetchNow()
    }
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [fetchNow, wouldPoll])

  // One timer, re-armed on each activity; only crossing into or out of idle renders.
  const idleNow = useRef(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        idleNow.current = true
        setIdle(true)
      }, IDLE_AFTER_MS + 1)
    }
    const onActivity = () => {
      arm()
      if (!idleNow.current) return
      idleNow.current = false
      setIdle(false)
      const fetchedAt = latest.current.snapshot?.fetchedAt
      const old = fetchedAt === undefined || Date.now() - fetchedAt > BASE_INTERVAL_MS
      if (old && wouldPoll({ idleMs: 0 })) fetchNow()
    }
    arm()
    for (const type of ACTIVITY_EVENTS) document.addEventListener(type, onActivity, activityOptions(type))
    return () => {
      clearTimeout(timer)
      for (const type of ACTIVITY_EVENTS) document.removeEventListener(type, onActivity, activityOptions(type))
    }
  }, [fetchNow, wouldPoll])

  const setPaused = useCallback(
    (next: boolean) => {
      setPausedState(next)
      // Resuming always fetches once, even while an error keeps polling stopped.
      if (!next && latest.current.state.paused) fetchNow()
    },
    [fetchNow],
  )

  return {
    snapshot,
    highlights: marks.map,
    decision,
    isPending: isPending && lastError === null,
    error: snapshot ? null : (error ?? lastError),
    paused,
    setPaused,
    refreshNow: fetchNow,
  }
}
