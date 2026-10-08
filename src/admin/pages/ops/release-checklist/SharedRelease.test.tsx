import type { ReactElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NavProvider } from '../../../menu/NavContext'
import type { MenuLookup } from '../../../menu/registry'
import { ReleaseChecklistPage } from './ReleaseChecklistPage'
import { LIMIT_MESSAGE, RELEASES_KEY, newRelease, type Release } from './release'
import { encodeShare } from './share'
import type { ReleasePlatform } from './template'

vi.mock('../../../menu/registry', () => ({
  REGISTRY: { findMenu: () => undefined },
}))

const BANNER = '공유받은 릴리즈예요. 읽기 전용이에요.'
const BROKEN = '공유 링크를 읽지 못했어요'
const NOT_SAVED = '이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요.'
const EMPTY = '아직 릴리즈가 없어요. 버전 이름을 정해서 시작해 보세요.'
const NAME = '1.5.0 핫픽스 🍨'
const IMPORT = '내 브라우저로 가져오기'
const NOW = '2026-10-08T03:00:00.000Z'

const lookup: MenuLookup = {
  defaultMenu: 'overview',
  isMenu: (id) => ['overview', 'utm-builder', 'ua-tester', 'link-hub', 'release-checklist'].includes(id),
  usesPeriod: () => false,
}
function renderAt(search: string, page: ReactElement) {
  window.history.replaceState(null, '', `/admin/${search}`)
  return render(<NavProvider lookup={lookup}>{page}</NavProvider>)
}

const b64url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const shared = encodeShare(newRelease({ id: 'x', name: NAME, platforms: ['ios'], now: 't', checked: ['version-bumped', 'ios-testflight'] }))

const renderShared = (share = shared) => renderAt(`?menu=release-checklist&share=${share}`, <ReleaseChecklistPage />)
const button = (name: string) => screen.getByRole('button', { name })
const heading = (name: string) => screen.getByRole('heading', { level: 2, name })
const status = () => screen.getByRole('status')
const urlParam = (key: string) => new URLSearchParams(window.location.search).get(key)
const row = (label: string) => screen.getByText(label).closest('li')!
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

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW))
})

it('opens a shared release read-only, as text', () => {
  renderShared()
  expect(screen.getByText(BANNER)).toBeInTheDocument()
  expect(heading(`${NAME} 릴리즈`)).toBeInTheDocument()
  expect(screen.getByText('2 / 17')).toBeInTheDocument()
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '2')
  expect(screen.getByRole('progressbar')).toHaveAttribute('max', '17')
  expect(heading('iOS')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { level: 2, name: 'Android' })).toBeNull()
  expect(heading('준비').closest('section')).toHaveTextContent('1 / 4')
  expect(row('버전 이름과 빌드 번호를 올렸어요')).toHaveTextContent('확인함')
  expect(row('릴리즈 노트를 썼어요')).toHaveTextContent('아직')
  expect(row('릴리즈 노트를 썼어요')).not.toHaveTextContent('확인함')
  expect(screen.getAllByText('확인함')).toHaveLength(2)
  expect(screen.getAllByText('아직')).toHaveLength(15)
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  expect(screen.queryByRole('button', { name: '진행 상황 복사' })).toBeNull()
  expect(screen.queryByRole('button', { name: '이 릴리즈 지우기' })).toBeNull()
  expect(screen.queryByLabelText('릴리즈')).toBeNull()
  expect(button(IMPORT)).toHaveClass('adm-button--primary')
  expect(button('닫기')).toBeInTheDocument()
})

it('shows the shared release instead of my own, without touching storage', () => {
  store([rel('a', 'A')])
  const before = localStorage.getItem(RELEASES_KEY)
  renderShared()
  expect(heading(`${NAME} 릴리즈`)).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'A 릴리즈' })).toBeNull()
  expect(localStorage.getItem(RELEASES_KEY)).toBe(before)
  expect(urlParam('share')).toBe(shared)
})

it('imports it as a new release stamped now, clears share and focuses its heading', () => {
  renderShared()
  press(IMPORT)
  const items = storedItems()
  expect(items).toHaveLength(1)
  expect(items[0]).toEqual({
    id: expect.any(String),
    name: NAME,
    platforms: ['ios'],
    checked: { 'version-bumped': NOW, 'ios-testflight': NOW },
    createdAt: NOW,
  })
  expect(urlParam('share')).toBeNull()
  expect(urlParam('release')).toBe(items[0].id)
  expect(screen.queryByText(BANNER)).toBeNull()
  const boxes = screen.getAllByRole<HTMLInputElement>('checkbox')
  expect(boxes).toHaveLength(17)
  expect(boxes.filter((box) => box.checked)).toHaveLength(2)
  expect(document.activeElement).toBe(heading(`${NAME} 릴리즈`))
  expect(status()).toHaveTextContent('가져왔어요')
})

