import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Circle } from 'lucide-react'
import { StrictMode, type ComponentType, type ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PropertyQuota } from '../ga/types'
import { defineMenu, type MenuDef } from '../menu/defineMenu'
import { buildRegistry, type Registry } from '../menu/registry'

const h = vi.hoisted(() => ({
  auth: {} as { logout: ReturnType<typeof vi.fn>; getToken: ReturnType<typeof vi.fn> },
  onQuota: null as ((q: PropertyQuota) => void) | null,
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => h.auth,
}))

vi.mock('../ga/client', () => ({
  createGaClient: (opts: { onQuota?: (q: PropertyQuota) => void }) => {
    h.onQuota = opts.onQuota ?? null
    return {}
  },
}))

import { GaProvider } from '../hooks/useGa'
import { NavProvider } from '../menu/NavContext'
import { Shell } from './Shell'

type Load = MenuDef['load']

const page = (text: string): { default: ComponentType } => ({ default: () => <p>{text}</p> })

let a: MenuDef & { load: ReturnType<typeof vi.fn<Load>> }
let b: MenuDef & { load: ReturnType<typeof vi.fn<Load>> }
let registry: Registry

function tree(): ReactElement {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <NavProvider lookup={registry.lookup}>
        <GaProvider>
          <Shell registry={registry} />
        </GaProvider>
      </NavProvider>
    </QueryClientProvider>
  )
}

const menuButton = (name: string) =>
  within(screen.getByRole('navigation', { name: '메뉴' })).getByRole('button', { name })

function stubPlatform(platform: string) {
  vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue(platform)
}

