import { describe, expect, it, vi } from 'vitest'
import { createGaClient } from './client'
import { GaError, isRetryable, type GaErrorKind } from './errors'
import type { PropertyQuota } from './types'

const URL_RUN = 'https://analyticsdata.googleapis.com/v1beta/properties/123:runReport'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status })
}

function setup(fetchImpl: typeof fetch, extra: { token?: string | null; onQuota?: (q: PropertyQuota) => void } = {}) {
  return createGaClient({
    propertyId: '123',
    getToken: () => (extra.token === undefined ? 'tok' : extra.token),
    onQuota: extra.onQuota,
    fetchImpl,
  })
}

async function kindOf(p: Promise<unknown>) {
  try {
    await p
  } catch (e) {
    expect(e).toBeInstanceOf(GaError)
    return e as GaError
  }
  throw new Error('expected rejection')
}

describe('createGaClient', () => {
  it('sends POST with bearer token and returnPropertyQuota', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { rows: [] }))
    await setup(fetchImpl).runReport({ metrics: [{ name: 'sessions' }] })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(URL_RUN)
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body)).toEqual({ metrics: [{ name: 'sessions' }], returnPropertyQuota: true })
  })

  it('batchRunReports adds quota flag to each request and wraps in requests', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { reports: [] }))
    await setup(fetchImpl).batchRunReports([{ limit: 1 }, { limit: 2 }])
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://analyticsdata.googleapis.com/v1beta/properties/123:batchRunReports')
    expect(JSON.parse(init.body)).toEqual({
      requests: [
        { limit: 1, returnPropertyQuota: true },
        { limit: 2, returnPropertyQuota: true },
      ],
    })
  })

  it('runRealtimeReport asks for quota but does not report it to onQuota', async () => {
    const onQuota = vi.fn()
    const quota = { tokensPerHour: { consumed: 3, remaining: 39997 } }
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { propertyQuota: quota }))
    const res = await setup(fetchImpl, { onQuota }).runRealtimeReport({ metrics: [{ name: 'activeUsers' }] })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://analyticsdata.googleapis.com/v1beta/properties/123:runRealtimeReport')
    expect(JSON.parse(init.body)).toEqual({ metrics: [{ name: 'activeUsers' }], returnPropertyQuota: true })
    expect(res.propertyQuota).toEqual(quota)
    expect(onQuota).not.toHaveBeenCalled()
  })

  it('getMetadata sends GET without a body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { dimensions: [{ apiName: 'customEvent:item_id' }] }))
    const res = await setup(fetchImpl).getMetadata()
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://analyticsdata.googleapis.com/v1beta/properties/123/metadata')
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(res.dimensions).toEqual([{ apiName: 'customEvent:item_id' }])
  })

  it('getMetadata classifies errors like POST', async () => {
    const e403 = await kindOf(setup(vi.fn().mockResolvedValue(jsonResponse(403, {}))).getMetadata())
    expect(e403.kind).toBe('forbidden')
    const eNet = await kindOf(setup(vi.fn().mockRejectedValue(new Error('offline'))).getMetadata())
    expect(eNet.kind).toBe('network')
    const eAuth = await kindOf(setup(vi.fn(), { token: null }).getMetadata())
    expect(eAuth.kind).toBe('auth')
  })

  it.each<[number, GaErrorKind]>([
    [401, 'auth'],
    [403, 'forbidden'],
    [429, 'quota'],
    [400, 'bad_request'],
    [503, 'server'],
  ])('classifies HTTP %i as %s', async (status, kind) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(status, { error: { code: status, message: 'boom', status: 'X' } }))
    const e = await kindOf(setup(fetchImpl).runReport({}))
    expect(e.kind).toBe(kind)
    expect(e.status).toBe(status)
    expect(e.message).toBe('boom')
    expect(e.name).toBe('GaError')
  })

  it('classifies RESOURCE_EXHAUSTED as quota regardless of status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(403, { error: { code: 403, message: 'q', status: 'RESOURCE_EXHAUSTED' } }))
    expect((await kindOf(setup(fetchImpl).runReport({}))).kind).toBe('quota')
  })

  it('handles non-JSON error body with HTTP fallback message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<html>bad</html>', { status: 502 }))
    const e = await kindOf(setup(fetchImpl).runReport({}))
    expect(e.kind).toBe('server')
    expect(e.message).toBe('HTTP 502')
  })

  it('classifies fetch rejection as network', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    expect((await kindOf(setup(fetchImpl).runReport({}))).kind).toBe('network')
  })

  it('throws auth without fetching when token is null', async () => {
    const fetchImpl = vi.fn()
    const e = await kindOf(setup(fetchImpl, { token: null }).runReport({}))
    expect(e.kind).toBe('auth')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('calls onQuota with propertyQuota', async () => {
    const quota = { tokensPerDay: { consumed: 10, remaining: 199990 } }
    const onQuota = vi.fn()
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { rows: [], propertyQuota: quota }))
    await setup(fetchImpl, { onQuota }).runReport({})
    expect(onQuota).toHaveBeenCalledWith(quota)
  })

  it('calls onQuota with the last report quota for batch', async () => {
    const onQuota = vi.fn()
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        reports: [
          { propertyQuota: { tokensPerDay: { consumed: 1, remaining: 2 } } },
          { propertyQuota: { tokensPerDay: { consumed: 3, remaining: 4 } } },
        ],
      }),
    )
    await setup(fetchImpl, { onQuota }).batchRunReports([{}, {}])
    expect(onQuota).toHaveBeenCalledTimes(1)
    expect(onQuota).toHaveBeenCalledWith({ tokensPerDay: { consumed: 3, remaining: 4 } })
  })
})

describe('isRetryable', () => {
  it.each<[GaErrorKind, boolean]>([
    ['network', true],
    ['server', true],
    ['auth', false],
    ['forbidden', false],
    ['quota', false],
    ['bad_request', false],
  ])('%s -> %s', (kind, expected) => {
    expect(isRetryable(new GaError(kind))).toBe(expected)
  })
  it('non-GaError is false', () => {
    expect(isRetryable(new Error('x'))).toBe(false)
    expect(isRetryable(null)).toBe(false)
  })
})
