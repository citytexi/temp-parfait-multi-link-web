import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { cloneElement, isValidElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GaError } from '../ga/errors'
import eventsRes from '../ga/reports/__fixtures__/events.json'
import totals from '../ga/reports/__fixtures__/overview-totals.json'
import trend from '../ga/reports/__fixtures__/overview-trend.json'
import platformTrend from '../ga/reports/__fixtures__/overview-platform-trend.json'
import screensRes from '../ga/reports/__fixtures__/screens.json'
import usersNvr from '../ga/reports/__fixtures__/users-new-vs-returning.json'
import usersTrend from '../ga/reports/__fixtures__/users-trend.json'
import realtimeTotal from '../ga/reports/__fixtures__/realtime-total.json'
import type { Period } from '../lib/period'
import { EventsPage } from './EventsPage'
import { OverviewPage } from './OverviewPage'
import { UsersPage } from './UsersPage'

const h = vi.hoisted(() => ({
  client: {} as {
    runReport: ReturnType<typeof vi.fn>
    batchRunReports: ReturnType<typeof vi.fn>
    runRealtimeReport: ReturnType<typeof vi.fn>
  },
  downloadCsv: vi.fn(),
}))

vi.mock('../lib/csv', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/csv')>()),
  downloadCsv: h.downloadCsv,
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

beforeEach(() => {
  h.downloadCsv.mockClear()
  h.client = {
    runReport: vi.fn(async () => ({})),
    batchRunReports: vi.fn(async () => ({ reports: [totals, trend, platformTrend, screensRes] })),
    runRealtimeReport: vi.fn(async () => realtimeTotal),
  }
})

describe('OverviewPage', () => {
  it('shows the summary and cards from one batch call', async () => {
    renderPage(<OverviewPage />)
    expect(
      await screen.findByText('지난 7일 동안 1,120명이 파르페를 썼어요. 그 전 7일보다 12% 늘었어요.'),
    ).toBeInTheDocument()
    expect(within(card('앱을 쓴 사람')).getByText('1,120')).toBeInTheDocument()
    expect(within(card('앱을 쓴 사람')).getByText('▲ 12%')).toBeInTheDocument()
    expect(within(card('처음 온 사람')).getByText('300')).toBeInTheDocument()
    expect(within(card('한 사람당 평균 이용 시간')).getByText('3분 20초')).toBeInTheDocument()
    expect(await within(card('지금 접속 중')).findByText('42')).toBeInTheDocument()
    const chart = screen.getByRole('img', { name: /날짜별 앱을 쓴 사람/ })
    expect(chart.querySelector('svg')).not.toBeNull()
    expect(chart.querySelector('[tabindex="0"], [role="application"]')).toBeNull()

    expect(h.client.batchRunReports).toHaveBeenCalledTimes(1)
    const [requests] = h.client.batchRunReports.mock.calls[0]
    expect(requests[0].dateRanges).toEqual([ranges.current, ranges.previous])
    expect(requests).toHaveLength(4)
    expect(requests[2].dimensions).toEqual([{ name: 'date' }, { name: 'platform' }])
    expect(requests[3].dimensions).toEqual([{ name: 'unifiedScreenName' }])
    expect(h.client.runRealtimeReport).toHaveBeenCalledWith({ metrics: [{ name: 'activeUsers' }] })
    expect(h.client.runReport).not.toHaveBeenCalled()
  })

  it('draws 전체, Android and iOS lines on the trend chart', async () => {
    renderPage(<OverviewPage />)
    const chart = await screen.findByRole('img', { name: /날짜별 앱을 쓴 사람/ })
    expect(chart.getAttribute('aria-label')).toContain('Android')
    expect(chart.getAttribute('aria-label')).toContain('iOS')
    const trendCard = card('날짜별 앱을 쓴 사람')
    expect(within(trendCard).getByText('전체')).toBeInTheDocument()
    expect(within(trendCard).getByText('Android')).toBeInTheDocument()
    expect(within(trendCard).getByText('iOS')).toBeInTheDocument()
    expect(chart.querySelectorAll('.recharts-line')).toHaveLength(3)
    expect(chart.querySelector('[tabindex="0"], [role="application"]')).toBeNull()
  })

  it('shows the top screens card with a lead and rows', async () => {
    renderPage(<OverviewPage />)
    const screens = card('많이 본 화면')
    expect(await within(screens).findByText('#1 home')).toBeInTheDocument()
    expect(within(screens).getByText('25%')).toBeInTheDocument()
    const rows = within(screens).getAllByRole('listitem')
    expect(rows).toHaveLength(10)
    const detail = rows.find((row) => within(row).queryByText('link_detail'))!
    expect(within(detail).getByText('3,000')).toBeInTheDocument()
    expect(within(detail).getByText('변화 없음')).toBeInTheDocument()
    expect(within(screens).getByText('사용자가 적은 항목은 개인정보 보호를 위해 GA가 숨길 수 있어요')).toBeInTheDocument()
    await userEvent.click(within(screens).getByRole('button', { name: 'CSV 받기' }))
    const [filename, csv] = h.downloadCsv.mock.calls[0]
    expect(filename).toBe('parfait-screens-2026-09-22_2026-09-28.csv')
    expect(csv.split('\r\n')[0]).toBe('\ufeff화면 이름,조회수,비율,직전 기간 조회수')
  })

  it('shows the empty state on the screens card when there are no screens', async () => {
    h.client.batchRunReports.mockResolvedValue({ reports: [totals, trend, platformTrend, {}] })
    renderPage(<OverviewPage />)
    expect(await within(card('많이 본 화면')).findByText('이 기간에는 데이터가 없어요')).toBeInTheDocument()
    expect(within(card('앱을 쓴 사람')).getByText('1,120')).toBeInTheDocument()
  })

  it('isolates a realtime failure to its own card', async () => {
    h.client.runRealtimeReport.mockRejectedValue(new GaError('server'))
    renderPage(<OverviewPage />)
    expect(await within(card('지금 접속 중')).findByText('불러오지 못했어요')).toBeInTheDocument()
    expect(within(card('앱을 쓴 사람')).getByText('1,120')).toBeInTheDocument()
    expect(within(card('처음 온 사람')).getByText('300')).toBeInTheDocument()
    expect(within(card('한 사람당 평균 이용 시간')).getByText('3분 20초')).toBeInTheDocument()
    expect(screen.getAllByText('불러오지 못했어요')).toHaveLength(1)
  })
})

describe('EventsPage', () => {
  it('lists the top events and tags unregistered names', async () => {
    h.client.runReport.mockResolvedValue(eventsRes)
    renderPage(<EventsPage />)
    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(10)
    const linkClick = rows.find((r) => within(r).queryByText('link_click'))!
    expect(within(linkClick).getByText('이름 미등록')).toBeInTheDocument()
    const screenView = rows.find((r) => within(r).queryByText('화면 조회'))!
    expect(within(screenView).queryByText('이름 미등록')).not.toBeInTheDocument()
    expect(within(screenView).getByText('5,000')).toBeInTheDocument()
    expect(within(screenView).getByText('▲ 25%')).toBeInTheDocument()
    expect(screen.getByText('사용자가 적은 항목은 개인정보 보호를 위해 GA가 숨길 수 있어요')).toBeInTheDocument()
    const chart = screen.getByRole('img', { name: /가장 많이 일어난 행동 Top 10/ })
    expect(chart.querySelector('svg')).not.toBeNull()
    expect(chart.querySelector('[tabindex="0"], [role="application"]')).toBeNull()
    expect(h.client.runReport).toHaveBeenCalledTimes(1)
  })

  it('labels the user column 사람 수 in the table and the CSV', async () => {
    h.client.runReport.mockResolvedValue(eventsRes)
    renderPage(<EventsPage />)
    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      '행동',
      '횟수',
      '사람 수',
      '직전 기간 대비',
    ])
    await userEvent.click(screen.getByRole('button', { name: 'CSV 받기' }))
    const [, csv] = h.downloadCsv.mock.calls[0]
    expect(csv.split('\r\n')[0]).toBe('\ufeff행동,횟수,사람 수,직전 기간 대비')
  })
})

