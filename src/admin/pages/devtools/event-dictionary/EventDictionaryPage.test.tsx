import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GaError } from '../../../ga/errors'
import type { CatalogEvent } from '../../../ga/eventCatalog'
import { NavProvider } from '../../../menu/NavContext'
import type { MenuLookup } from '../../../menu/registry'
import metadata from './__fixtures__/metadata.json'
import observedFixture from './__fixtures__/observed.json'
import recentFixture from './__fixtures__/recent.json'
import { CSV_HEADERS } from './dictionary'
import menu from './EventDictionaryPage.menu'
import { EventDictionaryPage } from './EventDictionaryPage'

type Ranges = {
  current: { startDate: string; endDate: string }
  previous: { startDate: string; endDate: string }
  days: number
}

const h = vi.hoisted(() => {
  const catalog: CatalogEvent[] = [
    { name: 'screen_view', label: '화면 조회', description: '화면을 볼 때 기록돼요.', kind: 'auto', params: [] },
    { name: 'app_remove', label: '앱 삭제', description: '앱을 지울 때 기록돼요.', kind: 'auto', params: [] },
    {
      name: 'purchase_done',
      label: '구매 완료',
      description: '구매가 끝나면 기록돼요.',
      kind: 'app',
      params: [{ name: 'item_id', type: 'string', description: '상품 ID' }],
    },
    { name: 'only_android', label: '안드로이드 전용', description: '', kind: 'app', params: [], platforms: ['Android'] },
    { name: 'both_needed', label: '둘 다', description: '둘 다 보내요.', kind: 'app', params: [] },
    { name: 'never_sent', label: '', description: '설명이 있어요.', kind: 'app', params: [] },
  ]
  return {
    catalog,
    ranges: null as Ranges | null,
    downloadCsv: vi.fn(),
    client: {} as {
      runReport: ReturnType<typeof vi.fn>
      runRealtimeReport: ReturnType<typeof vi.fn>
      getMetadata: ReturnType<typeof vi.fn>
    },
  }
})

vi.mock('../../../ga/eventCatalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../ga/eventCatalog')>()
  return {
    targetPlatforms: actual.targetPlatforms,
    ALL_PLATFORMS: actual.ALL_PLATFORMS,
    EVENT_CATALOG: h.catalog,
    findEvent: (name: string) => h.catalog.find((e) => e.name === name),
  }
})

vi.mock('../../../hooks/useGa', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../hooks/useGa')>()
  return { ...actual, useGa: () => ({ client: h.client, ranges: h.ranges }) }
})

vi.mock('../../../lib/csv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/csv')>()
  return { ...actual, downloadCsv: h.downloadCsv }
})

const goodRanges: Ranges = {
  current: { startDate: '2026-09-22', endDate: '2026-09-28' },
  previous: { startDate: '2026-09-15', endDate: '2026-09-21' },
  days: 7,
}

const MENUS = ['event-stream', 'event-dictionary']
const lookup: MenuLookup = {
  defaultMenu: 'event-stream',
  isMenu: (id) => MENUS.includes(id),
  usesPeriod: (id) => id === 'event-dictionary',
}

const NO_MATCH = '조건에 맞는 이벤트가 없어요'
const COPY = '카탈로그 항목 복사'
const COPIED = '복사했어요'
const TODAY_ONLY_SNIPPET = "{ name: 'today_only', label: '', description: '', kind: 'app', params: [] },"
const ALL_NAMES = [
  'only_android',
  'typo_evnt',
  'both_needed',
  'never_sent',
  'today_only',
  'screen_view',
  'purchase_done',
  'app_remove',
]

/** Moves fake time forward inside act; the extra millisecond runs TanStack Query's zero-delay notify timers. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
    await vi.advanceTimersByTimeAsync(1)
  })
}

/** Renders the page at `?menu=event-dictionary` plus `params`; the requests are still in flight. */
function mount(params = '') {
  window.history.replaceState(null, '', `/?menu=event-dictionary${params ? `&${params}` : ''}`)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <NavProvider lookup={lookup}>
        <EventDictionaryPage />
      </NavProvider>
    </QueryClientProvider>,
  )
}

