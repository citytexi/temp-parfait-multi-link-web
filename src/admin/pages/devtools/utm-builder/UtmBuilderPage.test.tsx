import type { ReactElement } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { downloadBlob } from '../../../lib/download'
import { NavProvider } from '../../../menu/NavContext'
import type { MenuLookup } from '../../../menu/registry'
import { RECENT_KEY } from './config'
import { QR_LABEL, qrPngBlob } from './qr'
import { UtmBuilderPage } from './UtmBuilderPage'
import menu from './UtmBuilderPage.menu'

vi.mock('../../../lib/download', () => ({ downloadBlob: vi.fn() }))
vi.mock('./qr', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./qr')>()),
  qrPngBlob: vi.fn(async () => new Blob(['png'])),
}))

const LINK =
  'https://citytexi.github.io/temp-parfait-multi-link-web/?utm_source=instagram&utm_medium=social&utm_campaign=202610-launch&utm_content=story'
const LINK_STATE = '?menu=utm-builder&ch=instagram&camp=202610-launch&content=story'
const NOT_SAVED = '이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요.'

const lookup: MenuLookup = {
  defaultMenu: 'overview',
  isMenu: (id) => ['overview', 'utm-builder', 'ua-tester', 'link-hub', 'release-checklist'].includes(id),
  usesPeriod: () => false,
}
function renderAt(search: string, page: ReactElement) {
  window.history.replaceState(null, '', `/admin/${search}`)
  return render(<NavProvider lookup={lookup}>{page}</NavProvider>)
}
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })
const flush = () => act(async () => { for (let i = 0; i < 5; i += 1) await Promise.resolve() })

const select = () => screen.getByLabelText<HTMLSelectElement>('어디에 올리나요?')
const field = (label: string) => screen.getByLabelText<HTMLInputElement>(label)
const pick = (id: string) => fireEvent.change(select(), { target: { value: id } })
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } })
const button = (name: string) => screen.getByRole('button', { name })
const noButton = (name: string) => expect(screen.queryByRole('button', { name })).toBeNull()

function setClipboard() {
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  return writeText
}
function store(items: unknown[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify({ v: 1, items }))
}
function storedItems(): Record<string, unknown>[] {
  return (JSON.parse(localStorage.getItem(RECENT_KEY) ?? '{}') as { items: Record<string, unknown>[] }).items
}
const record = (over: Record<string, string> = {}) => ({
  channel: 'instagram',
  source: 'instagram',
  medium: 'social',
  campaign: '202610-launch',
  content: 'story',
  createdAt: '2026-10-08T03:00:00.000Z',
  ...over,
})

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.useFakeTimers()
})
afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard')
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('builds the link from a channel, a campaign and a content', () => {
  renderAt('?menu=utm-builder', <UtmBuilderPage />)
  pick('instagram')
  expect(select()).toHaveValue('instagram')
  expect(select()).toHaveAccessibleDescription('source instagram · medium social')
  type('캠페인 이름', '202610-launch')
  type('소재 구분 (선택)', 'story')
  expect(screen.getByText(LINK)).toBeInTheDocument()
  advance(300)
  expect(window.location.search).toBe(LINK_STATE)
})

it('shows what is missing and no copy or QR until the link is valid', () => {
  renderAt('?menu=utm-builder', <UtmBuilderPage />)
  const nothingToTake = () => {
    noButton('링크 복사')
    noButton('PNG 받기')
    noButton('SVG 받기')
    expect(screen.queryByRole('img', { name: QR_LABEL })).toBeNull()
    expect(screen.queryByText('Android에서는 이렇게 Play로 넘어가요')).toBeNull()
  }
  expect(screen.getByText('어디에 올릴지 고르면 링크가 만들어져요')).toBeInTheDocument()
  nothingToTake()
  pick('instagram')
  expect(screen.getByText('캠페인 이름을 넣으면 링크가 만들어져요')).toBeInTheDocument()
  nothingToTake()
  type('캠페인 이름', 'c')
  expect(button('링크 복사')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: QR_LABEL })).toBeInTheDocument()
  expect(button('PNG 받기')).toBeInTheDocument()
  expect(button('SVG 받기')).toBeInTheDocument()
})

