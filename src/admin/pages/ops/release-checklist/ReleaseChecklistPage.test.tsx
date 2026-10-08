import type { ReactElement } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NavProvider } from '../../../menu/NavContext'
import type { MenuLookup } from '../../../menu/registry'
import { ReleaseChecklistPage } from './ReleaseChecklistPage'
import menu from './ReleaseChecklistPage.menu'
import { LIMIT_MESSAGE, RELEASES_KEY, newRelease, releaseText, visibleSections, type Release } from './release'
import { shareUrl } from './share'
import type { ReleasePlatform } from './template'

vi.mock('../../../menu/registry', () => ({
  REGISTRY: {
    findMenu: (id: string) => (id === 'ua-tester' ? { id: 'ua-tester', label: '랜딩 분기 테스트' } : undefined),
  },
}))

const NOT_SAVED = '이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요.'
const EMPTY = '아직 릴리즈가 없어요. 버전 이름을 정해서 시작해 보세요.'
const ALL_DONE = '모두 확인했어요'
const FIRST_ITEM = '버전 이름과 빌드 번호를 올렸어요'

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
const flush = () => act(async () => { await Promise.resolve() })

const renderPage = (search = '?menu=release-checklist') => renderAt(search, <ReleaseChecklistPage />)
const field = (label: string) => screen.getByLabelText<HTMLInputElement>(label)
const picker = () => screen.getByLabelText<HTMLSelectElement>('릴리즈')
const button = (name: string) => screen.getByRole('button', { name })
const heading = (name: string) => screen.getByRole('heading', { level: 2, name })
const card = (title: string) => heading(title).closest('section')!
const status = () => screen.getByRole('status')
const urlParam = (key: string) => new URLSearchParams(window.location.search).get(key)
/** How many times a text is on the page itself, the status region aside. */
const shown = (text: string) => screen.queryAllByText(text).filter((el) => !status().contains(el)).length
/** Presses a button the way a user does: fireEvent.click alone leaves focus where it was. */
function press(name: string) {
  const target = button(name)
  target.focus()
  fireEvent.click(target)
}

const rel = (id: string, name: string, platforms: ReleasePlatform[] = ['android', 'ios'], checked: string[] = []): Release =>
  newRelease({ id, name, platforms, now: '2026-10-08T00:00:00.000Z', checked })