/** Like `mount`, and waits until every request has settled. */
async function open(params = '') {
  const view = mount(params)
  await waitFor(() => expect(view.container.querySelector('.adm-skeleton__bar')).toBeNull())
  return view
}

const never = () => new Promise<never>(() => {})
const param = (key: string) => new URLSearchParams(window.location.search).get(key)
const button = (name: string) => screen.getByRole('button', { name })
const expander = (name: string) => button(`${name} 자세히 보기`)
const row = (name: string) => expander(name).closest('tr') as HTMLElement
const names = () =>
  screen.queryAllByRole('button', { name: / 자세히 보기$/ }).map((b) => b.getAttribute('aria-label')!.split(' ')[0])
const detail = (name: string) => document.getElementById(expander(name).getAttribute('aria-controls')!) as HTMLElement
const card = (title: string) => screen.getByRole('heading', { level: 2, name: title }).closest('section') as HTMLElement
const search = () => screen.getByLabelText('검색') as HTMLInputElement
function commitSearch(text: string) {
  fireEvent.change(search(), { target: { value: text } })
  fireEvent.keyDown(search(), { key: 'Enter' })
}

beforeEach(() => {
  h.ranges = goodRanges
  h.downloadCsv.mockReset()
  h.client = {
    runReport: vi.fn(async () => observedFixture),
    runRealtimeReport: vi.fn(async () => recentFixture),
    getMetadata: vi.fn(async () => metadata),
  }
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'clipboard')
  window.history.replaceState(null, '', '/')
})

