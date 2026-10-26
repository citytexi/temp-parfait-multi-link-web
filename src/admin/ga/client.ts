import { GaError, classifyStatus } from './errors'
import type {
  BatchRunReportsResponse,
  Metadata,
  PropertyQuota,
  RunRealtimeReportRequest,
  RunReportRequest,
  RunReportResponse,
} from './types'

const BASE_URL = 'https://analyticsdata.googleapis.com/v1beta/properties'

type Options = {
  propertyId: string
  getToken: () => string | null
  onQuota?: (q: PropertyQuota) => void
  fetchImpl?: typeof fetch
}

export function createGaClient(opts: Options) {
  const { propertyId, getToken, onQuota } = opts

  async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const token = getToken()
    if (!token) throw new GaError('auth', 'No access token')
    const doFetch = opts.fetchImpl ?? fetch

    let res: Response
    try {
      res = await doFetch(`${BASE_URL}/${propertyId}${path}`, {
        method,
        headers:
          method === 'GET'
            ? { Authorization: `Bearer ${token}` }
            : { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(body),
      })
    } catch (e) {
      throw new GaError('network', e instanceof Error ? e.message : 'Network error')
    }

    if (!res.ok) {
      let gaMessage: string | undefined
      let gaStatus: string | undefined
      try {
        const err = (await res.json())?.error
        if (typeof err?.message === 'string') gaMessage = err.message
        if (typeof err?.status === 'string') gaStatus = err.status
      } catch {
        // non-JSON error body: fall back to HTTP status
      }
      throw new GaError(classifyStatus(res.status, gaStatus), gaMessage ?? `HTTP ${res.status}`, res.status)
    }

    return (await res.json()) as T
  }

  return {
    async runReport(body: RunReportRequest): Promise<RunReportResponse> {
      const res = await request<RunReportResponse>('POST', ':runReport', { ...body, returnPropertyQuota: true })
      if (res.propertyQuota) onQuota?.(res.propertyQuota)
      return res
    },
    async batchRunReports(requests: RunReportRequest[]): Promise<BatchRunReportsResponse> {
      const res = await request<BatchRunReportsResponse>('POST', ':batchRunReports', {
        requests: requests.map((r) => ({ ...r, returnPropertyQuota: true })),
      })
      const quota = res.reports?.[res.reports.length - 1]?.propertyQuota
      if (quota) onQuota?.(quota)
      return res
    },
    runRealtimeReport(body: RunRealtimeReportRequest): Promise<RunReportResponse> {
      return request<RunReportResponse>('POST', ':runRealtimeReport', { ...body, returnPropertyQuota: true })
    },
    getMetadata(): Promise<Metadata> {
      return request<Metadata>('GET', '/metadata')
    },
  }
}

export type GaClient = ReturnType<typeof createGaClient>
