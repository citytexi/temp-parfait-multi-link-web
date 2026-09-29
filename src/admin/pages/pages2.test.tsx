import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import { cloneElement, isValidElement, useState, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GaError } from '../ga/errors'
import engagement from '../ga/reports/__fixtures__/engagement.json'
import realtimeByMinute from '../ga/reports/__fixtures__/realtime-by-minute.json'
import realtimeTotal from '../ga/reports/__fixtures__/realtime-total.json'
import retention from '../ga/reports/__fixtures__/retention.json'
import techAppVersion from '../ga/reports/__fixtures__/tech-appversion.json'
import techCountry from '../ga/reports/__fixtures__/tech-country.json'
import techPlatform from '../ga/reports/__fixtures__/tech-platform.json'
import type { RunRealtimeReportRequest, RunReportRequest } from '../ga/types'
import { gaQueryDefaults } from '../hooks/useGa'
import type { Period } from '../lib/period'
import { RealtimePage } from './RealtimePage'
import { RetentionPage } from './RetentionPage'
import { TechPage } from './TechPage'

const h = vi.hoisted(() => ({
  client: {} as {
    runReport: ReturnType<typeof vi.fn>
    batchRunReports: ReturnType<typeof vi.fn>
    runRealtimeReport: ReturnType<typeof vi.fn>
  },
}))

const ranges = {
  current: { startDate: '2026-09-22', endDate: '2026-09-28' },
  previous: { startDate: '2026-09-15', endDate: '2026-09-21' },
  days: 7,
}
const period: Period = { kind: 'preset', preset: '7d' }

vi.mock('../hooks/useGa', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useGa')>()
  return {
    ...actual,
    useGa: () => ({ client: h.client, ranges, period, periodLabel: '최근 7일', today: '2026-09-29' }),
  }
})

// jsdom has no layout, so give charts a fixed size instead of measuring.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) =>
      isValidElement<{ width?: number; height?: number }>(children)
        ? cloneElement(children, { width: 800, height: 240 })
        : null,
  }
})

function renderPage(page: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{page}</QueryClientProvider>)
}

function card(title: string): HTMLElement {
  return screen.getByRole('heading', { level: 2, name: title }).closest('section') as HTMLElement
}

function expectChartOutOfTabOrder(chart: HTMLElement) {
  expect(chart.querySelector('svg')).not.toBeNull()
  expect(chart.querySelector('[tabindex="0"], [role="application"]')).toBeNull()
}

/**
 * Moves fake time forward inside act. The extra millisecond lets the zero-delay timers that
 * TanStack Query chains to notify React (after the fetch promise settles) run too.
 */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
    await vi.advanceTimersByTimeAsync(1)
  })
}

const realtimeResponse = async (req: RunRealtimeReportRequest) => (req.dimensions ? realtimeByMinute : realtimeTotal)

beforeEach(() => {
  h.client = {
    runReport: vi.fn(async (req: RunReportRequest) => (req.cohortSpec ? retention : engagement)),
    batchRunReports: vi.fn(async () => ({ reports: [techPlatform, techCountry, techAppVersion] })),
    runRealtimeReport: vi.fn(realtimeResponse),
  }
})

describe('RetentionPage', () => {
  it('shows the weekly return table and the engagement cards', async () => {
    renderPage(<RetentionPage />)
    expect(screen.getByText('기간 필터와 관계없이 최근 4주 기준이에요.')).toBeInTheDocument()

    const table = await within(card('주별로 다시 찾아온 비율')).findByRole('table')
    const headers = within(table).getAllByRole('columnheader').map((th) => th.textContent)
    expect(headers.slice(1)).toEqual(['첫 주', '1주 후', '2주 후', '3주 후', '4주 후'])

    const first = within(table).getByRole('rowheader', { name: '08.30 ~ 09.05' }).closest('tr')!
    const cells = within(first).getAllByRole('cell').map((td) => td.textContent)
    expect(cells).toEqual(['100%', '50%', '40%', '30%', '—'])
    const last = within(table).getByRole('rowheader', { name: '09.20 ~ 09.26' }).closest('tr')!
    expect(within(last).getAllByRole('cell').map((td) => td.textContent)).toEqual(['100%', '—', '—', '—', '—'])
    expect(within(card('주별로 다시 찾아온 비율')).getByRole('button', { name: 'CSV 받기' })).toBeInTheDocument()

    expect(within(card('한 사람당 방문 횟수')).getByText('3.5회')).toBeInTheDocument()
    expect(within(card('한 사람당 방문 횟수')).getByText('▲ 17%')).toBeInTheDocument()
    expect(within(card('한 사람당 평균 이용 시간')).getByText('3분 20초')).toBeInTheDocument()

    const retentionCall = h.client.runReport.mock.calls.find(([req]) => req.cohortSpec)!
    expect(retentionCall[0].dateRanges).toBeUndefined()
    const engagementCall = h.client.runReport.mock.calls.find(([req]) => !req.cohortSpec)!
    expect(engagementCall[0].dateRanges).toEqual([ranges.current, ranges.previous])
  })

  it('shows the empty state when no cohort has anyone', async () => {
    h.client.runReport.mockImplementation(async (req: RunReportRequest) => (req.cohortSpec ? {} : engagement))
    renderPage(<RetentionPage />)
    expect(await within(card('주별로 다시 찾아온 비율')).findByText('이 기간에는 데이터가 없어요')).toBeInTheDocument()
  })
})

