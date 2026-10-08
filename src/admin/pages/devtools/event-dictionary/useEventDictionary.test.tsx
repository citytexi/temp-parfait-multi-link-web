import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GaError } from '../../../ga/errors'
import type { CatalogEvent } from '../../../ga/eventCatalog'
import metadata from './__fixtures__/metadata.json'
import observedFixture from './__fixtures__/observed.json'
import recentFixture from './__fixtures__/recent.json'
import { useEventDictionary } from './useEventDictionary'

const h = vi.hoisted(() => {
  const catalog: CatalogEvent[] = [
    { name: 'screen_view', label: '화면 조회', description: '화면을 볼 때 기록돼요.', kind: 'auto', params: [] },
    { name: 'app_remove', label: '앱 삭제', description: '앱을 지울 때 기록돼요.', kind: 'auto', params: [] },
    {
      name: 'purchase_done',
      label: '구매 완료',
      description: '구매가 끝나면 기록돼요.',
      kind: 'app',
      params: [{ name: 'item_id', type: 'string', description: '상품 ID' }],
    },
    { name: 'only_android', label: '안드로이드 전용', description: '', kind: 'app', params: [], platforms: ['Android'] },
    { name: 'both_needed', label: '둘 다', description: '둘 다 보내요.', kind: 'app', params: [] },
    { name: 'never_sent', label: '', description: '설명이 있어요.', kind: 'app', params: [] },
  ]
  return {
    catalog,
    ranges: null as { current: { startDate: string; endDate: string }; previous: { startDate: string; endDate: string }; days: number } | null,
    client: {} as {
      runReport: ReturnType<typeof vi.fn>
      runRealtimeReport: ReturnType<typeof vi.fn>
      getMetadata: ReturnType<typeof vi.fn>
    },
  }
})

vi.mock('../../../ga/eventCatalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../ga/eventCatalog')>()
  return {
    targetPlatforms: actual.targetPlatforms,
    ALL_PLATFORMS: actual.ALL_PLATFORMS,
    EVENT_CATALOG: h.catalog,
    findEvent: (name: string) => h.catalog.find((e) => e.name === name),
  }
})

vi.mock('../../../hooks/useGa', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../hooks/useGa')>()
  return { ...actual, useGa: () => ({ client: h.client, ranges: h.ranges }) }
})

const goodRanges = {
  current: { startDate: '2026-09-22', endDate: '2026-09-28' },
  previous: { startDate: '2026-09-15', endDate: '2026-09-21' },
  days: 7,
}

let queryClient: QueryClient
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  h.ranges = goodRanges
  h.client.runReport = vi.fn().mockResolvedValue(observedFixture)
  h.client.runRealtimeReport = vi.fn().mockResolvedValue(recentFixture)
  h.client.getMetadata = vi.fn().mockResolvedValue(metadata)
})

describe('useEventDictionary', () => {
  it('starts pending with catalogue entries only, then becomes ready with observed counts', async () => {
    const { result } = renderHook(() => useEventDictionary(), { wrapper })
    expect(result.current.observed).toBe('pending')
    expect(result.current.entries).toHaveLength(6)
    expect(result.current.entries.every((e) => e.count === null)).toBe(true)

    await waitFor(() => expect(result.current.observed).toBe('ready'))
    await waitFor(() => expect(result.current.entries.some((e) => e.name === 'today_only')).toBe(true))
    expect(result.current.entries.find((e) => e.name === 'screen_view')!.count).toBe(160)
  })

  it('reports an observation error and retries', async () => {
    h.client.runReport = vi.fn().mockRejectedValueOnce(new GaError('server')).mockResolvedValue(observedFixture)
    const { result } = renderHook(() => useEventDictionary(), { wrapper })
    await waitFor(() => expect(result.current.observed).toBe('error'))
    expect(result.current.entries).toHaveLength(6)
    expect(h.client.runReport).toHaveBeenCalledTimes(1)

    act(() => result.current.retryObserved())
    await waitFor(() => expect(result.current.observed).toBe('ready'))
    expect(h.client.runReport).toHaveBeenCalledTimes(2)
  })

  it('does not query the period when it is invalid', async () => {
    h.ranges = null
    const { result } = renderHook(() => useEventDictionary(), { wrapper })
    expect(result.current.observed).toBe('invalid-period')
    expect(result.current.range).toBeNull()
    await waitFor(() => expect(h.client.runRealtimeReport).toHaveBeenCalled())
    await waitFor(() => expect(h.client.getMetadata).toHaveBeenCalled())
    expect(h.client.runReport).not.toHaveBeenCalled()
  })

  it('flags a failed recent check and still judges from the period', async () => {
    h.client.runRealtimeReport = vi.fn().mockRejectedValue(new GaError('server'))
    const { result } = renderHook(() => useEventDictionary(), { wrapper })
    await waitFor(() => expect(result.current.recentFailed).toBe(true))
    await waitFor(() => expect(result.current.observed).toBe('ready'))
    expect(result.current.range).toEqual(goodRanges.current)
    expect(result.current.entries.find((e) => e.name === 'both_needed')!.status).toBe('missing')
  })

  it('exposes registered params and an empty set when metadata fails', async () => {
    const ok = renderHook(() => useEventDictionary(), { wrapper })
    await waitFor(() => expect(ok.result.current.registeredParams.size).toBe(2))
    expect(ok.result.current.registeredParams).toEqual(new Set(['item_id', 'price']))
    ok.unmount()

    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    h.client.getMetadata = vi.fn().mockRejectedValue(new GaError('server'))
    const bad = renderHook(() => useEventDictionary(), { wrapper })
    await waitFor(() => expect(bad.result.current.params.error).toBeTruthy())
    expect(bad.result.current.registeredParams.size).toBe(0)
  })

  it('uses menu-prefixed query keys', async () => {
    const { result } = renderHook(() => useEventDictionary(), { wrapper })
    await waitFor(() => expect(result.current.observed).toBe('ready'))
    await waitFor(() => expect(result.current.registeredParams.size).toBe(2))
    const all = queryClient.getQueryCache().getAll()
    expect(all).toHaveLength(3)
    expect(all.every((q) => q.queryKey[0] === 'event-dictionary')).toBe(true)
  })
})