beforeEach(() => {
  h.auth = { logout: vi.fn(async () => {}), getToken: vi.fn(() => 'token') }
  h.onQuota = null
  a = {
    ...defineMenu({
      id: 'a',
      group: 'metrics',
      order: 1,
      label: '에이',
      description: '에이 설명',
      icon: Circle,
      load: () => Promise.reject(new Error('replaced below')),
      usesPeriod: true,
      usesGa: true,
    }),
    load: vi.fn<Load>(async () => page('에이 내용')),
  }
  b = {
    ...defineMenu({
      id: 'b',
      group: 'devtools',
      order: 1,
      label: '비',
      description: '비 설명',
      icon: Circle,
      load: () => Promise.reject(new Error('replaced below')),
    }),
    load: vi.fn<Load>(async () => page('비 내용')),
  }
  registry = buildRegistry([a, b], 'a')
  localStorage.clear()
  document.title = ''
  window.history.replaceState(null, '', '/admin/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Shell', () => {
  it('renders the header from the menu and the lazy page', async () => {
    render(tree())
    expect(screen.getByRole('heading', { level: 1, name: '에이' })).toBeInTheDocument()
    expect(screen.getByText('에이 설명')).toBeInTheDocument()
    expect(await screen.findByText('에이 내용')).toBeInTheDocument()
  })

  it('shows the period filter and the basis note only for usesPeriod menus', async () => {
    render(tree())
    expect(screen.getByRole('button', { name: '최근 7일' })).toBeInTheDocument()
    expect(screen.getByText('기준: 어제까지, 한국 시간')).toBeInTheDocument()

    await userEvent.click(menuButton('비'))
    expect(screen.getByRole('heading', { level: 1, name: '비' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '최근 7일' })).not.toBeInTheDocument()
    expect(screen.queryByText('기준: 어제까지, 한국 시간')).not.toBeInTheDocument()
    expect(await screen.findByText('비 내용')).toBeInTheDocument()
  })

  it('shows the quota badge only for usesGa menus', async () => {
    render(tree())
    act(() => h.onQuota?.({ tokensPerDay: { consumed: 500, remaining: 24500 } }))
    expect(screen.getByText('오늘 조회 가능량 98% 남음')).toBeInTheDocument()

    await userEvent.click(menuButton('비'))
    expect(screen.queryByText(/오늘 조회 가능량/)).not.toBeInTheDocument()
    expect(await screen.findByText('비 내용')).toBeInTheDocument()
  })

  it('moves focus to the heading and updates the title after a menu change, not on first render', async () => {
    render(<StrictMode>{tree()}</StrictMode>)
    expect(screen.getByRole('heading', { level: 1, name: '에이' })).not.toHaveFocus()
    expect(document.title).toBe('에이 · 파르페 대시보드')
    expect(await screen.findByText('에이 내용')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: '에이' })).not.toHaveFocus()

    await userEvent.click(menuButton('비'))
    expect(screen.getByRole('heading', { level: 1, name: '비' })).toHaveFocus()
    expect(document.title).toBe('비 · 파르페 대시보드')
    expect(await screen.findByText('비 내용')).toBeInTheDocument()
  })

  it('shows a loading status while the page chunk is pending', async () => {
    b.load.mockImplementation(() => new Promise(() => {}))
    render(tree())
    await userEvent.click(menuButton('비'))
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중이에요')
    expect(screen.getByRole('heading', { level: 1, name: '비' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '메뉴' })).toBeInTheDocument()
  })

  it('shows a retry button when the chunk fails and recovers on retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    b.load.mockRejectedValueOnce(new Error('chunk failed'))
    render(tree())
    await userEvent.click(menuButton('비'))
    expect(await screen.findByText('화면을 불러오지 못했어요')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('비 내용')).toBeInTheDocument()
    expect(screen.queryByText('화면을 불러오지 못했어요')).not.toBeInTheDocument()
    expect(b.load).toHaveBeenCalledTimes(2)
  })

  it('offers a reload with a re-login warning after a failed retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    b.load.mockImplementation(() => Promise.reject(new Error('chunk failed')))
    render(tree())
    await userEvent.click(menuButton('비'))
    expect(await screen.findByText('화면을 불러오지 못했어요')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '새로고침' })).not.toBeInTheDocument()
    expect(screen.queryByText('새로고침하면 다시 로그인해야 해요.')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByRole('button', { name: '새로고침' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    expect(screen.getByText('새로고침하면 다시 로그인해야 해요.')).toBeInTheDocument()
    expect(b.load).toHaveBeenCalledTimes(2)
  })

  it('tries again after leaving a failed menu and coming back', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    b.load.mockRejectedValueOnce(new Error('chunk failed'))
    render(tree())
    await userEvent.click(menuButton('비'))
    expect(await screen.findByText('화면을 불러오지 못했어요')).toBeInTheDocument()

    await userEvent.click(menuButton('에이'))
    expect(await screen.findByText('에이 내용')).toBeInTheDocument()
    await userEvent.click(menuButton('비'))
    expect(await screen.findByText('비 내용')).toBeInTheDocument()
    expect(b.load).toHaveBeenCalledTimes(2)
  })

  it('renders the mobile menu instead of the side menu below 960px', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (media: string) =>
        ({ matches: false, media, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList,
    )
    render(tree())
    expect(screen.getAllByRole('navigation', { name: '메뉴' })).toHaveLength(1)
    expect(screen.getByRole('group', { name: '메뉴 그룹' })).toBeInTheDocument()
    expect(await screen.findByText('에이 내용')).toBeInTheDocument()
  })

  it('opens the command menu from the top bar and navigates', async () => {
    render(tree())
    await userEvent.click(screen.getByRole('button', { name: '메뉴 검색' }))
    const dialog = await screen.findByRole('dialog', { name: '빠른 이동' })
    await userEvent.click(within(dialog).getByRole('option', { name: /비/ }))

    expect(screen.getByRole('heading', { level: 1, name: '비' })).toBeInTheDocument()
    expect(window.location.pathname + window.location.search).toBe('/admin/?menu=b')
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: '비' })).toHaveFocus())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('비 내용')).toBeInTheDocument()
  })

  it('labels the shortcut by platform', async () => {
    stubPlatform('MacIntel')
    const mac = render(tree())
    expect(within(screen.getByRole('button', { name: '메뉴 검색' })).getByText('⌘K')).toBeInTheDocument()
    expect(await screen.findByText('에이 내용')).toBeInTheDocument()
    mac.unmount()

    stubPlatform('Win32')
    render(tree())
    expect(within(screen.getByRole('button', { name: '메뉴 검색' })).getByText('Ctrl K')).toBeInTheDocument()
    expect(await screen.findByText('에이 내용')).toBeInTheDocument()
  })

  it('prefetches the other page chunks when idle', async () => {
    vi.useFakeTimers()
    try {
      render(<StrictMode>{tree()}</StrictMode>)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1499)
      })
      expect(b.load).not.toHaveBeenCalled()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(b.load).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores a prefetch that fails', async () => {
    // A plain function: vi.fn observes the promises it returns, which would hide an unhandled rejection.
    let calls = 0
    const failing: Load = () => {
      calls += 1
      return Promise.reject(new Error('chunk failed'))
    }
    b.load = failing as typeof b.load
    vi.useFakeTimers()
    try {
      render(tree())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500)
      })
      expect(calls).toBe(1)
      expect(screen.getByText('에이 내용')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels the scheduled prefetch on unmount', async () => {
    vi.useFakeTimers()
    try {
      const { unmount } = render(tree())
      unmount()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500)
      })
      expect(b.load).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