function store(items: Release[]) {
  localStorage.setItem(RELEASES_KEY, JSON.stringify({ v: 1, items }))
}
function storedItems(): Release[] {
  return (JSON.parse(localStorage.getItem(RELEASES_KEY) ?? '{}') as { items: Release[] }).items
}
function blockStorage() {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError')
  })
}
function setClipboard() {
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  return writeText
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard')
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('starts empty with the new-release form', () => {
  renderPage()
  expect(screen.getByText(EMPTY)).toBeInTheDocument()
  expect(field('버전 이름')).toHaveValue('')
  expect(field('버전 이름')).toHaveAccessibleDescription('예: 1.5.0')
  expect(field('Android')).toBeChecked()
  expect(field('iOS')).toBeChecked()
  expect(button('만들기')).toBeInTheDocument()
  expect(screen.queryByLabelText('릴리즈')).toBeNull()
  expect(screen.queryByRole('button', { name: '취소' })).toBeNull()
})

it('creates a release, selects it and moves focus to its heading', () => {
  renderPage()
  fireEvent.change(field('버전 이름'), { target: { value: '1.5.0' } })
  press('만들기')
  expect(document.activeElement).toBe(heading('1.5.0 릴리즈'))
  expect(screen.getByText('0 / 22')).toBeInTheDocument()
  expect(picker().selectedOptions[0]).toHaveTextContent('1.5.0 · Android, iOS')
  expect(screen.queryByText(EMPTY)).toBeNull()
  expect(screen.queryByLabelText('버전 이름')).toBeNull()
  const items = storedItems()
  expect(items).toHaveLength(1)
  expect(items[0]).toEqual({
    id: expect.any(String),
    name: '1.5.0',
    platforms: ['android', 'ios'],
    checked: {},
    createdAt: expect.any(String),
  })
  expect(items[0].id).not.toBe('')
  expect(new Date(items[0].createdAt).toISOString()).toBe(items[0].createdAt)
  expect(urlParam('release')).toBe(items[0].id)
  expect(picker()).toHaveValue(items[0].id)
})

it('rejects a bad name and an empty platform set', () => {
  renderPage()
  press('만들기')
  expect(screen.getByText('버전 이름을 넣어 주세요')).toBeInTheDocument()
  expect(field('버전 이름')).toHaveAttribute('aria-invalid', 'true')
  expect(shown('플랫폼을 하나 이상 골라 주세요')).toBe(0)

  fireEvent.change(field('버전 이름'), { target: { value: '1.5.0' } })
  fireEvent.click(field('Android'))
  fireEvent.click(field('iOS'))
  press('만들기')
  expect(shown('플랫폼을 하나 이상 골라 주세요')).toBe(1)
  expect(screen.queryByText('버전 이름을 넣어 주세요')).toBeNull()
  expect(screen.getByText(EMPTY)).toBeInTheDocument()
  expect(localStorage.getItem(RELEASES_KEY)).toBeNull()
})

it('shows only the sections of the release platforms', () => {
  store([rel('a', '1.5.0', ['android'])])
  renderPage()
  const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
  expect(titles).toEqual(['1.5.0 릴리즈', '준비', '확인', 'Android', '출시 후'])
  expect(screen.getByText('0 / 17')).toBeInTheDocument()
  expect(within(card('Android')).getByText('0 / 5')).toBeInTheDocument()
  expect(screen.getAllByRole('checkbox')).toHaveLength(17)
})

it('checks an item from its label and updates the totals, the section count and storage', () => {
  store([rel('a', '1.5.0')])
  renderPage()
  const bar = screen.getByRole('progressbar', { name: '진행률' })
  expect(bar).toHaveAttribute('value', '0')

  fireEvent.click(screen.getByText(FIRST_ITEM))
  expect(field(FIRST_ITEM)).toBeChecked()
  expect(screen.getByText('1 / 22')).toBeInTheDocument()
  expect(bar).toHaveAttribute('value', '1')
  expect(bar).toHaveAttribute('max', '22')
  expect(within(card('준비')).getByText('1 / 4')).toBeInTheDocument()
  const time = storedItems()[0].checked['version-bumped']
  expect(new Date(time).toISOString()).toBe(time)

  fireEvent.click(screen.getByText(FIRST_ITEM))
  expect(field(FIRST_ITEM)).not.toBeChecked()
  expect(screen.getByText('0 / 22')).toBeInTheDocument()
  expect(within(card('준비')).getByText('0 / 4')).toBeInTheDocument()
  expect(Object.keys(storedItems()[0].checked)).toEqual([])
})

it('says 모두 확인했어요 when the last item is checked, and not on load', () => {
  const ids = visibleSections(rel('a', '1.5.0', ['android'])).flatMap((s) => s.items.map((i) => i.id))
  store([rel('a', '1.5.0', ['android'], ids.filter((id) => id !== 'team-notified'))])
  renderPage()
  expect(screen.getByText('16 / 17')).toBeInTheDocument()
  expect(screen.queryByText(ALL_DONE)).toBeNull()
  expect(status()).toHaveTextContent('')

  fireEvent.click(field('팀에 출시를 알렸어요'))
  expect(screen.getByText('17 / 17')).toBeInTheDocument()
  expect(shown(ALL_DONE)).toBe(1)
  expect(status()).toHaveTextContent(ALL_DONE)

  cleanup()
  store([rel('a', '1.5.0', ['android'], ids)])
  renderPage()
  expect(shown(ALL_DONE)).toBe(1)
  expect(status()).toHaveTextContent('')
})

it('switches releases through the select and the URL, and falls back to the latest', () => {
  store([rel('a', '2.0.0'), rel('b', '1.9.0', ['ios'])])
  renderPage()
  expect(heading('2.0.0 릴리즈')).toBeInTheDocument()
  expect(Array.from(picker().options, (o) => o.textContent)).toEqual(['2.0.0 · Android, iOS', '1.9.0 · iOS'])

  fireEvent.change(picker(), { target: { value: 'b' } })
  expect(heading('1.9.0 릴리즈')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '2.0.0 릴리즈' })).toBeNull()
  expect(urlParam('release')).toBe('b')

  cleanup()
  renderPage('?menu=release-checklist&release=b')
  expect(heading('1.9.0 릴리즈')).toBeInTheDocument()
  expect(picker()).toHaveValue('b')

  cleanup()
  renderPage('?menu=release-checklist&release=nope')
  expect(heading('2.0.0 릴리즈')).toBeInTheDocument()
  expect(picker()).toHaveValue('a')
})

