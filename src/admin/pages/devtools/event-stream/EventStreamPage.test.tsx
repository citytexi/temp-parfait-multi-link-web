import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GaError } from '../../../ga/errors'
import type { RunReportResponse } from '../../../ga/types'
import { NavProvider } from '../../../menu/NavContext'
import type { MenuLookup } from '../../../menu/registry'
import streamEmpty from './__fixtures__/stream-empty.json'
import stream from './__fixtures__/stream.json'
import { withExtra } from './__fixtures__/withExtra'
import menu from './EventStreamPage.menu'
import { EventStreamPage } from './EventStreamPage'

const h = vi.hoisted(() => ({ client: {} as { runRealtimeReport: ReturnType<typeof vi.fn> } }))

vi.mock('../../../hooks/useGa', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../hooks/useGa')>()
  return { ...actual, useGa: () => ({ client: h.client }) }
})

const MENUS = ['event-stream', 'event-dictionary']
const lookup: MenuLookup = {
  defaultMenu: 'event-stream',
  isMenu: (id) => MENUS.includes(id),
  usesPeriod: (id) => id === 'event-dictionary',
}

const NO_MATCH = '조건에 맞는 이벤트가 없어요'
const NOTHING_ARRIVED = '최근 30분 동안 들어온 이벤트가 없어요. 앱에서 이벤트를 보내면 여기에 나타나요.'
const QUOTA = '실시간 조회 한도를 다 써서 자동 갱신을 멈췄어요. 한 시간쯤 뒤에 다시 시도해 주세요.'

/** Moves fake time forward inside act; the extra millisecond runs TanStack Query's zero-delay notify timers. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
    await vi.advanceTimersByTimeAsync(1)
  })
}

/** Renders the page at `?menu=event-stream` plus `params`, and waits for the first response. */
async function open(params = '') {
  window.history.replaceState(null, '', `/?menu=event-stream${params ? `&${params}` : ''}`)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <NavProvider lookup={lookup}>
        <EventStreamPage />
      </NavProvider>
    </QueryClientProvider>,
  )
  await advance(0)
  return view
}

