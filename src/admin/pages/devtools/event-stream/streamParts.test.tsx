import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HIGHLIGHT_TTL_MS } from './config'
import type { PollDecision } from './pollPolicy'
import type { EventLine, Highlight, StreamSnapshot } from './report'
import { StreamStatus } from './StreamStatus'
import { StreamTable } from './StreamTable'

afterEach(() => {
  vi.useRealTimers()
})

const normal: PollDecision = { intervalMs: 5000, reason: 'normal' }
const snapshot: StreamSnapshot = {
  rows: [],
  truncated: false,
  fetchedAt: Date.UTC(2026, 9, 8, 5, 2, 31),
  quota: {
    tokensPerHour: { consumed: 3, remaining: 39_000 },
    tokensPerProjectPerHour: { consumed: 3, remaining: 13_000 },
    tokensPerDay: { consumed: 3, remaining: 199_000 },
  },
}

const statusProps = (over: Partial<Parameters<typeof StreamStatus>[0]> = {}) => ({
  decision: normal,
  snapshot,
  paused: false,
  onPause: vi.fn(),
  onRefresh: vi.fn(),
  ...over,
})

describe('StreamStatus', () => {
  it('puts the interval sentence in the status region and the time outside it', () => {
    render(<StreamStatus {...statusProps()} />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('5초마다 갱신 중')
    expect(within(status).queryByText(/마지막 갱신/)).toBeNull()
    expect(screen.getByText('마지막 갱신 14:02:31')).toBeInTheDocument()
  })

  it('shows neither before the first snapshot', () => {
    render(<StreamStatus {...statusProps({ snapshot: undefined })} />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText(/마지막 갱신/)).toBeNull()
    expect(screen.queryByText(/갱신 중/)).toBeNull()
  })

  it('swaps the pause button and reports clicks', () => {
    const onPause = vi.fn()
    const onRefresh = vi.fn()
    const { rerender } = render(<StreamStatus {...statusProps({ onPause, onRefresh })} />)
    expect(screen.queryByRole('button', { name: '다시 시작' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '일시정지' }))
    expect(onPause).toHaveBeenLastCalledWith(true)
    rerender(<StreamStatus {...statusProps({ onPause, onRefresh, paused: true })} />)
    expect(screen.queryByRole('button', { name: '일시정지' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '다시 시작' }))
    expect(onPause).toHaveBeenLastCalledWith(false)
    fireEvent.click(screen.getByRole('button', { name: '지금 새로고침' }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('shows the diagnostics line in dev', () => {
    render(<StreamStatus {...statusProps()} />)
    expect(screen.getByText(/^진단\(개발 모드\): 직전 요청 3토큰/)).toHaveTextContent(
      '남은 한도 시간 39000 / 프로젝트 13000 / 하루 199000 · 0행',
    )
  })

  it('uses a dash for missing diagnostics values', () => {
    render(<StreamStatus {...statusProps({ snapshot: { ...snapshot, quota: null } })} />)
    expect(screen.getByText(/^진단\(개발 모드\)/)).toHaveTextContent('직전 요청 —토큰 · 남은 한도 시간 — / 프로젝트 — / 하루 — · 0행')
  })
})

const line = (over: Partial<EventLine> = {}): EventLine => ({
  name: 'screen_view',
  label: '화면 조회',
  inCatalog: true,
  watched: false,
  now: 3,
  last5: 12,
  total: 1400,
  perMinute: Array.from({ length: 30 }, (_, i) => i % 5),
  ...over,
})

const tableProps = (over: Partial<Parameters<typeof StreamTable>[0]> = {}) => ({
  lines: [line()],
  highlights: new Map<string, Highlight>(),
  onToggleWatch: vi.fn(),
  onOpenDictionary: vi.fn(),
  ...over,
})

describe('StreamTable', () => {
  it('renders a row per line with label, raw name and three counts', () => {
    render(
      <StreamTable
        {...tableProps({
          lines: [line(), line({ name: 'tap_cta', label: '버튼 탭', now: 0, last5: 1, total: 2 })],
        })}
      />,
    )
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('화면 조회')).toBeInTheDocument()
    expect(within(rows[0]).getByText('screen_view')).toBeInTheDocument()
    const cells = within(rows[0]).getAllByRole('cell')
    expect(cells[2]).toHaveTextContent('3')
    expect(cells[3]).toHaveTextContent('12')
    expect(cells[4]).toHaveTextContent('1,400')
    expect(within(rows[1]).getByText('버튼 탭')).toBeInTheDocument()
  })

  it('shows the catalogue tag and the dictionary button only for events outside the catalogue', () => {
    const onOpenDictionary = vi.fn()
    render(
      <StreamTable
        {...tableProps({
          onOpenDictionary,
          lines: [line(), line({ name: 'purchase_done', label: 'purchase_done', inCatalog: false })],
        })}
      />,
    )
    expect(screen.getAllByText('사전에 없음')).toHaveLength(1)
    const buttons = screen.getAllByRole('button', { name: '사전에서 보기' })
    expect(buttons).toHaveLength(1)
    const outside = screen.getByText('purchase_done').closest('tr') as HTMLElement
    expect(within(outside).getByText('사전에 없음')).toBeInTheDocument()
    fireEvent.click(buttons[0])
    expect(onOpenDictionary).toHaveBeenCalledWith('purchase_done')
  })

  it('names and presses the star', () => {
    const onToggleWatch = vi.fn()
    const { rerender } = render(<StreamTable {...tableProps({ onToggleWatch })} />)
    const star = screen.getByRole('button', { name: 'screen_view 지켜보기' })
    expect(star).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(star)
    expect(onToggleWatch).toHaveBeenCalledWith('screen_view')
    rerender(<StreamTable {...tableProps({ onToggleWatch, lines: [line({ watched: true })] })} />)
    expect(screen.getByRole('button', { name: 'screen_view 지켜보기' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('words highlights with their age and hides them after 60 seconds', () => {
    vi.useFakeTimers()
    const start = Date.now()
    const highlights = new Map<string, Highlight>([['screen_view', { kind: 'up', delta: 3, at: start - 8000 }]])
    render(<StreamTable {...tableProps({ highlights })} />)
    expect(screen.getByText('▲ +3 · 8초 전')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('▲ +3 · 9초 전')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(HIGHLIGHT_TTL_MS - 8000 - 1000 - 1000)
    })
    expect(screen.getByText(/^▲ \+3/)).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByText(/▲/)).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('words a new-event highlight with its age', () => {
    vi.useFakeTimers()
    const highlights = new Map<string, Highlight>([['screen_view', { kind: 'new', delta: 0, at: Date.now() - 8000 }]])
    render(<StreamTable {...tableProps({ highlights })} />)
    expect(screen.getByText('새로 들어옴 · 8초 전')).toBeInTheDocument()
  })

  it('renders no arrow when an up highlight has no increase', () => {
    vi.useFakeTimers()
    const highlights = new Map<string, Highlight>([['screen_view', { kind: 'up', delta: 0, at: Date.now() - 1000 }]])
    render(<StreamTable {...tableProps({ highlights })} />)
    expect(screen.queryByText(/▲/)).toBeNull()
  })

  it('runs no ticker without highlights and clears it on unmount under StrictMode', () => {
    vi.useFakeTimers()
    const { rerender, unmount } = render(
      <StrictMode>
        <StreamTable {...tableProps()} />
      </StrictMode>,
    )
    expect(vi.getTimerCount()).toBe(0)
    const highlights = new Map<string, Highlight>([['screen_view', { kind: 'up', delta: 1, at: Date.now() }]])
    rerender(
      <StrictMode>
        <StreamTable {...tableProps({ highlights })} />
      </StrictMode>,
    )
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps every cell a table cell with the layout on an inner wrapper', () => {
    render(<StreamTable {...tableProps()} />)
    const row = screen.getAllByRole('row')[1]
    for (const td of Array.from(row.querySelectorAll('td'))) {
      expect(td.className).not.toMatch(/adm-event-stream-(event|marks|name)/)
    }
    const cell = row.querySelectorAll('td')[1]
    const wrapper = cell.firstElementChild as HTMLElement
    expect(wrapper.tagName).toBe('DIV')
    expect(wrapper).toHaveClass('adm-event-stream-event')
    expect(wrapper).toHaveTextContent('화면 조회')
    expect(cell.children).toHaveLength(1)
  })

  it('remounts only the decorative flash element when a fresh change arrives', () => {
    vi.useFakeTimers()
    const at = Date.now()
    const first = new Map<string, Highlight>([['screen_view', { kind: 'up', delta: 1, at }]])
    const { container, rerender } = render(<StreamTable {...tableProps({ highlights: first })} />)
    const wrapperBefore = container.querySelector('.adm-event-stream-event')
    const flashBefore = container.querySelector('.adm-event-stream-flash')
    expect(flashBefore).toHaveAttribute('aria-hidden', 'true')
    expect(flashBefore?.children).toHaveLength(0)
    const second = new Map<string, Highlight>([['screen_view', { kind: 'up', delta: 2, at: at + 3000 }]])
    rerender(<StreamTable {...tableProps({ highlights: second })} />)
    expect(container.querySelector('.adm-event-stream-event')).toBe(wrapperBefore)
    const flashAfter = container.querySelector('.adm-event-stream-flash')
    expect(flashAfter).not.toBeNull()
    expect(flashAfter).not.toBe(flashBefore)
  })

  it('keeps focus on the dictionary button as the highlight appears, changes and expires', () => {
    vi.useFakeTimers()
    const at = Date.now()
    const outside = line({ name: 'purchase_done', label: 'purchase_done', inCatalog: false })
    const props = (highlights: Map<string, Highlight>) => tableProps({ lines: [outside], highlights })
    const { rerender } = render(<StreamTable {...props(new Map())} />)
    const button = screen.getByRole('button', { name: '사전에서 보기' })
    button.focus()
    expect(document.activeElement).toBe(button)
    rerender(<StreamTable {...props(new Map([['purchase_done', { kind: 'new', delta: 0, at }]]))} />)
    expect(document.activeElement).toBe(button)
    rerender(<StreamTable {...props(new Map([['purchase_done', { kind: 'up', delta: 2, at: at + 3000 }]]))} />)
    expect(document.activeElement).toBe(button)
    expect(screen.getByRole('button', { name: '사전에서 보기' })).toBe(button)
    act(() => {
      vi.advanceTimersByTime(HIGHLIGHT_TTL_MS + 4000)
    })
    expect(screen.queryByText(/▲/)).toBeNull()
    expect(screen.getByRole('button', { name: '사전에서 보기' })).toBe(button)
    expect(document.activeElement).toBe(button)
  })

  it('fills the star only when watched', () => {
    const { rerender } = render(<StreamTable {...tableProps()} />)
    const icon = () => screen.getByRole('button', { name: 'screen_view 지켜보기' }).querySelector('svg') as SVGElement
    expect(icon()).toHaveAttribute('fill', 'none')
    rerender(<StreamTable {...tableProps({ lines: [line({ watched: true })] })} />)
    expect(icon()).toHaveAttribute('fill', 'currentColor')
  })

  it('scales bar heights to the line maximum', () => {
    const perMinute = Array<number>(30).fill(0)
    perMinute[27] = 10
    perMinute[28] = 5
    const { container } = render(<StreamTable {...tableProps({ lines: [line({ perMinute })] })} />)
    const rects = container.querySelectorAll('svg.adm-event-stream-trend rect')
    const height = (i: number) => Number(rects[i].getAttribute('height'))
    expect(height(27)).toBe(24)
    expect(height(28)).toBe(12)
    expect(height(0)).toBeLessThan(2)
  })

  it('hides a new-event highlight after 60 seconds', () => {
    vi.useFakeTimers()
    const highlights = new Map<string, Highlight>([['screen_view', { kind: 'new', delta: 0, at: Date.now() - 8000 }]])
    render(<StreamTable {...tableProps({ highlights })} />)
    act(() => {
      vi.advanceTimersByTime(HIGHLIGHT_TTL_MS - 8000 - 1000)
    })
    expect(screen.getByText(/^새로 들어옴/)).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByText(/새로 들어옴/)).toBeNull()
  })

  it('hides the trend from assistive tech', () => {
    const { container } = render(<StreamTable {...tableProps()} />)
    const svg = container.querySelector('svg.adm-event-stream-trend') as SVGElement
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg.querySelectorAll('rect')).toHaveLength(30)
  })
})
