import { useQuery } from '@tanstack/react-query'
import { buildEventsRequest, parseEvents } from '../ga/reports/events'
import { buildOverviewRequests, parseOverview } from '../ga/reports/overview'
import { buildRealtimeRequests } from '../ga/reports/realtime'
import { buildUsersRequests, parseUsers } from '../ga/reports/users'
import { toRows } from '../ga/reports/common'
import { useGa } from './useGa'

/** Totals, averages and daily trend for 한눈에 보기 — one batchRunReports call. */
export function useOverview() {
  const { client, ranges } = useGa()
  return useQuery({
    queryKey: ['overview', ranges],
    queryFn: async () => parseOverview((await client.batchRunReports(buildOverviewRequests(ranges!))).reports),
    enabled: ranges !== null,
  })
}

/** DAU/WAU/MAU trend and new-vs-returning for 사용자 — one batchRunReports call. */
export function useUsers() {
  const { client, ranges } = useGa()
  return useQuery({
    queryKey: ['users', ranges],
    queryFn: async () => parseUsers((await client.batchRunReports(buildUsersRequests(ranges!))).reports),
    enabled: ranges !== null,
  })
}

/** Top 10 events compared with the previous period. */
export function useEvents() {
  const { client, ranges } = useGa()
  return useQuery({
    queryKey: ['events', ranges],
    queryFn: async () => parseEvents(await client.runReport(buildEventsRequest(ranges!))),
    enabled: ranges !== null,
  })
}

/** People active in the last 30 minutes. Polls every minute while the tab is visible. */
export function useRealtimeTotal() {
  const { client } = useGa()
  return useQuery({
    queryKey: ['realtimeTotal'],
    queryFn: async () => {
      const rows = toRows(await client.runRealtimeReport(buildRealtimeRequests()[0]))
      return rows.reduce((sum, row) => sum + (row.mets.activeUsers ?? 0), 0)
    },
    staleTime: 0,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
}

type QueryLike = { data: unknown; isPending: boolean; error: unknown; refetch(): unknown }

/**
 * Adapts a query for CardState. A failed background refetch keeps the last good data on
 * screen, so the error only shows while there is nothing to show.
 */
export function cardQuery(q: QueryLike) {
  return { isPending: q.isPending, error: q.data === undefined ? q.error : null, refetch: () => void q.refetch() }
}