it('reports a format error under its field and withholds the link', () => {
  renderAt('?menu=utm-builder&ch=instagram', <UtmBuilderPage />)
  type('캠페인 이름', '한글')
  const campaign = field('캠페인 이름')
  expect(campaign).toHaveAccessibleDescription(
    expect.stringContaining('영문 소문자, 숫자, 하이픈(-), 밑줄(_)만 쓸 수 있어요'),
  )
  expect(campaign).toHaveAttribute('aria-invalid', 'true')
  expect(field('소재 구분 (선택)')).not.toHaveAttribute('aria-invalid')
  expect(screen.getByText('입력한 값을 고치면 링크가 만들어져요')).toBeInTheDocument()
  noButton('링크 복사')
  expect(screen.queryByText(/utm_campaign=/)).toBeNull()
})

it('uses normalised values in the link before the field is blurred, and rewrites the field on blur', async () => {
  const writeText = setClipboard()
  renderAt('?menu=utm-builder&ch=instagram', <UtmBuilderPage />)
  type('캠페인 이름', '  Summer  Sale ')
  const link =
    'https://citytexi.github.io/temp-parfait-multi-link-web/?utm_source=instagram&utm_medium=social&utm_campaign=summer-sale'
  expect(screen.getByText(link)).toBeInTheDocument()
  expect(field('캠페인 이름')).toHaveValue('  Summer  Sale ')
  fireEvent.click(button('링크 복사'))
  await flush()
  expect(writeText).toHaveBeenCalledWith(link)
  expect(field('캠페인 이름')).toHaveValue('  Summer  Sale ')
  fireEvent.blur(field('캠페인 이름'))
  expect(field('캠페인 이름')).toHaveValue('summer-sale')
  expect(window.location.search).toBe('?menu=utm-builder&ch=instagram&camp=summer-sale')
})

it('shows source and medium fields only for the channels that need them and clears them on a change', () => {
  const first = renderAt('?menu=utm-builder&ch=instagram', <UtmBuilderPage />)
  expect(screen.queryByLabelText('출처 (source)')).toBeNull()
  expect(screen.queryByLabelText('매체 (medium)')).toBeNull()
  pick('paid')
  expect(field('출처 (source)')).toBeInTheDocument()
  expect(screen.queryByLabelText('매체 (medium)')).toBeNull()
  expect(select()).toHaveAccessibleDescription('medium cpc')
  pick('custom')
  expect(field('출처 (source)')).toBeInTheDocument()
  expect(field('매체 (medium)')).toBeInTheDocument()
  expect(select()).not.toHaveAccessibleDescription()
  first.unmount()

  const second = renderAt('?menu=utm-builder&ch=custom&src=a&med=b&camp=c', <UtmBuilderPage />)
  pick('paid')
  expect(window.location.search).toBe('?menu=utm-builder&ch=paid&src=a&camp=c')
  expect(field('출처 (source)')).toHaveValue('a')
  second.unmount()

  renderAt('?menu=utm-builder&ch=custom&src=a&med=b&camp=c', <UtmBuilderPage />)
  pick('instagram')
  expect(window.location.search).toBe('?menu=utm-builder&ch=instagram&camp=c')
  advance(300)
  expect(window.location.search).toBe('?menu=utm-builder&ch=instagram&camp=c')
  pick('custom')
  expect(field('출처 (source)')).toHaveValue('')
  expect(field('매체 (medium)')).toHaveValue('')
})

it('restores the form from the URL and ignores an unknown channel', () => {
  const first = renderAt('?menu=utm-builder&ch=paid&src=google&camp=c', <UtmBuilderPage />)
  expect(select()).toHaveValue('paid')
  expect(field('출처 (source)')).toHaveValue('google')
  expect(field('캠페인 이름')).toHaveValue('c')
  expect(
    screen.getByText(
      'https://citytexi.github.io/temp-parfait-multi-link-web/?utm_source=google&utm_medium=cpc&utm_campaign=c',
    ),
  ).toBeInTheDocument()
  first.unmount()

  renderAt('?menu=utm-builder&ch=nope&camp=c', <UtmBuilderPage />)
  expect(select()).toHaveValue('')
  expect(screen.getByText('어디에 올릴지 고르면 링크가 만들어져요')).toBeInTheDocument()
  noButton('링크 복사')
})