describe('UsersPage', () => {
  it('shows the DAU/WAU/MAU chart and the new-vs-returning table', async () => {
    h.client.batchRunReports.mockResolvedValue({ reports: [usersTrend, usersNvr] })
    renderPage(<UsersPage />)
    const table = await screen.findByRole('table')
    const newRow = within(table).getByText('신규').closest('tr')!
    expect(within(newRow).getByText('300')).toBeInTheDocument()
    expect(within(newRow).getByText('▲ 20%')).toBeInTheDocument()
    const chart = screen.getByRole('img', { name: /09\.21 기준 하루 110명, 일주일 420명, 한 달 910명/ })
    expect(chart.querySelector('svg')).not.toBeNull()
    expect(chart.querySelector('[tabindex="0"], [role="application"]')).toBeNull()
    expect(screen.getByText('하루 (DAU)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CSV 받기' })).toBeInTheDocument()
  })

  it('shows the empty state for an empty response', async () => {
    h.client.batchRunReports.mockResolvedValue({ reports: [{}, {}] })
    renderPage(<UsersPage />)
    expect(await within(card('하루·일주일·한 달 동안 앱을 쓴 사람')).findByText('이 기간에는 데이터가 없어요')).toBeInTheDocument()
    expect(within(card('처음 온 사람과 다시 온 사람')).getByText('이 기간에는 데이터가 없어요')).toBeInTheDocument()
    expect(h.client.batchRunReports).toHaveBeenCalledTimes(1)
  })
})