describe('EventDictionaryPage', () => {
  it('shows the catalog at once and fills counts when observation arrives', async () => {
    let release!: (v: unknown) => void
    h.client.runReport = vi.fn(() => new Promise((r) => (release = r)))
    mount()
    expect(within(row('screen_view')).getByText('화면 조회')).toBeInTheDocument()
    expect(within(row('screen_view')).getByText('자동 수집')).toBeInTheDocument()
    expect(row('screen_view').querySelector('.adm-skeleton__bar')).not.toBeNull()
    expect(button('사전에 없음 —')).toBeInTheDocument()
    expect(button('안 들어옴 —')).toBeInTheDocument()
    expect(button('전체 6')).toHaveAttribute('aria-pressed', 'true')

    await act(async () => release(observedFixture))
    expect(await within(row('screen_view')).findByText('160번')).toBeInTheDocument()
    expect(row('screen_view').querySelector('.adm-skeleton__bar')).toBeNull()
    expect(within(row('screen_view')).getByText('정상')).toBeInTheDocument()
    expect(button('사전에 없음 2')).toBeInTheDocument()
    expect(button('전체 8')).toBeInTheDocument()
    expect(names()).toEqual(ALL_NAMES)
  })

  it('states the period it judged by', async () => {
    await open()
    expect(screen.getByText('2026-09-22 ~ 2026-09-28과 최근 30분을 기준으로 판정했어요')).toBeInTheDocument()
    expect(screen.queryByText('오늘 들어온 이벤트는 확인하지 못했어요')).toBeNull()
  })

  it('filters by a status button and toggles back to all', async () => {
    await open()
    fireEvent.click(button('사전에 없음 2'))
    expect(param('status')).toBe('unknown')
    expect(button('사전에 없음 2')).toHaveAttribute('aria-pressed', 'true')
    expect(button('전체 8')).toHaveAttribute('aria-pressed', 'false')
    expect(names()).toEqual(['typo_evnt', 'today_only'])

    fireEvent.click(button('사전에 없음 2'))
    expect(param('status')).toBeNull()
    expect(button('사전에 없음 2')).toHaveAttribute('aria-pressed', 'false')
    expect(names()).toEqual(ALL_NAMES)
  })

  it('keeps zero-count status buttons', async () => {
    await open()
    expect(button('일부 플랫폼만 0')).toBeInTheDocument()
    expect(button('안 들어옴 2')).toBeInTheDocument()
    expect(button('설명 없음 1')).toBeInTheDocument()
  })

  it('searches through SearchField and writes q', async () => {
    await open()
    expect(search()).toHaveAttribute('placeholder', '이벤트 이름이나 설명')
    commitSearch('item_id')
    expect(param('q')).toBe('item_id')
    expect(names()).toEqual(['purchase_done'])

    commitSearch('(')
    expect(param('q')).toBe('(')
    expect(names()).toEqual([])
    expect(screen.getByText(NO_MATCH)).toBeInTheDocument()
  })

  it('expands one event at a time and mirrors it in the URL', async () => {
    await open()
    const purchase = expander('purchase_done')
    expect(purchase).toHaveAttribute('aria-expanded', 'false')
    purchase.focus()
    fireEvent.click(purchase)
    expect(expander('purchase_done')).toBe(purchase)
    expect(purchase).toHaveAttribute('aria-expanded', 'true')
    expect(purchase).toHaveFocus()
    expect(param('event')).toBe('purchase_done')

    const content = detail('purchase_done')
    expect(row('purchase_done').nextElementSibling).toContainElement(content)
    expect(within(content).getByText('구매가 끝나면 기록돼요.')).toBeInTheDocument()
    const itemId = within(content).getByText('item_id').closest('tr') as HTMLElement
    expect(within(itemId).getByText('GA 등록됨')).toBeInTheDocument()
    expect(within(itemId).getByText('string')).toBeInTheDocument()
    expect(within(content).getByText('Android 30번 · 10명')).toBeInTheDocument()
    expect(within(content).getByText('iOS 11번 · 5명')).toBeInTheDocument()
    expect(within(content).queryByRole('button', { name: COPY })).toBeNull()

    fireEvent.click(expander('screen_view'))
    expect(purchase).toHaveAttribute('aria-expanded', 'false')
    expect(purchase).not.toHaveAttribute('aria-controls')
    expect(param('event')).toBe('screen_view')
    expect(within(detail('screen_view')).getByText('최근 30분: Android 3번')).toBeInTheDocument()
    expect(document.querySelectorAll('[aria-expanded="true"]')).toHaveLength(1)

    fireEvent.click(expander('screen_view'))
    expect(param('event')).toBeNull()
    expect(document.querySelectorAll('[aria-expanded="true"]')).toHaveLength(0)
  })

  it('says so when an event has no description', async () => {
    await open()
    fireEvent.click(expander('only_android'))
    expect(within(detail('only_android')).getByText('아직 설명이 없어요')).toBeInTheDocument()
  })

  it('tags events seen only today', async () => {
    await open()
    expect(within(row('today_only')).getByText('오늘 들어옴')).toBeInTheDocument()
    expect(within(row('typo_evnt')).queryByText('오늘 들어옴')).toBeNull()
    expect(within(row('today_only')).getByText('—')).toBeInTheDocument()
  })

  it('shows a filtered-out event from the URL on top with a note, outside the counts', async () => {
    await open('status=unknown&event=screen_view')
    expect(names()).toEqual(['screen_view', 'typo_evnt', 'today_only'])
    expect(within(row('screen_view')).getByText('필터와 상관없이 보여요')).toBeInTheDocument()
    expect(expander('screen_view')).toHaveAttribute('aria-expanded', 'true')
    expect(button('사전에 없음 2')).toBeInTheDocument()
    expect(button('전체 8')).toBeInTheDocument()

    fireEvent.click(button('CSV 받기'))
    const csv = h.downloadCsv.mock.calls[0][1] as string
    expect(csv).toContain('typo_evnt')
    expect(csv).toContain('today_only')
    expect(csv).not.toContain('screen_view')
  })

  it('cannot vouch for an unlisted event while observation has failed', async () => {
    h.client.runReport = vi.fn().mockRejectedValue(new GaError('server'))
    await open('event=today_only')
    expect(names()[0]).toBe('today_only')
    expect(
      within(detail('today_only')).getByText('수집 현황을 확인하지 못해서 이 이벤트의 기록을 알 수 없어요'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: COPY })).toBeNull()
    expect(screen.queryByText('이 기간과 최근 30분에 들어온 기록이 없어요')).toBeNull()
  })

  it('shows a skeleton for an observation-only status while observation is pending', async () => {
    h.client.runReport = vi.fn(never)
    mount('status=missing')
    await within(card('GA에 등록된 파라미터')).findByText('item_id')
    expect(within(card('이벤트')).getByRole('status', { name: '불러오는 중' })).toBeInTheDocument()
    expect(screen.queryByText(NO_MATCH)).toBeNull()
    expect(names()).toEqual([])
    expect(button('안 들어옴 —')).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows a placeholder row for a name with no record', async () => {
    await open('event=ghost_event')
    expect(names()).toEqual(['ghost_event', ...ALL_NAMES])
    expect(expander('ghost_event')).toHaveAttribute('aria-expanded', 'true')
    const content = detail('ghost_event')
    expect(within(content).getByText('이 기간과 최근 30분에 들어온 기록이 없어요')).toBeInTheDocument()
    expect(within(content).getByRole('button', { name: COPY })).toBeInTheDocument()
    expect(button('전체 8')).toBeInTheDocument()
    expect(button('사전에 없음 2')).toBeInTheDocument()
  })

  it('shows a skeleton in the placeholder row while observation is pending', async () => {
    h.client.runReport = vi.fn(never)
    mount('event=ghost_event')
    await within(card('GA에 등록된 파라미터')).findByText('item_id')
    expect(within(detail('ghost_event')).getByRole('status', { name: '불러오는 중' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: COPY })).toBeNull()
  })

  it('keeps the expand button of a placeholder row when the event turns out to be listed', async () => {
    let release!: (v: unknown) => void
    h.client.runReport = vi.fn(() => new Promise((r) => (release = r)))
    mount('event=today_only')
    const toggle = expander('today_only')
    toggle.focus()
    expect(names()[0]).toBe('today_only')

    await act(async () => release(observedFixture))
    expect(await within(row('today_only')).findByText('오늘 들어옴')).toBeInTheDocument()
    expect(names()).toEqual(ALL_NAMES)
    expect(expander('today_only')).toBe(toggle)
    expect(toggle).toHaveFocus()
    expect(within(detail('today_only')).getByText('최근 30분: iOS 1번')).toBeInTheDocument()
  })

  it('moves focus to the first listed row when a pinned row is collapsed', async () => {
    await open('status=unknown&event=screen_view')
    expander('screen_view').focus()
    fireEvent.click(expander('screen_view'))
    expect(param('event')).toBeNull()
    expect(names()).toEqual(['typo_evnt', 'today_only'])
    expect(expander('typo_evnt')).toHaveFocus()
  })

  it('moves focus to the first listed row when a placeholder row is collapsed', async () => {
    await open('event=ghost_event')
    expander('ghost_event').focus()
    fireEvent.click(expander('ghost_event'))
    expect(names()).toEqual(ALL_NAMES)
    expect(expander('only_android')).toHaveFocus()
  })

  it('moves focus to the chosen status button when a pinned row is collapsed over an empty list', async () => {
    await open('q=zzz&status=unknown&event=screen_view')
    expander('screen_view').focus()
    fireEvent.click(expander('screen_view'))
    expect(param('event')).toBeNull()
    expect(names()).toEqual([])
    expect(button('사전에 없음 2')).toHaveAttribute('aria-pressed', 'true')
    expect(button('사전에 없음 2')).toHaveFocus()
  })

  it('keeps focus in the list when a listed row is collapsed', async () => {
    await open()
    const toggle = expander('purchase_done')
    toggle.focus()
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(param('event')).toBeNull()
    expect(toggle).toHaveFocus()
  })

  it('offers no snippet for a name that is not a valid event name', async () => {
    await open(`event=${encodeURIComponent("x', evil")}`)
    const content = detail("x', evil")
    expect(within(content).getByText('이 기간과 최근 30분에 들어온 기록이 없어요')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: COPY })).toBeNull()
  })

  it('does not claim the recent check for a placeholder row when that check failed', async () => {
    h.client.runRealtimeReport = vi.fn().mockRejectedValue(new GaError('server'))
    await open('event=ghost_event')
    const content = detail('ghost_event')
    expect(
      within(content).getByText('이 기간에 들어온 기록이 없어요. 오늘 들어온 이벤트는 확인하지 못했어요.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('이 기간과 최근 30분에 들어온 기록이 없어요')).toBeNull()
    expect(within(content).getByRole('button', { name: COPY })).toBeInTheDocument()
  })

  it('cannot vouch for an unlisted event while the period is invalid', async () => {
    h.ranges = null
    await open('event=ghost_event')
    expect(
      within(detail('ghost_event')).getByText('수집 현황을 확인하지 못해서 이 이벤트의 기록을 알 수 없어요'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: COPY })).toBeNull()
    expect(h.client.runReport).not.toHaveBeenCalled()
  })

  it('keeps the retry button in place while a retry is in flight and moves focus on success', async () => {
    let settle!: { resolve(v: unknown): void; reject(e: unknown): void }
    h.client.runReport = vi
      .fn()
      .mockRejectedValueOnce(new GaError('server'))
      .mockImplementation(() => new Promise((resolve, reject) => (settle = { resolve, reject })))
    await open()
    const alert = within(card('이벤트')).getByRole('alert')
    const retry = within(alert).getByRole('button', { name: '다시 시도' })
    const firstText = within(alert).getByText('수집 현황을 불러오지 못했어요')
    retry.focus()
    fireEvent.click(retry)
    await waitFor(() => expect(h.client.runReport).toHaveBeenCalledTimes(2))
    expect(within(alert).getByRole('button', { name: '불러오는 중' })).toBe(retry)
    expect(retry).toHaveAttribute('aria-disabled', 'true')
    expect(retry).toHaveFocus()
    fireEvent.click(retry)
    expect(h.client.runReport).toHaveBeenCalledTimes(2)

    await act(async () => settle.reject(new GaError('server')))
    await waitFor(() => expect(retry).toHaveTextContent('다시 시도'))
    expect(retry).toBeInTheDocument()
    expect(retry).toHaveAttribute('aria-disabled', 'false')
    expect(retry).toHaveFocus()
    // The second failure is a new node, so it is announced again.
    expect(within(alert).getByText('수집 현황을 불러오지 못했어요')).not.toBe(firstText)

    fireEvent.click(retry)
    await waitFor(() => expect(h.client.runReport).toHaveBeenCalledTimes(3))
    await act(async () => settle.resolve(observedFixture))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(await within(row('screen_view')).findByText('160번')).toBeInTheDocument()
    expect(search()).toHaveFocus()
  })

  it('drops the event param when a filter changes', async () => {
    await open('event=purchase_done')
    expect(expander('purchase_done')).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(button('설명 없음 1'))
    expect(param('status')).toBe('undocumented')
    expect(param('event')).toBeNull()
    expect(names()).toEqual(['only_android'])

    fireEvent.click(expander('only_android'))
    expect(param('event')).toBe('only_android')
    commitSearch('android')
    expect(param('q')).toBe('android')
    expect(param('event')).toBeNull()
  })

  it('copies the catalog snippet and confirms for 2 seconds', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    mount('event=today_only')
    await advance(0)
    await advance(0)
    const content = detail('today_only')
    const copy = within(content).getByRole('button', { name: COPY })
    const status = within(content).getByRole('status')
    expect(status).toBeEmptyDOMElement()

    copy.focus()
    fireEvent.click(copy)
    await advance(0)
    expect(writeText).toHaveBeenCalledWith(TODAY_ONLY_SNIPPET)
    expect(copy).toHaveTextContent(COPIED)
    expect(copy).toHaveFocus()
    expect(status).toHaveTextContent(COPIED)
    expect(within(content).queryByRole('textbox')).toBeNull()
    const firstMessage = status.firstElementChild

    // A second copy is announced again: the same words arrive as a new node.
    await advance(1000)
    fireEvent.click(copy)
    await advance(0)
    expect(status).toHaveTextContent(COPIED)
    expect(status.firstElementChild).not.toBe(firstMessage)

    await advance(1500)
    expect(copy).toHaveTextContent(COPIED)
    await advance(500)
    expect(copy).toHaveTextContent(COPY)
    expect(within(content).getByRole('status')).toBe(status)
    expect(status).toBeEmptyDOMElement()
  })

  it('falls back to a selectable text box when the clipboard is missing or rejects', async () => {
    const first = await open('event=today_only')
    expect('clipboard' in navigator).toBe(false)
    fireEvent.click(button(COPY))
    const box = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    expect(box.tagName).toBe('TEXTAREA')
    expect(box.readOnly).toBe(true)
    expect(box.value).toBe(TODAY_ONLY_SNIPPET)
    expect([box.selectionStart, box.selectionEnd]).toEqual([0, TODAY_ONLY_SNIPPET.length])
    expect(button(COPY)).toBeInTheDocument()
    first.unmount()

    const writeText = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    await open('event=today_only')
    fireEvent.click(button(COPY))
    const rejected = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(rejected.value).toBe(TODAY_ONLY_SNIPPET)
    expect([rejected.selectionStart, rejected.selectionEnd]).toEqual([0, TODAY_ONLY_SNIPPET.length])
    expect(screen.queryByRole('button', { name: COPIED })).toBeNull()
  })

  it('exports the filtered rows as CSV', async () => {
    await open('status=unknown')
    fireEvent.click(button('CSV 받기'))
    expect(h.downloadCsv).toHaveBeenCalledTimes(1)
    const [filename, csv] = h.downloadCsv.mock.calls[0] as [string, string]
    expect(filename).toBe('parfait-event-dictionary-2026-09-22_2026-09-28.csv')
    const lines = csv.replace('﻿', '').split('\r\n')
    expect(lines[0]).toBe(CSV_HEADERS.join(','))
    expect(lines.slice(1).map((line) => line.split(',')[0])).toEqual(['typo_evnt', 'today_only'])
  })

  it('keeps the catalog and offers a retry when observation fails', async () => {
    h.client.runReport = vi.fn().mockRejectedValueOnce(new GaError('server')).mockResolvedValue(observedFixture)
    await open()
    const alert = within(card('이벤트')).getByRole('alert')
    expect(within(alert).getByText('수집 현황을 불러오지 못했어요')).toBeInTheDocument()
    expect(within(row('screen_view')).getByText('화면 조회')).toBeInTheDocument()
    expect(within(row('screen_view')).getByText('—')).toBeInTheDocument()
    expect(button('사전에 없음 —')).toBeInTheDocument()
    expect(screen.queryByText(/기준으로 판정했어요$/)).toBeNull()

    fireEvent.click(within(alert).getByRole('button', { name: '다시 시도' }))
    expect(await within(row('screen_view')).findByText('160번')).toBeInTheDocument()
    expect(h.client.runReport).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('수집 현황을 불러오지 못했어요')).toBeNull()
  })

  it('shows the unknown-status list as an error while observation has failed', async () => {
    h.client.runReport = vi.fn().mockRejectedValue(new GaError('server'))
    await open('status=unknown')
    const alert = within(card('이벤트')).getByRole('alert')
    expect(within(alert).getByText('수집 현황을 불러오지 못했어요')).toBeInTheDocument()
    expect(within(alert).getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    expect(screen.queryByText(NO_MATCH)).toBeNull()
    expect(names()).toEqual([])
  })

  it('notes when only the recent check failed', async () => {
    h.client.runRealtimeReport = vi.fn().mockRejectedValue(new GaError('server'))
    await open()
    expect(screen.getByText('오늘 들어온 이벤트는 확인하지 못했어요')).toBeInTheDocument()
    expect(screen.getByText('2026-09-22 ~ 2026-09-28과 최근 30분을 기준으로 판정했어요')).toBeInTheDocument()
    expect(within(row('screen_view')).getByText('160번')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('asks for a new period when the period is invalid', async () => {
    h.ranges = null
    await open()
    expect(screen.getByText('기간을 다시 골라 주세요')).toBeInTheDocument()
    expect(h.client.runReport).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'CSV 받기' })).toBeNull()
    expect(within(row('screen_view')).getByText('—')).toBeInTheDocument()
    expect(screen.queryByText(/기준으로 판정했어요$/)).toBeNull()
  })

  it('lists GA params with their kind and flags unlisted ones', async () => {
    await open()
    const params = within(card('GA에 등록된 파라미터'))
    const itemId = params.getByText('item_id').closest('tr') as HTMLElement
    expect(within(itemId).getByText('측정기준')).toBeInTheDocument()
    expect(within(itemId).getByText('상품 ID')).toBeInTheDocument()
    expect(within(itemId).queryByText('사전에 없음')).toBeNull()
    const price = params.getByText('price').closest('tr') as HTMLElement
    expect(within(price).getByText('측정항목')).toBeInTheDocument()
    expect(within(price).getByText('가격')).toBeInTheDocument()
    expect(within(price).getByText('사전에 없음')).toBeInTheDocument()
  })

  it('confines a metadata failure to its card', async () => {
    h.client.getMetadata = vi.fn().mockRejectedValue(new GaError('server'))
    await open()
    expect(within(card('GA에 등록된 파라미터')).getByText('불러오지 못했어요')).toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(within(row('screen_view')).getByText('160번')).toBeInTheDocument()
    fireEvent.click(expander('purchase_done'))
    expect(within(detail('purchase_done')).getByText('item_id')).toBeInTheDocument()
    expect(screen.queryByText('GA 등록됨')).toBeNull()
  })

  it('says so when GA has no registered params', async () => {
    h.client.getMetadata = vi.fn(async () => ({ dimensions: [{ apiName: 'eventName' }], metrics: [] }))
    await open()
    expect(within(card('GA에 등록된 파라미터')).getByText('GA에 등록된 파라미터가 없어요')).toBeInTheDocument()
  })

  it('clears q, status and event', async () => {
    await open('q=zzz&status=unknown&event=screen_view')
    expect(names()).toEqual(['screen_view'])
    expect(search().value).toBe('zzz')
    expect(screen.getByText(NO_MATCH)).toBeInTheDocument()

    button('필터 지우기').focus()
    fireEvent.click(button('필터 지우기'))
    expect(search()).toHaveFocus()
    expect(param('q')).toBeNull()
    expect(param('status')).toBeNull()
    expect(param('event')).toBeNull()
    expect(search().value).toBe('')
    expect(names()).toEqual(ALL_NAMES)
    expect(screen.queryByText(NO_MATCH)).toBeNull()
  })

  it('defines the menu', () => {
    expect(menu).toMatchObject({
      id: 'event-dictionary',
      group: 'devtools',
      order: 220,
      label: '이벤트 사전',
      usesPeriod: true,
      usesGa: true,
    })
    expect(menu.description).toBe('이벤트의 뜻과 파라미터를 찾아봐요')
    expect(menu.keywords).toEqual(['이벤트', '파라미터', '정의', '미등록', 'dictionary'])
  })
})