it('links an item to its admin menu only when that menu exists', () => {
  store([rel('a', '1.5.0')])
  renderPage()
  const row = (label: string) => screen.getByText(label).closest('li')!
  expect(within(row('새 버전 사용자가 늘고 있어요')).queryByRole('button')).toBeNull()
  expect(screen.getAllByRole('button', { name: /열기$/ })).toHaveLength(1)
  expect(within(row('랜딩에서 스토어로 잘 넘어가는지 봤어요')).getByRole('button')).toBe(button('랜딩 분기 테스트 열기'))

  press('랜딩 분기 테스트 열기')
  expect(window.location.search).toBe('?menu=ua-tester')
})

it('copies the progress text', async () => {
  const writeText = setClipboard()
  const release = rel('a', '1.5.0')
  store([release])
  renderPage()
  press('진행 상황 복사')
  await flush()
  expect(writeText).toHaveBeenCalledTimes(1)
  const text = writeText.mock.calls[0][0]
  expect(text).toBe(releaseText(release))
  expect(text.startsWith('파르페 1.5.0 릴리즈 (Android, iOS) 0 / 22')).toBe(true)
})

it('copies a share link without the release param', async () => {
  const writeText = setClipboard()
  const release = rel('a', '1.5.0', ['android', 'ios'], ['no-crash'])
  store([rel('z', '2.0.0'), release])
  renderPage('?menu=release-checklist&release=a')
  expect(heading('1.5.0 릴리즈')).toBeInTheDocument()
  press('링크로 공유')
  await flush()
  expect(writeText).toHaveBeenCalledTimes(1)
  const url = writeText.mock.calls[0][0]
  expect(url).toBe(shareUrl(release, window.location))
  expect(url.startsWith(`${window.location.origin}/admin/?menu=release-checklist&share=`)).toBe(true)
  expect(url).not.toContain('release=')
})

it('shows the text in a box when the clipboard is missing', async () => {
  const release = rel('a', '1.5.0')
  store([release])
  renderPage()
  press('진행 상황 복사')
  await flush()
  expect(screen.getByLabelText<HTMLTextAreaElement>('복사할 내용').value).toBe(releaseText(release))
})

it('deletes a release after a second press and moves focus to the select, or to the name field when none is left', () => {
  store([rel('a', '2.0.0'), rel('b', '1.9.0')])
  renderPage('?menu=release-checklist&release=a')
  press('이 릴리즈 지우기')
  expect(button('정말 지울까요?')).toBeInTheDocument()
  expect(storedItems()).toHaveLength(2)
  advance(400)
  press('정말 지울까요?')
  expect(storedItems().map((r) => r.id)).toEqual(['b'])
  expect(screen.queryByText('2.0.0 · Android, iOS')).toBeNull()
  expect(heading('1.9.0 릴리즈')).toBeInTheDocument()
  expect(document.activeElement).toBe(picker())
  expect(urlParam('release')).toBeNull()
  expect(status()).toHaveTextContent('지웠어요')

  press('이 릴리즈 지우기')
  advance(400)
  press('정말 지울까요?')
  expect(storedItems()).toEqual([])
  expect(screen.getByText(EMPTY)).toBeInTheDocument()
  expect(screen.queryByLabelText('릴리즈')).toBeNull()
  expect(document.activeElement).toBe(field('버전 이름'))
})

it('refuses a 31st release and deletes nothing', () => {
  store(Array.from({ length: 30 }, (_, i) => rel(`r${i}`, `1.0.${i}`)))
  renderPage()
  expect(shown(LIMIT_MESSAGE)).toBe(0)
  press('새 릴리즈')
  expect(shown(LIMIT_MESSAGE)).toBe(1)
  expect(screen.queryByLabelText('버전 이름')).toBeNull()
  expect(storedItems().map((r) => r.id)).toEqual(Array.from({ length: 30 }, (_, i) => `r${i}`))
  expect(picker().options).toHaveLength(30)
})

it('does not overwrite a check made in another tab', () => {
  store([rel('a', '1.5.0')])
  renderPage()
  // Written straight to storage, without a storage event: the page still holds the old list.
  store([rel('a', '1.5.0', ['android', 'ios'], ['release-notes'])])
  fireEvent.click(field(FIRST_ITEM))
  expect(Object.keys(storedItems()[0].checked).sort()).toEqual(['release-notes', 'version-bumped'])
  expect(field('릴리즈 노트를 썼어요')).toBeChecked()
  expect(screen.getByText('2 / 22')).toBeInTheDocument()
})