const calls = () => h.client.runRealtimeReport.mock.calls.length
const param = (key: string) => new URLSearchParams(window.location.search).get(key)
const star = (name: string) => screen.getByRole('button', { name: `${name} 지켜보기` })
const row = (name: string) => star(name).closest('tr') as HTMLElement
const bodyRows = () => screen.getAllByRole('row').slice(1)
const counts = (name: string) =>
  within(row(name))
    .getAllByRole('cell')
    .slice(2, 5)
    .map((cell) => cell.textContent)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  h.client = { runRealtimeReport: vi.fn(async () => stream) }
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('EventStreamPage', () => {
  it('lists events with now, 5-minute and 30-minute counts', async () => {
    await open()
    expect(screen.getByRole('heading', { level: 2, name: '최근 30분 이벤트' })).toBeInTheDocument()
    expect(within(row('screen_view')).getByText('화면 조회')).toBeInTheDocument()
    expect(within(row('screen_view')).getByText('screen_view')).toBeInTheDocument()
    expect(counts('screen_view')).toEqual(['3', '9', '14'])
    expect(
      screen.getByText('여러 사람이 함께 쓰면 이벤트가 섞여 보여요. 플랫폼과 앱 버전으로 좁혀 보세요.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('이벤트 검색')).toBeInTheDocument()
    expect(screen.queryByText(NO_MATCH)).toBeNull()
    expect(screen.queryByText(NOTHING_ARRIVED)).toBeNull()
  })

  it('filters by platform without another request', async () => {
    await open()
    const before = calls()
    const select = screen.getByLabelText('플랫폼') as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['전체', 'Android', 'iOS'])
    fireEvent.change(select, { target: { value: 'iOS' } })
    expect(counts('screen_view')[2]).toBe('2')
    expect(calls()).toBe(before)
    expect(param('platform')).toBe('iOS')
    fireEvent.change(select, { target: { value: '' } })
    expect(param('platform')).toBeNull()
    expect(counts('screen_view')[2]).toBe('14')
  })

  it('writes (not set) for the unknown option', async () => {
    await open()
    const select = screen.getByLabelText('앱 버전') as HTMLSelectElement
    const unknown = within(select).getByRole('option', { name: '알 수 없음' }) as HTMLOptionElement
    fireEvent.change(select, { target: { value: unknown.value } })
    expect(param('ver')).toBe('(not set)')
    expect(select.value).toBe('(not set)')
    expect(counts('session_start')[2]).toBe('3')
  })

  it('reads filters from the URL and keeps an absent selected value in the list', async () => {
    await open('platform=web')
    expect((screen.getByLabelText('플랫폼') as HTMLSelectElement).value).toBe('web')
    expect(screen.getByText(NO_MATCH)).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('clears q, platform and ver but keeps watch', async () => {
    await open('q=x&platform=iOS&ver=1.4.0&watch=screen_view')
    fireEvent.click(screen.getByRole('button', { name: '필터 지우기' }))
    expect(window.location.search).toBe('?menu=event-stream&watch=screen_view')
    expect((screen.getByLabelText('이벤트 검색') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('플랫폼') as HTMLSelectElement).value).toBe('')
    expect(screen.queryByText(NO_MATCH)).toBeNull()
    expect(bodyRows()).toHaveLength(3)
  })

  it('pins watched events, shows a zero row for one that has not arrived, and ignores the search for them', async () => {
    await open('watch=not_yet&q=purchase')
    const rows = bodyRows()
    expect(rows).toHaveLength(2)
    expect(rows[0]).toBe(row('not_yet'))
    expect(counts('not_yet')).toEqual(['0', '0', '0'])
    expect(rows[1]).toBe(row('purchase_done'))
    expect(screen.queryByText(NO_MATCH)).toBeNull()
  })

  it('shows the no-match state under the watched rows', async () => {
    await open('watch=not_yet&platform=web')
    expect(bodyRows()).toEqual([row('not_yet')])
    const text = screen.getByText(NO_MATCH)
    expect(screen.getByRole('button', { name: '필터 지우기' })).toBeInTheDocument()
    expect(screen.getByRole('table').compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows the nothing-arrived state under the watched rows', async () => {
    h.client.runRealtimeReport.mockResolvedValue(streamEmpty)
    await open('watch=not_yet')
    expect(bodyRows()).toEqual([row('not_yet')])
    const text = screen.getByText(NOTHING_ARRIVED)
    expect(screen.getByRole('table').compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('button', { name: '필터 지우기' })).toBeNull()
  })

  it('normalises a messy watch param when a star is pressed', async () => {
    await open(`watch=${encodeURIComponent(',a,,a, b')}`)
    expect(star('a')).toHaveAttribute('aria-pressed', 'true')
    expect(star('b')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(star('screen_view'))
    expect(param('watch')).toBe('a,b,screen_view')
  })

  it('keeps focus on the star after the row moves to the top', async () => {
    await open()
    const button = star('purchase_done')
    expect(bodyRows()[0]).not.toBe(row('purchase_done'))
    button.focus()
    fireEvent.click(button)
    expect(bodyRows()[0]).toBe(row('purchase_done'))
    expect(star('purchase_done')).toHaveAttribute('aria-pressed', 'true')
    expect(document.activeElement).toBe(star('purchase_done'))
  })

  it('tags new and grown events and announces only watched ones', async () => {
    h.client.runRealtimeReport.mockResolvedValueOnce(stream).mockResolvedValue(
      withExtra(stream as RunReportResponse, [
        ['screen_view', 0, 'iOS', '1.4.0', 2],
        ['new_event', 0, 'Android', '1.5.0', 1],
      ]),
    )
    const { container } = await open('watch=screen_view')
    const live = container.querySelector('[aria-live="polite"]') as HTMLElement
    expect(live).not.toBeNull()
    expect(live.textContent).toBe('')
    await advance(5000)
    expect(within(row('new_event')).getByText(/^새로 들어옴/)).toBeInTheDocument()
    expect(within(row('screen_view')).getByText(/^▲ \+2/)).toBeInTheDocument()
    expect(live.textContent).toBe('화면 조회 2번 더 들어왔어요')
  })

  it('announces a watched event that is new', async () => {
    h.client.runRealtimeReport
      .mockResolvedValueOnce(stream)
      .mockResolvedValue(withExtra(stream as RunReportResponse, [['first_open', 0, 'Android', '1.5.0', 1]]))
    const { container } = await open('watch=first_open')
    await advance(5000)
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('처음 앱 열기 새로 들어왔어요')
  })

  it('pauses and resumes', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: '일시정지' }))
    expect(screen.getByRole('button', { name: '다시 시작' })).toBeInTheDocument()
    expect(screen.getByText('일시정지했어요')).toBeInTheDocument()
    const before = calls()
    await advance(10_000)
    expect(calls()).toBe(before)
    fireEvent.click(screen.getByRole('button', { name: '다시 시작' }))
    await advance(0)
    expect(calls()).toBe(before + 1)
  })

  it('keeps the table when a refresh fails', async () => {
    h.client.runRealtimeReport.mockResolvedValueOnce(stream).mockRejectedValue(new GaError('network'))
    await open()
    await advance(5000)
    expect(calls()).toBe(2)
    expect(counts('screen_view')).toEqual(['3', '9', '14'])
    expect(screen.getByText('불러오지 못해서 다시 시도하고 있어요')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows the realtime quota message once when the first load hits the quota', async () => {
    h.client.runRealtimeReport.mockRejectedValue(new GaError('quota'))
    await open()
    expect(screen.getByText(QUOTA)).toBeInTheDocument()
    expect(screen.queryByText(/오늘 조회 한도/)).toBeNull()
    const before = calls()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await advance(0)
    expect(calls()).toBe(before + 1)
  })

  it('leaves other first-load failures and the first load itself to the card state', async () => {
    h.client.runRealtimeReport.mockRejectedValue(new GaError('server'))
    window.history.replaceState(null, '', '/?menu=event-stream')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <NavProvider lookup={lookup}>
          <EventStreamPage />
        </NavProvider>
      </QueryClientProvider>,
    )
    expect(screen.getByRole('status', { name: '불러오는 중' })).toBeInTheDocument()
    await advance(0)
    expect(screen.getByText('불러오지 못했어요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })

  it('warns when rows were truncated', async () => {
    h.client.runRealtimeReport.mockResolvedValue({ ...stream, rowCount: 100 })
    await open()
    const note = screen.getByText('이벤트가 많아서 오래된 기록 일부가 빠졌어요. 30분 횟수가 실제보다 적을 수 있어요.')
    expect(screen.getByRole('table').compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('does not warn when nothing was truncated', async () => {
    await open()
    expect(screen.queryByText(/오래된 기록 일부가 빠졌어요/)).toBeNull()
  })

  it('opens the dictionary on the event', async () => {
    await open()
    fireEvent.click(within(row('purchase_done')).getByRole('button', { name: '사전에서 보기' }))
    expect(window.location.search).toBe('?menu=event-dictionary&period=7d&event=purchase_done')
  })

  it('defines the menu', () => {
    expect(menu).toMatchObject({
      id: 'event-stream',
      group: 'devtools',
      order: 210,
      label: '실시간 이벤트',
      usesPeriod: false,
      usesGa: false,
    })
    expect(menu.description).toBe('방금 들어온 이벤트를 바로 확인해요')
    expect(menu.keywords).toEqual(['QA', '디버그', 'debugview', 'realtime', '스트림'])
  })
})