it('imports next to a release with the same name instead of overwriting it', () => {
  const mine = rel('a', NAME, ['android'], ['no-crash'])
  store([mine])
  renderShared()
  press(IMPORT)
  const items = storedItems()
  expect(items).toHaveLength(2)
  expect(items[0].id).not.toBe('a')
  expect(items[0].name).toBe(NAME)
  expect(items[1]).toEqual({ ...mine, checked: { 'no-crash': '2026-10-08T00:00:00.000Z' } })
})

it('imports in memory when storage is full', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError')
  })
  renderShared()
  press(IMPORT)
  expect(screen.queryByText(LIMIT_MESSAGE)).toBeNull()
  expect(urlParam('share')).toBeNull()
  expect(heading(`${NAME} 릴리즈`)).toBeInTheDocument()
  expect(screen.queryByText(BANNER)).toBeNull()
  expect(screen.getAllByRole('checkbox')).toHaveLength(17)
  expect(screen.getByText(NOT_SAVED, { selector: 'p' })).toBeInTheDocument()
  expect(status()).toHaveTextContent(NOT_SAVED)
  expect(localStorage.getItem(RELEASES_KEY)).toBeNull()
})

it('keeps the share link and shows the limit when 30 releases exist', () => {
  store(Array.from({ length: 30 }, (_, i) => rel(`r${i}`, `1.0.${i}`)))
  renderShared()
  expect(screen.queryByRole('alert')).toBeNull()
  press(IMPORT)
  expect(screen.getByRole('alert')).toHaveTextContent(LIMIT_MESSAGE)
  expect(urlParam('share')).toBe(shared)
  expect(screen.getByText(BANNER)).toBeInTheDocument()
  expect(storedItems().map((r) => r.id)).toEqual(Array.from({ length: 30 }, (_, i) => `r${i}`))
  expect(status()).not.toHaveTextContent('가져왔어요')
})

it('closes back to my releases and focuses the picker', () => {
  store([rel('a', 'A')])
  const before = localStorage.getItem(RELEASES_KEY)
  renderShared()
  press('닫기')
  expect(urlParam('share')).toBeNull()
  expect(screen.queryByText(BANNER)).toBeNull()
  expect(heading('A 릴리즈')).toBeInTheDocument()
  expect(document.activeElement).toBe(screen.getByLabelText('릴리즈'))
  expect(localStorage.getItem(RELEASES_KEY)).toBe(before)

  cleanup()
  localStorage.clear()
  renderShared()
  press('닫기')
  expect(urlParam('share')).toBeNull()
  expect(screen.getByText(EMPTY)).toBeInTheDocument()
  expect(document.activeElement).toBe(screen.getByLabelText('버전 이름'))
})

it('falls back to the normal screen for a broken share link', () => {
  const broken = ['not*base64', b64url(JSON.stringify({ v: 2, name: 'x', platforms: ['ios'], checked: [] })), 'A'.repeat(4001)]
  for (const value of broken) {
    renderShared(value)
    expect(screen.getByRole('alert')).toHaveTextContent(BROKEN)
    expect(screen.queryByText(BANNER)).toBeNull()
    expect(screen.getByText(EMPTY)).toBeInTheDocument()
    expect(screen.getByLabelText('버전 이름')).toBeInTheDocument()
    cleanup()
  }
  store([rel('a', 'A')])
  renderShared(broken[0])
  expect(screen.getByRole('alert')).toHaveTextContent(BROKEN)
  expect(heading('A 릴리즈')).toBeInTheDocument()
  expect(screen.getAllByRole('checkbox')).toHaveLength(22)
})

it('drops unknown item ids from the link', () => {
  renderShared(b64url(JSON.stringify({ v: 1, name: 'x', platforms: ['ios'], checked: ['nope', 'no-crash', '__proto__', 'version-bumped'] })))
  expect(screen.getAllByText('확인함')).toHaveLength(2)
  expect(screen.getAllByText('아직')).toHaveLength(15)
  expect(screen.getByText('2 / 17')).toBeInTheDocument()
})

it('shows no broken-link message without a share param', () => {
  renderAt('?menu=release-checklist', <ReleaseChecklistPage />)
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByText(EMPTY)).toBeInTheDocument()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})
