import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { EVENT_CATALOG } from '../../../ga/eventCatalog'
import { useGa } from '../../../hooks/useGa'
import { buildDictionary, type DictionaryEntry } from './dictionary'
import {
  buildObservedRequest,
  buildRecentRequest,
  parseMetadata,
  parseObserved,
  parseRecent,
  type GaParam,
} from './report'

export type EventDictionary = {
  entries: DictionaryEntry[]
  observed: 'pending' | 'error' | 'ready' | 'invalid-period'
  recentFailed: boolean
  retryObserved(): void
  range: { startDate: string; endDate: string } | null
  params: { data: GaParam[] | undefined; isPending: boolean; error: unknown; refetch(): void }
  /** Parameter names registered in GA; empty when metadata could not be loaded. */
  registeredParams: ReadonlySet<string>
}

const NO_PARAMS: ReadonlySet<string> = new Set()

export function useEventDictionary(): EventDictionary {
  const { client, ranges } = useGa()

  const observedQuery = useQuery({
    queryKey: ['event-dictionary', 'observed', ranges],
    queryFn: async () => parseObserved(await client.runReport(buildObservedRequest(ranges!.current))),
    enabled: ranges !== null,
  })
  const recentQuery = useQuery({
    queryKey: ['event-dictionary', 'recent'],
    queryFn: async () => parseRecent(await client.runRealtimeReport(buildRecentRequest())),
    staleTime: 60_000,
  })
  const metadataQuery = useQuery({
    queryKey: ['event-dictionary', 'metadata'],
    queryFn: async () => parseMetadata(await client.getMetadata()),
    staleTime: Infinity,
    gcTime: Infinity,
  })

  // Hold the verdict until today's check settles, so statuses do not flip when it arrives.
  const recentSettled = recentQuery.isSuccess || recentQuery.isError
  const hasPeriodData = observedQuery.data !== undefined
  const observed: EventDictionary['observed'] =
    ranges === null
      ? 'invalid-period'
      : hasPeriodData
        ? recentSettled
          ? 'ready'
          : 'pending'
        : observedQuery.isError
          ? 'error'
          : 'pending'

  const observedData = observed === 'ready' ? (observedQuery.data ?? null) : null
  const recentData = recentQuery.data ?? null

  const entries = useMemo(
    () => buildDictionary({ catalog: EVENT_CATALOG, observed: observedData, recent: recentData }),
    [observedData, recentData],
  )

  const metadataData = metadataQuery.data
  const registeredParams = useMemo<ReadonlySet<string>>(
    () => (metadataData ? new Set(metadataData.map((p) => p.name)) : NO_PARAMS),
    [metadataData],
  )

  return {
    entries,
    observed,
    recentFailed: recentQuery.isError,
    retryObserved: () => void observedQuery.refetch(),
    range: ranges?.current ?? null,
    params: {
      data: metadataData,
      isPending: metadataQuery.isPending,
      error: metadataQuery.error,
      refetch: () => void metadataQuery.refetch(),
    },
    registeredParams,
  }
}