it('previews the Play url the landing would use', () => {
  renderAt(LINK_STATE, <UtmBuilderPage />)
  expect(screen.getByText('Android에서는 이렇게 Play로 넘어가요')).toBeInTheDocument()
  expect(
    screen.getByText(
      'https://play.google.com/store/apps/details?id=com.teamyg.parfait&referrer=utm_source%3Dinstagram%26utm_medium%3Dsocial%26utm_campaign%3D202610-launch%26utm_content%3Dstory',
    ),
  ).toBeInTheDocument()
  expect(screen.getByText('iOS 설치는 캠페인별로 측정되지 않아요')).toBeInTheDocument()
})

it('normalises the field when IME composition ends', () => {
  renderAt('?menu=utm-builder&ch=instagram', <UtmBuilderPage />)
  type('캠페인 이름', ' Launch ')
  expect(field('캠페인 이름')).toHaveValue(' Launch ')
  fireEvent.compositionEnd(field('캠페인 이름'))
  expect(field('캠페인 이름')).toHaveValue('launch')
})

it('sets the input attributes that keep phones from rewriting the text', () => {
  renderAt('?menu=utm-builder&ch=custom', <UtmBuilderPage />)
  for (const label of ['캠페인 이름', '소재 구분 (선택)', '출처 (source)', '매체 (medium)']) {
    const input = field(label)
    expect(input).toHaveAttribute('autocapitalize', 'none')
    expect(input).toHaveAttribute('autocorrect', 'off')
    expect(input).toHaveAttribute('spellcheck', 'false')
  }
})

it('shows the day a record was made, in Seoul time', () => {
  store([record({ createdAt: '2026-10-07T16:00:00.000Z' }), record({ campaign: 'odd', createdAt: 'not a date' })])
  renderAt('?menu=utm-builder', <UtmBuilderPage />)
  const rows = screen.getAllByRole('listitem')
  expect(rows).toHaveLength(2)
  expect(within(rows[0]).getByText('인스타그램 · 202610-launch · story')).toBeInTheDocument()
  expect(within(rows[0]).getByText('10월 8일')).toBeInTheDocument()
  expect(within(rows[1]).getByText('인스타그램 · odd · story')).toBeInTheDocument()
  expect(rows[1]).not.toHaveTextContent('Invalid')
})

it('copies the link and records it', async () => {
  const writeText = setClipboard()
  renderAt(LINK_STATE, <UtmBuilderPage />)
  expect(screen.getByText('아직 만든 링크가 없어요')).toBeInTheDocument()
  noButton('기록 지우기')
  fireEvent.click(button('링크 복사'))
  await flush()
  expect(writeText).toHaveBeenCalledWith(LINK)
  expect(screen.getByText('인스타그램 · 202610-launch · story')).toBeInTheDocument()
  expect(screen.queryByText('아직 만든 링크가 없어요')).toBeNull()
  expect(screen.queryByText(NOT_SAVED)).toBeNull()
  const items = storedItems()
  expect(items).toHaveLength(1)
  expect(items[0]).toEqual({
    channel: 'instagram',
    source: 'instagram',
    medium: 'social',
    campaign: '202610-launch',
    content: 'story',
    createdAt: expect.any(String),
  })
  expect(items[0]).not.toHaveProperty('url')
  const createdAt = items[0].createdAt as string
  expect(new Date(createdAt).toISOString()).toBe(createdAt)
})

