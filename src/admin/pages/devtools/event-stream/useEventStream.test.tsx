import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, renderHook } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GaError } from '../../../ga/errors'
import type { RunReportResponse } from '../../../ga/types'
import stream from './__fixtures__/stream.json'
import { withExtra } from './__fixtures__/withExtra'
import type { DimFilter } from './report'
import { useEventStream } from './useEventStream'

const h = vi.hoisted(() => ({ client: {} as { runRealtimeReport: ReturnType<typeof vi.fn> } }))

vi.mock('../../../hooks/useGa', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../hooks/useGa')>()
  return { ...actual, useGa: () => ({ client: h.client }) }
})

const ALL: DimFilter = { platform: null, version: null }
const ACTIVITY = ['pointerdown', 'keydown', 'wheel', 'scroll'] as const

/** Moves fake time forward inside act; the extra millisecond runs TanStack Query's zero-delay notify timers. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
    await vi.advanceTimersByTimeAsync(1)
  })
}

function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
  })
}

function mount(options: { strict?: boolean; dim?: DimFilter } = {}) {
  // Like the real app: the client retries network and server errors unless the query opts out.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: (count, e) => e instanceof GaError && e.kind === 'network' && count < 1 } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => {
    const tree = <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    return options.strict ? <StrictMode>{tree}</StrictMode> : tree
  }
  return renderHook(({ dim }: { dim: DimFilter }) => useEventStream(dim), {
    wrapper,
    initialProps: { dim: options.dim ?? ALL },
  })
}

const calls = () => h.client.runRealtimeReport.mock.calls.length

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  h.client = { runRealtimeReport: vi.fn(async () => stream) }
})

afterEach(() => {
  Reflect.deleteProperty(document, 'visibilityState')
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useEventStream', () => {
  it('fetches on mount and then every 5 seconds', async () => {
    const { result } = mount()
    expect(result.current.isPending).toBe(true)
    await advance(0)
    expect(calls()).toBe(1)
    expect(result.current.isPending).toBe(false)
    expect(result.current.snapshot?.rows.length).toBe(7)
    expect(result.current.decision).toEqual({ intervalMs: 5000, reason: 'normal' })
    await advance(5000)
    expect(calls()).toBe(2)
    await advance(5000)
    expect(calls()).toBe(3)
  })

  it('slows to 15 seconds when under half the hourly quota is left', async () => {
    const low: RunReportResponse = { ...stream, propertyQuota: { tokensPerHour: { consumed: 3, remaining: 19_000 } } }
    h.client.runRealtimeReport.mockResolvedValue(low)
    const { result } = mount()
    await advance(0)
    expect(result.current.decision).toEqual({ intervalMs: 15_000, reason: 'quota_saving' })
    await advance(5000)
    expect(calls()).toBe(1)
    await advance(10_000)
    expect(calls()).toBe(2)
  })

  it('stops when paused, still fetches on refreshNow, and fetches at once on resume', async () => {
    const { result } = mount()
    await advance(0)
    act(() => result.current.setPaused(true))
    expect(result.current.paused).toBe(true)
    expect(result.current.decision).toEqual({ intervalMs: null, reason: 'paused' })
    await advance(10_000)
    expect(calls()).toBe(1)

    act(() => result.current.refreshNow())
    await advance(0)
    expect(calls()).toBe(2)

    act(() => result.current.setPaused(false))
    await advance(0)
    expect(calls()).toBe(3)
    expect(result.current.paused).toBe(false)
    await advance(4000)
    expect(calls()).toBe(3)
    await advance(1000)
    expect(calls()).toBe(4)
  })

  it('fetches once on resume even when a quota error has stopped polling', async () => {
    const { result } = mount()
    await advance(0)
    act(() => result.current.setPaused(true))
    h.client.runRealtimeReport.mockRejectedValueOnce(new GaError('quota'))
    act(() => result.current.refreshNow())
    await advance(0)
    expect(calls()).toBe(2)

    h.client.runRealtimeReport.mockRejectedValueOnce(new GaError('quota'))
    act(() => result.current.setPaused(false))
    await advance(0)
    expect(calls()).toBe(3)
    expect(result.current.decision).toEqual({ intervalMs: null, reason: 'quota_exhausted' })
    await advance(60_000)
    expect(calls()).toBe(3)
  })

  it('does not fetch when the browser comes back online while paused', async () => {
    const { result } = mount()
    await advance(0)
    act(() => result.current.setPaused(true))
    act(() => onlineManager.setOnline(false))
    act(() => onlineManager.setOnline(true))
    await advance(10_000)
    expect(calls()).toBe(1)
  })

  it('fetches once on refreshNow while hidden', async () => {
    const { result } = mount()
    await advance(0)
    setVisibility('hidden')
    act(() => result.current.refreshNow())
    await advance(0)
    expect(calls()).toBe(2)
    await advance(30_000)
    expect(calls()).toBe(2)
  })

  it('stops while hidden and fetches at once when visible again', async () => {
    const { result } = mount()
    await advance(0)
    setVisibility('hidden')
    expect(result.current.decision).toEqual({ intervalMs: null, reason: 'hidden' })
    await advance(30_000)
    expect(calls()).toBe(1)

    setVisibility('visible')
    await advance(0)
    expect(calls()).toBe(2)
    expect(result.current.decision.reason).toBe('normal')
    await advance(5000)
    expect(calls()).toBe(3)
  })

  it('does not fetch on becoming visible while paused', async () => {
    const { result } = mount()
    await advance(0)
    act(() => result.current.setPaused(true))
    setVisibility('hidden')
    await advance(10_000)
    setVisibility('visible')
    await advance(10_000)
    expect(calls()).toBe(1)
    expect(result.current.decision.reason).toBe('paused')
  })

  it('backs off after network errors and recovers after a success', async () => {
    const { result } = mount()
    await advance(0)
    const first = result.current.snapshot
    h.client.runRealtimeReport.mockRejectedValueOnce(new GaError('network')).mockRejectedValueOnce(new GaError('network'))

    await advance(5000)
    // One request per poll: the client's default retry must not apply here.
    expect(calls()).toBe(2)
    expect(result.current.decision).toEqual({ intervalMs: 10_000, reason: 'retrying' })
    await advance(10_000)
    expect(calls()).toBe(3)
    expect(result.current.decision).toEqual({ intervalMs: 20_000, reason: 'retrying' })
    expect(result.current.error).toBeNull()
    expect(result.current.snapshot).toBe(first)

    await advance(19_000)
    expect(calls()).toBe(3)
    await advance(1000)
    expect(calls()).toBe(4)
    expect(result.current.decision).toEqual({ intervalMs: 5000, reason: 'normal' })
  })

  it('exposes the error only when there is no snapshot yet', async () => {
    const failure = new GaError('server')
    h.client.runRealtimeReport.mockRejectedValueOnce(failure)
    const { result } = mount()
    await advance(0)
    expect(result.current.error).toBe(failure)
    expect(result.current.isPending).toBe(false)
    expect(result.current.snapshot).toBeUndefined()
    expect(result.current.decision).toEqual({ intervalMs: 10_000, reason: 'retrying' })

    await advance(10_000)
    expect(calls()).toBe(2)
    expect(result.current.error).toBeNull()
    expect(result.current.snapshot).toBeDefined()
  })

  it('keeps the first-load error steady while a retry is in flight', async () => {
    const failure = new GaError('server')
    let resolve!: (res: RunReportResponse) => void
    h.client.runRealtimeReport
      .mockRejectedValueOnce(failure)
      .mockReturnValueOnce(new Promise<RunReportResponse>((r) => { resolve = r }))
    const { result } = mount()
    expect(result.current.isPending).toBe(true)
    await advance(0)
    expect(result.current.isPending).toBe(false)
    expect(result.current.error).toBe(failure)

    await advance(10_000)
    expect(calls()).toBe(2)
    expect(result.current.isPending).toBe(false)
    expect(result.current.error).toBe(failure)

    resolve(stream)
    await advance(0)
    expect(result.current.error).toBeNull()
    expect(result.current.isPending).toBe(false)
    expect(result.current.snapshot).toBeDefined()
  })

  it('stops on a quota error until a manual refresh succeeds', async () => {
    const { result } = mount()
    await advance(0)
    h.client.runRealtimeReport.mockRejectedValueOnce(new GaError('quota'))
    await advance(5000)
    expect(calls()).toBe(2)
    expect(result.current.decision).toEqual({ intervalMs: null, reason: 'quota_exhausted' })
    expect(result.current.error).toBeNull()
    await advance(60_000)
    expect(calls()).toBe(2)

    act(() => result.current.refreshNow())
    await advance(0)
    expect(calls()).toBe(3)
    expect(result.current.decision.reason).toBe('normal')
    await advance(5000)
    expect(calls()).toBe(4)
  })

  it('stops on bad_request', async () => {
    const { result } = mount()
    await advance(0)
    h.client.runRealtimeReport.mockRejectedValueOnce(new GaError('bad_request'))
    await advance(5000)
    expect(result.current.decision).toEqual({ intervalMs: null, reason: 'bad_request' })
    await advance(60_000)
    expect(calls()).toBe(2)
  })

  it('does not count auth errors as failures', async () => {
    const { result } = mount()
    await advance(0)
    h.client.runRealtimeReport.mockRejectedValueOnce(new GaError('auth'))
    await advance(5000)
    expect(calls()).toBe(2)
    expect(result.current.decision).toEqual({ intervalMs: 5000, reason: 'normal' })
  })

  it('ignores forbidden errors and errors that are not GaError', async () => {
    const { result } = mount()
    await advance(0)
    h.client.runRealtimeReport.mockRejectedValueOnce(new GaError('forbidden')).mockRejectedValueOnce(new Error('boom'))
    await advance(5000)
    expect(calls()).toBe(2)
    expect(result.current.decision).toEqual({ intervalMs: 5000, reason: 'normal' })
    await advance(5000)
    expect(calls()).toBe(3)
    expect(result.current.decision).toEqual({ intervalMs: 5000, reason: 'normal' })
    expect(result.current.error).toBeNull()
  })

  it('slows down after 10 idle minutes and catches up on activity when the data is old', async () => {
    const { result } = mount()
    await advance(600_001)
    expect(result.current.decision).toEqual({ intervalMs: 60_000, reason: 'idle' })
    const before = calls()
    await advance(30_000)
    expect(calls()).toBe(before)

    fireEvent.pointerDown(document.body)
    expect(result.current.decision.reason).toBe('normal')
    await advance(0)
    expect(calls()).toBe(before + 1)
    await advance(5000)
    expect(calls()).toBe(before + 2)
  })

  it('does not fetch on activity when the data is fresh', async () => {
    const { result } = mount()
    await advance(600_001)
    expect(result.current.decision.reason).toBe('idle')
    const before = calls()

    fireEvent.pointerDown(document.body)
    expect(result.current.decision.reason).toBe('normal')
    await advance(0)
    expect(calls()).toBe(before)
  })

  it('stays at the normal interval while there is activity', async () => {
    const { result } = mount()
    await advance(400_000)
    fireEvent.keyDown(document.body, { key: 'a' })
    await advance(400_000)
    expect(result.current.decision.reason).toBe('normal')
    await advance(200_001)
    expect(result.current.decision.reason).toBe('idle')
  })

  it('clears highlights when the filter changes', async () => {
    const { result, rerender } = mount()
    await advance(0)
    h.client.runRealtimeReport.mockResolvedValue(withExtra(stream, [['new_event', 0, 'Android', '1.5.0', 1]]))
    await advance(5000)
    expect(result.current.highlights.size).toBe(1)

    // Same filter in a new object keeps them.
    rerender({ dim: { platform: null, version: null } })
    expect(result.current.highlights.size).toBe(1)
    rerender({ dim: { platform: 'Android', version: null } })
    expect(result.current.highlights.size).toBe(0)
    // Going back does not bring them back.
    rerender({ dim: ALL })
    expect(result.current.highlights.size).toBe(0)
  })

  it('sends one request when a refresh is asked for while one is in flight', async () => {
    const { result } = mount()
    act(() => result.current.refreshNow())
    await advance(0)
    expect(calls()).toBe(1)
  })

  it('highlights events that appear or grow between polls, under the current filter', async () => {
    const { result } = mount({ dim: { platform: 'Android', version: null } })
    await advance(0)
    expect(result.current.highlights.size).toBe(0)

    h.client.runRealtimeReport.mockResolvedValue(
      withExtra(stream, [['screen_view', 0, 'iOS', '1.4.0', 2], ['new_event', 0, 'Android', '1.5.0', 1]]),
    )
    await advance(5000)
    const fetchedAt = result.current.snapshot!.fetchedAt
    expect(fetchedAt).toBeGreaterThan(0)
    expect(result.current.highlights.get('new_event')).toEqual({ kind: 'new', delta: 1, at: fetchedAt })
    // The iOS rows grew, but the filter is Android.
    expect(result.current.highlights.has('screen_view')).toBe(false)
  })

  it('marks a growing event as up and adds up changes across polls', async () => {
    const { result } = mount()
    await advance(0)
    h.client.runRealtimeReport.mockResolvedValue(
      withExtra(stream, [['screen_view', 0, 'iOS', '1.4.0', 2], ['new_event', 0, 'Android', '1.5.0', 1]]),
    )
    await advance(5000)
    const second = result.current.snapshot!.fetchedAt
    expect(result.current.highlights.get('screen_view')).toEqual({ kind: 'up', delta: 2, at: second })
    expect(result.current.highlights.get('new_event')).toEqual({ kind: 'new', delta: 1, at: second })

    h.client.runRealtimeReport.mockResolvedValue(
      withExtra(stream, [['screen_view', 0, 'iOS', '1.4.0', 5], ['new_event', 0, 'Android', '1.5.0', 3]]),
    )
    await advance(5000)
    const third = result.current.snapshot!.fetchedAt
    expect(third).toBeGreaterThan(second)
    expect(result.current.highlights.get('screen_view')).toEqual({ kind: 'up', delta: 5, at: third })
    expect(result.current.highlights.get('new_event')).toEqual({ kind: 'new', delta: 3, at: third })
  })

  it('runs one timer and one set of listeners under StrictMode and cleans up on unmount', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    const remove = vi.spyOn(document, 'removeEventListener')
    const { unmount } = mount({ strict: true })
    await advance(0)
    expect(calls()).toBe(1)
    await advance(5000)
    expect(calls()).toBe(2)

    // StrictMode attached twice and detached once: one live set.
    const types = ['visibilitychange', ...ACTIVITY]
    for (const type of types) {
      expect(add.mock.calls.filter(([t]) => t === type).length - remove.mock.calls.filter(([t]) => t === type).length).toBe(1)
    }
    for (const type of ACTIVITY) {
      const [, , options] = add.mock.calls.find(([t]) => t === type)!
      expect(options).toEqual({ passive: true, capture: type === 'scroll' })
    }

    unmount()
    for (const type of types) {
      const added = add.mock.calls.filter(([t]) => t === type)
      const removed = remove.mock.calls.filter(([t]) => t === type)
      expect(removed.length).toBe(added.length)
      // Each removal names the listener and capture flag it was added with.
      expect(removed.map(([, fn, o]) => [fn, typeof o === 'object' && o.capture === true])).toEqual(
        added.map(([, fn, o]) => [fn, typeof o === 'object' && o.capture === true]),
      )
    }
    await advance(700_000)
    expect(calls()).toBe(2)
    expect(vi.getTimerCount()).toBe(0)
  })
})