describe('TechPage', () => {
  it('shows the platform donut and the country and version tables from one batch call', async () => {
    renderPage(<TechPage />)
    const chart = await screen.findByRole('img', { name: /Android와 iOS 비율/ })
    expectChartOutOfTabOrder(chart)
    const legend = within(card('Android와 iOS 비율')).getByRole('list')
    expect(within(legend).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Android60%',
      'iOS30%',
      'web10%',
    ])

    const countries = within(card('많이 쓰는 국가 Top 10')).getByRole('table')
    const unknown = within(countries).getByText('알 수 없음').closest('tr')!
    expect(within(unknown).getByText('200')).toBeInTheDocument()
    expect(within(unknown).getByText('20%')).toBeInTheDocument()
    expect(within(countries).getByText('기타')).toBeInTheDocument()

    const versions = within(card('앱 버전별 사람 수')).getByRole('table')
    expect(within(versions).getByText('알 수 없음')).toBeInTheDocument()
    expect(within(versions).getByText('1.2.0').closest('tr')).toHaveTextContent('500')

    expect(within(card('많이 쓰는 국가 Top 10')).getByRole('button', { name: 'CSV 받기' })).toBeInTheDocument()
    expect(within(card('앱 버전별 사람 수')).getByRole('button', { name: 'CSV 받기' })).toBeInTheDocument()
    expect(h.client.batchRunReports).toHaveBeenCalledTimes(1)
    expect(h.client.batchRunReports.mock.calls[0][0][0].dateRanges).toEqual([ranges.current])
  })
})

describe('RealtimePage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-09-29T05:03:04Z') })
  })

  afterEach(() => {
    vi.useRealTimers()
    Reflect.deleteProperty(document, 'visibilityState')
  })

  it('shows the headline, the per-minute chart and when it last refreshed', async () => {
    renderPage(<RealtimePage />)
    await advance(0)
    expect(screen.getByText('명이 앱을 쓰고 있어요', { exact: false })).toHaveTextContent(
      '최근 30분 동안 42명이 앱을 쓰고 있어요',
    )
    const chart = screen.getByRole('img', { name: /1분마다 앱을 쓴 사람/ })
    expectChartOutOfTabOrder(chart)
    expect(within(chart).getByText('30분 전')).toBeInTheDocument()
    expect(within(chart).getByText('지금')).toBeInTheDocument()
    expect(screen.getByText('1분마다 자동으로 새로고침돼요')).toBeInTheDocument()
    expect(screen.getByText('마지막 갱신 14:03:04')).toBeInTheDocument()
    expect(h.client.runRealtimeReport).toHaveBeenCalledTimes(2)
  })

  it('refetches every 60 seconds while the tab is visible', async () => {
    renderPage(<RealtimePage />)
    await advance(0)
    expect(h.client.runRealtimeReport).toHaveBeenCalledTimes(2)

    await advance(60_000)
    expect(h.client.runRealtimeReport).toHaveBeenCalledTimes(4)
    expect(screen.getByText('마지막 갱신 14:04:04')).toBeInTheDocument()
  })

  it('does not refetch while the tab is hidden', async () => {
    renderPage(<RealtimePage />)
    await advance(0)
    expect(h.client.runRealtimeReport).toHaveBeenCalledTimes(2)

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    window.dispatchEvent(new Event('visibilitychange'))
    await advance(60_000)
    await advance(60_000)
    expect(h.client.runRealtimeReport).toHaveBeenCalledTimes(2)
  })

  it('stops polling once an auth failure sends the user to the sign-in gate', async () => {
    const reportAuthError = vi.fn()

    // Mirrors App's SignedInApp: the query cache reports auth errors, and the page (with its
    // QueryClient) is only mounted while signed in.
    function SignedInHarness() {
      const [signedIn, setSignedIn] = useState(true)
      const [queryClient] = useState(
        () =>
          new QueryClient({
            queryCache: new QueryCache({
              onError: (e) => {
                if (e instanceof GaError && (e.kind === 'auth' || e.kind === 'forbidden')) {
                  reportAuthError(e.kind)
                  setSignedIn(false)
                }
              },
            }),
            defaultOptions: { queries: gaQueryDefaults },
          }),
      )
      if (!signedIn) return <p>로그인이 만료됐어요</p>
      return (
        <QueryClientProvider client={queryClient}>
          <RealtimePage />
        </QueryClientProvider>
      )
    }

    render(<SignedInHarness />)
    await advance(0)
    expect(h.client.runRealtimeReport).toHaveBeenCalledTimes(2)

    h.client.runRealtimeReport.mockRejectedValue(new GaError('auth', 'expired', 401))
    await advance(60_000)
    expect(reportAuthError).toHaveBeenCalledWith('auth')
    expect(screen.getByText('로그인이 만료됐어요')).toBeInTheDocument()
    const calls = h.client.runRealtimeReport.mock.calls.length

    await advance(60_000)
    await advance(60_000)
    expect(h.client.runRealtimeReport).toHaveBeenCalledTimes(calls)
  })
})
