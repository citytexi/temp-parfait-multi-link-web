import { useQuery } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthStatus } from './auth/AuthContext'
import { GaError } from './ga/errors'
import type { PropertyQuota } from './ga/types'
import type { MenuId } from './lib/urlState'

const h = vi.hoisted(() => ({
  configured: true,
  auth: {} as {
    status: string
    loginError: string | null
    authErrorDetail: string | null
    login: ReturnType<typeof vi.fn>
    logout: ReturnType<typeof vi.fn>
    getToken: ReturnType<typeof vi.fn>
    reportAuthError: ReturnType<typeof vi.fn>
  },
  client: {} as {
    runReport: ReturnType<typeof vi.fn>
    batchRunReports: ReturnType<typeof vi.fn>
    runRealtimeReport: ReturnType<typeof vi.fn>
  },
  onQuota: null as ((q: PropertyQuota) => void) | null,
  page: null as ((menu: MenuId) => ReactNode) | null,
}))

vi.mock('./config', () => ({
  GA_PROPERTY_ID: '123',
  OAUTH_CLIENT_ID: 'cid',
  isConfigured: () => h.configured,
}))

vi.mock('./auth/AuthContext', () => ({
  useAuth: () => h.auth,
}))

vi.mock('./ga/client', () => ({
  createGaClient: (opts: { onQuota?: (q: PropertyQuota) => void }) => {
    h.onQuota = opts.onQuota ?? null
    return h.client
  },
}))

// Lets a test put a real query consumer in the page area instead of the real page.
vi.mock('./pages/OverviewPage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./pages/OverviewPage')>()
  return {
    OverviewPage: () => (h.page ? h.page('overview') : actual.OverviewPage()),
  }
})

import { App } from './App'
import { useGa } from './hooks/useGa'

function setAuth(status: AuthStatus, loginError: string | null = null, authErrorDetail: string | null = null) {
  h.auth = {
    status,
    loginError,
    authErrorDetail,
    login: vi.fn(),
    logout: vi.fn(async () => {}),
    getToken: vi.fn(() => 'token'),
    reportAuthError: vi.fn(),
  }
}

function ProbePage({ refetchInterval }: { refetchInterval?: number }) {
  const { client, ranges } = useGa()
  useQuery({
    queryKey: ['probe', ranges],
    queryFn: () => client.runReport({}),
    enabled: ranges !== null,
    refetchInterval,
  })
  return <p>probe</p>
}