it('downloads the SVG and the PNG with the channel in the file name and records the link', async () => {
  renderAt(LINK_STATE, <UtmBuilderPage />)
  fireEvent.click(button('SVG 받기'))
  expect(downloadBlob).toHaveBeenCalledTimes(1)
  const [svgName, svgBlob] = vi.mocked(downloadBlob).mock.calls[0]
  expect(svgName).toBe('parfait-qr-instagram-202610-launch-story.svg')
  expect(svgBlob.type).toBe('image/svg+xml')
  expect(storedItems()).toHaveLength(1)

  fireEvent.click(button('PNG 받기'))
  await flush()
  expect(downloadBlob).toHaveBeenCalledTimes(2)
  const [pngName, pngBlob] = vi.mocked(downloadBlob).mock.calls[1]
  expect(pngName).toBe('parfait-qr-instagram-202610-launch-story.png')
  expect(pngBlob).toBeInstanceOf(Blob)
  expect(storedItems()).toHaveLength(1)
  expect(screen.getAllByRole('listitem')).toHaveLength(1)
  expect(screen.getByText('인스타그램 · 202610-launch · story')).toBeInTheDocument()
})

it('says so when the PNG cannot be made', async () => {
  vi.mocked(qrPngBlob).mockResolvedValueOnce(null)
  renderAt(LINK_STATE, <UtmBuilderPage />)
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  fireEvent.click(button('PNG 받기'))
  await flush()
  expect(downloadBlob).not.toHaveBeenCalled()
  expect(screen.getByRole('status')).toHaveTextContent('PNG를 만들지 못했어요. SVG로 받아 주세요.')
})

it('reopens a record, including one whose channel is gone', () => {
  store([record({ channel: 'gone', source: 's', medium: 'm', campaign: 'c', content: '' })])
  renderAt('?menu=utm-builder', <UtmBuilderPage />)
  fireEvent.click(button('s / m · c 다시 열기'))
  expect(select()).toHaveValue('custom')
  expect(field('출처 (source)')).toHaveValue('s')
  expect(field('매체 (medium)')).toHaveValue('m')
  expect(field('캠페인 이름')).toHaveValue('c')
  expect(field('소재 구분 (선택)')).toHaveValue('')
  expect(window.location.search).toBe('?menu=utm-builder&ch=custom&src=s&med=m&camp=c')
  advance(300)
  expect(window.location.search).toBe('?menu=utm-builder&ch=custom&src=s&med=m&camp=c')
})

it('clears the history after a second press and moves focus to the campaign field', () => {
  store([record()])
  renderAt('?menu=utm-builder', <UtmBuilderPage />)
  const clear = button('기록 지우기')
  clear.focus()
  fireEvent.click(clear)
  expect(clear).toHaveTextContent('정말 지울까요?')
  expect(screen.getByText('인스타그램 · 202610-launch · story')).toBeInTheDocument()
  advance(400)
  fireEvent.click(clear)
  expect(screen.getByText('아직 만든 링크가 없어요')).toBeInTheDocument()
  expect(screen.queryByRole('listitem')).toBeNull()
  noButton('기록 지우기')
  noButton('정말 지울까요?')
  expect(storedItems()).toEqual([])
  expect(document.activeElement).toBe(field('캠페인 이름'))
})

it('keeps the record on screen and says it was not saved when storage is full', async () => {
  setClipboard()
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError')
  })
  renderAt(LINK_STATE, <UtmBuilderPage />)
  expect(screen.queryByText(NOT_SAVED)).toBeNull()
  fireEvent.click(button('링크 복사'))
  await flush()
  expect(screen.getByText('인스타그램 · 202610-launch · story')).toBeInTheDocument()
  expect(screen.getByText(NOT_SAVED)).toBeInTheDocument()
  expect(localStorage.getItem(RECENT_KEY)).toBeNull()
  // The page keeps working: the copy went through and the link is still there.
  expect(button('복사했어요')).toBeInTheDocument()
  expect(screen.getByText(LINK)).toBeInTheDocument()
})

it('defines the menu', () => {
  expect(menu).toMatchObject({
    id: 'utm-builder',
    group: 'devtools',
    order: 110,
    label: '캠페인 링크 만들기',
    description: '어디서 들어왔는지 알 수 있는 링크를 만들어요',
    keywords: ['UTM', 'QR', '캠페인', '마케팅', '링크'],
  })
  expect(menu.usesPeriod ?? false).toBe(false)
  expect(menu.usesGa ?? false).toBe(false)
})