it('creates a release in memory when storage is full', () => {
  blockStorage()
  renderPage()
  expect(screen.queryByText(NOT_SAVED)).toBeNull()
  fireEvent.change(field('버전 이름'), { target: { value: '1.5.0' } })
  press('만들기')
  expect(document.activeElement).toBe(heading('1.5.0 릴리즈'))
  expect(screen.getByText('0 / 22')).toBeInTheDocument()
  expect(screen.queryByText(LIMIT_MESSAGE)).toBeNull()
  expect(shown(NOT_SAVED)).toBe(1)
  expect(status()).toHaveTextContent(NOT_SAVED)
  expect(localStorage.getItem(RELEASES_KEY)).toBeNull()
})

it('keeps checks on screen and says they were not saved when storage is full', () => {
  store([rel('a', '1.5.0')])
  blockStorage()
  renderPage()
  fireEvent.click(field(FIRST_ITEM))
  expect(field(FIRST_ITEM)).toBeChecked()
  expect(screen.getByText('1 / 22')).toBeInTheDocument()
  expect(shown(NOT_SAVED)).toBe(1)
  expect(Object.keys(storedItems()[0].checked)).toEqual([])
})

it('uses real checkboxes and says where the checks live', () => {
  store([rel('a', '1.5.0')])
  renderPage()
  const boxes = screen.getAllByRole<HTMLInputElement>('checkbox')
  expect(boxes).toHaveLength(22)
  for (const box of boxes) {
    expect(box.tagName).toBe('INPUT')
    expect(box.type).toBe('checkbox')
    expect(box.closest('label')).not.toBeNull()
  }
  expect(screen.getByText('체크한 내용은 이 브라우저에만 저장돼요.')).toBeInTheDocument()
})

it('opens the form on the name field and returns to the button on cancel', () => {
  store([rel('a', '1.5.0')])
  renderPage()
  press('새 릴리즈')
  expect(document.activeElement).toBe(field('버전 이름'))
  expect(heading('1.5.0 릴리즈')).toBeInTheDocument()
  press('취소')
  expect(screen.queryByLabelText('버전 이름')).toBeNull()
  expect(document.activeElement).toBe(button('새 릴리즈'))
})

it('returns focus to 새 릴리즈 when 만들기 is refused because another tab filled the list', () => {
  store([rel('a', '1.5.0')])
  renderPage()
  press('새 릴리즈')
  fireEvent.change(field('버전 이름'), { target: { value: '2.0.0' } })
  // Written straight to storage, without a storage event: the form is still open.
  store(Array.from({ length: 30 }, (_, i) => rel(`r${i}`, `1.0.${i}`)))
  press('만들기')
  expect(shown(LIMIT_MESSAGE)).toBe(1)
  expect(screen.queryByLabelText('버전 이름')).toBeNull()
  expect(storedItems()).toHaveLength(30)
  expect(document.activeElement).toBe(button('새 릴리즈'))
})

it('defines the menu', () => {
  expect(menu).toMatchObject({ id: 'release-checklist', group: 'ops', order: 120, label: '릴리즈 체크리스트', description: '배포 전에 확인할 것을 빠짐없이 챙겨요', keywords: ['배포', '출시', '릴리즈', '체크', 'QA'] })
  expect(menu.usesPeriod).toBe(false)
  expect(menu.usesGa).toBe(false)
})

it('still shows a release that was not saved after leaving the page and coming back', () => {
  blockStorage()
  const first = renderPage()
  fireEvent.change(field('버전 이름'), { target: { value: '1.5.0' } })
  press('만들기')
  fireEvent.click(field(FIRST_ITEM))
  // What a menu change or a sign-in expiry does to the page.
  first.unmount()
  expect(localStorage.getItem(RELEASES_KEY)).toBeNull()

  renderPage()
  expect(heading('1.5.0 릴리즈')).toBeInTheDocument()
  expect(field(FIRST_ITEM)).toBeChecked()
  expect(shown(NOT_SAVED)).toBe(1)
  // Said once, when the write failed; not again on every return.
  expect(status().textContent).toBe('')
})