beforeEach(() => {
  h.configured = true
  h.page = null
  h.onQuota = null
  h.client = {
    runReport: vi.fn(async () => ({})),
    batchRunReports: vi.fn(async () => ({ reports: [] })),
    runRealtimeReport: vi.fn(async () => ({})),
  }
  setAuth('signedIn')
  window.history.replaceState(null, '', '/admin/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App gates', () => {
  it('asks for setup when config is empty', () => {
    h.configured = false
    render(<App />)
    expect(screen.getByRole('heading', { name: '설정이 필요해요' })).toBeInTheDocument()
    expect(screen.getByText(/src\/admin\/config\.ts/)).toHaveTextContent('README')
  })

  it('shows loading state', () => {
    setAuth('loading')
    render(<App />)
    expect(screen.getByRole('heading', { name: '불러오는 중이에요' })).toBeInTheDocument()
  })

  it('shows the sign-in button when signed out and calls login', async () => {
    setAuth('signedOut')
    render(<App />)
    expect(screen.getByRole('heading', { name: '파르페 대시보드' })).toBeInTheDocument()
    expect(screen.getByText('팀 Google 계정으로 로그인해 주세요.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Google 계정으로 로그인' }))
    expect(h.auth.login).toHaveBeenCalledTimes(1)
    expect(h.auth.login).toHaveBeenCalledWith()
  })

  it('shows the login error as an alert', () => {
    setAuth('signedOut', '로그인 창이 닫혔어요. 팝업 차단을 확인해 주세요.')
    render(<App />)
    expect(screen.getByRole('alert')).toHaveTextContent('로그인 창이 닫혔어요')
  })

  it('shows the expired screen with a re-login button', async () => {
    setAuth('expired')
    render(<App />)
    expect(screen.getByRole('heading', { name: '로그인이 만료됐어요' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '다시 로그인' }))
    expect(h.auth.login).toHaveBeenCalledTimes(1)
    expect(h.auth.login).toHaveBeenCalledWith()
  })

  it('shows the forbidden screen with guidance and another-account login', async () => {
    setAuth('forbidden')
    render(<App />)
    expect(
      screen.getByRole('heading', { name: '이 계정은 파르페 GA를 볼 권한이 없어요' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/관리자에게 GA 속성 뷰어 권한을 요청해 주세요/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '다른 계정으로 로그인' }))
    expect(h.auth.login).toHaveBeenCalledTimes(1)
    expect(h.auth.login).toHaveBeenCalledWith({ selectAccount: true })
  })

  it('shows the GA error message as a secondary detail on the forbidden screen', () => {
    setAuth('forbidden', null, 'Google Analytics Data API has not been used in project 123')
    render(<App />)
    const detail = screen.getByText('Google Analytics Data API has not been used in project 123')
    expect(detail).toHaveClass('adm-fullscreen__detail')
  })

  it('shows no detail on the forbidden screen when GA gave no message', () => {
    setAuth('forbidden')
    const { container } = render(<App />)
    expect(container.querySelector('.adm-fullscreen__detail')).toBeNull()
  })
})

describe('Signed-in shell', () => {
  it('restores menu and period from the URL and writes menu changes back', async () => {
    window.history.replaceState(null, '', '/admin/?menu=events&period=28d')
    const pushSpy = vi.spyOn(window.history, 'pushState')
    const replaceSpy = vi.spyOn(window.history, 'replaceState')
    render(<App />)

    const nav = screen.getByRole('navigation', { name: '메뉴' })
    expect(within(nav).getByRole('button', { name: '많이 한 행동' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('button', { name: '한눈에 보기' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: '최근 28일' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '최근 7일' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('heading', { level: 1, name: '많이 한 행동' })).toBeInTheDocument()
    expect(screen.getByText('기준: 어제까지, 한국 시간')).toBeInTheDocument()

    await userEvent.click(within(nav).getByRole('button', { name: '다시 찾아온 사람' }))
    expect(pushSpy).toHaveBeenLastCalledWith(null, '', '/admin/?menu=retention&period=28d')
    expect(within(nav).getByRole('button', { name: '다시 찾아온 사람' })).toHaveAttribute('aria-current', 'page')

    await userEvent.click(screen.getByRole('button', { name: '최근 90일' }))
    expect(replaceSpy).toHaveBeenLastCalledWith(null, '', '/admin/?menu=retention&period=90d')
  })

  it('lists all six menus', () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: '메뉴' })
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual([
      '한눈에 보기',
      '사용자',
      '많이 한 행동',
      '다시 찾아온 사람',
      '기기·지역',
      '지금 접속 중',
    ])
  })

  it('shows a reason and does not query when the custom start is after the end', async () => {
    h.page = () => <ProbePage />
    render(<App />)
    await waitFor(() => expect(h.client.runReport).toHaveBeenCalledTimes(1))
    h.client.runReport.mockClear()

    await userEvent.click(screen.getByRole('button', { name: '직접 선택' }))
    const start = screen.getByLabelText('시작일') as HTMLInputElement
    const end = screen.getByLabelText('종료일') as HTMLInputElement
    const yesterday = end.max
    expect(start.max).toBe(yesterday)
    expect(end.value).toBe(yesterday)

    fireEvent.change(end, { target: { value: dayBefore(start.value) } })

    expect(screen.getByRole('alert')).toHaveTextContent('시작일이 종료일보다 늦어요')
    await new Promise((r) => setTimeout(r, 30))
    expect(h.client.runReport).not.toHaveBeenCalled()
  })

  it('reports auth errors from queries to the auth gate', async () => {
    h.client.runReport.mockRejectedValue(new GaError('auth', 'expired', 401))
    h.page = () => <ProbePage />
    render(<App />)
    await waitFor(() => expect(h.auth.reportAuthError).toHaveBeenCalledWith('auth', 'expired'))
    expect(h.client.runReport).toHaveBeenCalledTimes(1) // auth errors are not retried
  })

  it('reports forbidden errors from queries to the auth gate', async () => {
    h.client.runReport.mockRejectedValue(new GaError('forbidden', 'no access', 403))
    h.page = () => <ProbePage />
    render(<App />)
    await waitFor(() => expect(h.auth.reportAuthError).toHaveBeenCalledWith('forbidden', 'no access'))
  })

  it('stops polling and drops the dashboard when the token expires', async () => {
    h.page = () => <ProbePage refetchInterval={20} />
    const { rerender } = render(<App />)
    await waitFor(() => expect(h.client.runReport.mock.calls.length).toBeGreaterThanOrEqual(2))

    setAuth('expired')
    rerender(<App />)
    expect(screen.getByRole('heading', { name: '로그인이 만료됐어요' })).toBeInTheDocument()
    const calls = h.client.runReport.mock.calls.length
    await new Promise((r) => setTimeout(r, 100))
    expect(h.client.runReport).toHaveBeenCalledTimes(calls)
  })

  it('calls logout from the top bar', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: '로그아웃' }))
    expect(h.auth.logout).toHaveBeenCalledTimes(1)
  })

  it('shows remaining daily quota once the client reports it', () => {
    render(<App />)
    expect(screen.queryByText(/오늘 조회 가능량/)).not.toBeInTheDocument()
    act(() => h.onQuota?.({ tokensPerDay: { consumed: 500, remaining: 24500 } }))
    expect(screen.getByText('오늘 조회 가능량 98% 남음')).toBeInTheDocument()
  })
})

function dayBefore(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
}
