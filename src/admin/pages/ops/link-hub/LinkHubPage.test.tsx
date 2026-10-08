import type { ReactElement } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NavProvider } from '../../../menu/NavContext'
import type { MenuLookup } from '../../../menu/registry'
import { LinkHubPage } from './LinkHubPage'
import menu from './LinkHubPage.menu'
import { PERSONAL_KEY } from './personal'

const FIREBASE = 'https://console.firebase.google.com/project/parfait-5934b/overview'
const NOT_SAVED = '이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요.'
const AT_LIMIT = '내 링크는 50개까지 둘 수 있어요'
const FIGMA = { id: 'f1', label: 'Figma', url: 'https://figma.com/file/x' }

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

const renderPage = () => renderAt('?menu=link-hub', <LinkHubPage />)
const field = (label: string) => screen.getByLabelText<HTMLInputElement>(label)
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } })
const button = (name: string) => screen.getByRole('button', { name })
const link = (name: RegExp) => screen.getByRole<HTMLAnchorElement>('link', { name })
const titles = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
const card = (title: string) => screen.getByRole('heading', { level: 2, name: title }).closest('section')!
/** Presses a button the way a user does: fireEvent.click alone leaves focus where it was. */
function press(name: string) {
  const target = button(name)
  target.focus()
  fireEvent.click(target)
}

function store(items: unknown[]) {
  localStorage.setItem(PERSONAL_KEY, JSON.stringify({ v: 1, items }))
}
function storedItems(): Record<string, unknown>[] {
  return (JSON.parse(localStorage.getItem(PERSONAL_KEY) ?? '{}') as { items: Record<string, unknown>[] }).items
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('groups the team links into cards and hides the empty group', () => {
  renderPage()
  expect(titles()).toEqual(['분석', '스토어', '개발', '내 링크'])
  expect(screen.queryByText('디자인·문서')).toBeNull()
  expect(within(card('분석')).getAllByRole('link')).toHaveLength(2)
})

it('opens every link in a new tab and says so', () => {
  store([FIGMA])
  renderPage()
  const links = screen.getAllByRole('link')
  expect(links).toHaveLength(10)
  for (const a of links) {
    expect(a).toHaveAttribute('target', '_blank')
    expect(a).toHaveAttribute('rel', 'noopener noreferrer')
    expect(a).toHaveTextContent('새 탭에서 열려요')
  }
  const firebase = link(/Firebase 콘솔 새 탭에서 열려요/)
  expect(firebase).toHaveAttribute('href', FIREBASE)
  expect(within(firebase).getByText('console.firebase.google.com')).toBeInTheDocument()
  expect(within(firebase).getByText('앱 설정과 Remote Config를 봐요')).toBeInTheDocument()
})

it('filters by name, description and url and hides cards without a match', () => {
  store([FIGMA])
  renderPage()
  expect(titles()).toContain('내 링크')

  type('링크 검색', 'play')
  expect(field('링크 검색')).toHaveAttribute('type', 'search')
  expect(link(/^Play Console/)).toBeInTheDocument()
  expect(link(/^Play 스토어 페이지/)).toBeInTheDocument()
  expect(titles()).toEqual(['스토어'])
  expect(screen.queryByRole('link', { name: /Figma/ })).toBeNull()
  expect(window.location.search).toBe('?menu=link-hub')

  // The description and the address are searched too, and so are the personal links.
  type('링크 검색', 'remote config')
  expect(titles()).toEqual(['분석'])
  expect(within(card('분석')).getAllByRole('link')).toHaveLength(1)
  type('링크 검색', 'appstoreconnect.apple.com')
  expect(screen.getAllByRole('link')).toHaveLength(1)
  expect(link(/^App Store Connect/)).toBeInTheDocument()
  type('링크 검색', 'figma')
  expect(titles()).toEqual(['내 링크'])
  expect(window.location.search).toBe('?menu=link-hub')
})

it('offers to clear a search with no match', () => {
  renderPage()
  type('링크 검색', 'zzzz')
  expect(screen.getByText('찾는 링크가 없어요')).toBeInTheDocument()
  expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0)
  expect(screen.queryAllByRole('link')).toHaveLength(0)

  press('검색 지우기')
  expect(titles()).toEqual(['분석', '스토어', '개발', '내 링크'])
  expect(screen.queryByText('찾는 링크가 없어요')).toBeNull()
  expect(field('링크 검색')).toHaveValue('')
  expect(document.activeElement).toBe(field('링크 검색'))
})

it('adds a personal link, stores it and moves focus to it', () => {
  renderPage()
  press('내 링크 추가')
  expect(document.activeElement).toBe(field('이름'))
  expect(field('주소')).toHaveAttribute('inputmode', 'url')
  expect(field('주소')).toHaveAttribute('autocapitalize', 'none')
  expect(field('주소')).toHaveAttribute('spellcheck', 'false')
  expect(screen.queryByRole('button', { name: '내 링크 추가' })).toBeNull()

  type('이름', 'Figma')
  type('주소', 'https://figma.com/file/x')
  // Enter in a field submits the form.
  fireEvent.submit(field('주소').closest('form')!)

  const added = link(/Figma/)
  expect(document.activeElement).toBe(added)
  expect(added).toHaveAttribute('href', 'https://figma.com/file/x')
  expect(within(added).getByText('figma.com')).toBeInTheDocument()
  expect(storedItems()).toEqual([{ id: expect.any(String), label: 'Figma', url: 'https://figma.com/file/x' }])
  expect(storedItems()[0].id).not.toBe('')
  expect(screen.getByRole('status')).toHaveTextContent('추가했어요')
  expect(screen.queryByLabelText('이름')).toBeNull()
  expect(button('내 링크 추가')).toBeInTheDocument()
})

it('keeps an open form through a search and shows the saved link the search would hide', () => {
  store([FIGMA])
  renderPage()
  press('내 링크 추가')
  type('이름', 'Notion')
  type('링크 검색', 'zzzz')
  // Nothing matches, but what was typed in the form is still there.
  expect(screen.getByText('찾는 링크가 없어요')).toBeInTheDocument()
  expect(field('이름')).toHaveValue('Notion')

  type('주소', 'https://notion.so')
  press('저장')
  expect(field('링크 검색')).toHaveValue('')
  expect(document.activeElement).toBe(link(/^Notion /))
  expect(titles()).toEqual(['분석', '스토어', '개발', '내 링크'])
})

it('shows validation errors and saves nothing', () => {
  renderPage()
  press('내 링크 추가')
  type('이름', '')
  type('주소', 'javascript:alert(1)')
  press('저장')

  expect(field('이름')).toHaveAccessibleDescription('이름을 넣어 주세요')
  expect(field('이름')).toHaveAttribute('aria-invalid', 'true')
  expect(field('주소')).toHaveAccessibleDescription('https://로 시작하는 주소만 넣을 수 있어요')
  // The typed text stays as it was.
  expect(field('주소')).toHaveValue('javascript:alert(1)')
  expect(button('저장')).toBeInTheDocument()
  expect(localStorage.getItem(PERSONAL_KEY)).toBeNull()
  expect(within(card('내 링크')).queryAllByRole('link')).toHaveLength(0)
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})

it('never renders a stored javascript: link', () => {
  store([
    { id: '1', label: 'bad', url: 'javascript:alert(1)' },
    { id: '2', label: 'ok', url: 'https://a.b/' },
    { id: '3', label: 'creds', url: 'https://evil@good.com/' },
  ])
  const { container } = renderPage()
  const personal = within(card('내 링크')).getAllByRole('link')
  expect(personal).toHaveLength(1)
  expect(personal[0]).toHaveAttribute('href', 'https://a.b/')
  expect(personal[0]).toHaveTextContent('ok')
  expect(screen.queryByText('bad')).toBeNull()
  expect(screen.queryByText('creds')).toBeNull()
  expect(container.querySelector('a[href^="javascript"]')).toBeNull()
  for (const a of container.querySelectorAll('a')) expect(a.getAttribute('href')).toMatch(/^https:\/\//)
})

it('edits a link in place and returns focus to it', () => {
  store([FIGMA, { id: 'n1', label: 'Notion', url: 'https://notion.so/' }])
  renderPage()
  press('Figma 수정')
  expect(field('이름')).toHaveValue('Figma')
  expect(field('주소')).toHaveValue('https://figma.com/file/x')
  expect(document.activeElement).toBe(field('이름'))
  // One form at a time: opening another one closes this one.
  press('내 링크 추가')
  expect(screen.getAllByLabelText('이름')).toHaveLength(1)
  expect(field('이름')).toHaveValue('')
  expect(link(/^Figma /)).toBeInTheDocument()
  press('Notion 수정')
  expect(screen.getAllByLabelText('이름')).toHaveLength(1)
  expect(field('이름')).toHaveValue('Notion')
  expect(button('내 링크 추가')).toBeInTheDocument()
  press('Figma 수정')
  expect(screen.getAllByLabelText('이름')).toHaveLength(1)
  expect(field('이름')).toHaveValue('Figma')

  type('이름', 'Figma 2')
  press('저장')

  const edited = link(/Figma 2/)
  expect(document.activeElement).toBe(edited)
  expect(storedItems()).toEqual([
    { id: 'f1', label: 'Figma 2', url: 'https://figma.com/file/x' },
    { id: 'n1', label: 'Notion', url: 'https://notion.so/' },
  ])
  expect(screen.getByRole('status')).toHaveTextContent('고쳤어요')
  expect(screen.queryByLabelText('이름')).toBeNull()
})

it('cancels a form and returns focus to the button that opened it', () => {
  store([FIGMA])
  renderPage()
  press('내 링크 추가')
  type('이름', 'x')
  press('취소')
  expect(screen.queryByLabelText('이름')).toBeNull()
  expect(document.activeElement).toBe(button('내 링크 추가'))

  press('Figma 수정')
  type('이름', 'changed')
  press('취소')
  expect(screen.queryByLabelText('이름')).toBeNull()
  expect(document.activeElement).toBe(button('Figma 수정'))
  expect(link(/^Figma /)).toBeInTheDocument()
  expect(storedItems()).toEqual([FIGMA])
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})

it('deletes after a second press and moves focus to the next link, or to the add button', () => {
  store([
    { id: 'a', label: 'A', url: 'https://a.example/' },
    { id: 'b', label: 'B', url: 'https://b.example/' },
  ])
  renderPage()
  press('A 삭제')
  expect(button('정말 지울까요?')).toBeInTheDocument()
  // A press inside the guard does nothing.
  fireEvent.click(button('정말 지울까요?'))
  expect(storedItems()).toHaveLength(2)
  advance(400)
  fireEvent.click(button('정말 지울까요?'))

  expect(screen.queryByRole('link', { name: /^A / })).toBeNull()
  expect(document.activeElement).toBe(link(/^B /))
  expect(storedItems()).toEqual([{ id: 'b', label: 'B', url: 'https://b.example/' }])
  expect(screen.getByRole('status')).toHaveTextContent('지웠어요')

  press('B 삭제')
  advance(400)
  fireEvent.click(button('정말 지울까요?'))
  expect(within(card('내 링크')).queryAllByRole('link')).toHaveLength(0)
  expect(document.activeElement).toBe(button('내 링크 추가'))
  expect(storedItems()).toEqual([])
})

it('keeps the link and the buttons as siblings', () => {
  store([FIGMA])
  renderPage()
  const a = link(/^Figma /)
  expect(a.querySelector('button')).toBeNull()
  const tile = a.closest('li')!
  expect(within(tile).getByRole('button', { name: 'Figma 수정' })).toBeInTheDocument()
  expect(within(tile).getByRole('button', { name: 'Figma 삭제' })).toHaveTextContent('삭제')
  expect(button('Figma 수정').closest('a')).toBeNull()
  expect(button('Figma 삭제').closest('a')).toBeNull()
})

it('replaces the add button with the limit at 50 links', () => {
  store(Array.from({ length: 50 }, (_, i) => ({ id: `id-${i}`, label: `링크 ${i}`, url: `https://a.b/${i}` })))
  renderPage()
  expect(within(card('내 링크')).getAllByRole('link')).toHaveLength(50)
  expect(screen.getByText(AT_LIMIT)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '내 링크 추가' })).toBeNull()
})

it('keeps the new link on screen and says it was not saved when storage is blocked', () => {
  renderPage()
  expect(screen.queryByText(NOT_SAVED)).toBeNull()
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError')
  })
  press('내 링크 추가')
  type('이름', 'Figma')
  type('주소', 'https://figma.com/file/x')
  press('저장')

  expect(link(/^Figma /)).toHaveAttribute('href', 'https://figma.com/file/x')
  expect(screen.getByText(NOT_SAVED)).toBeInTheDocument()
  expect(localStorage.getItem(PERSONAL_KEY)).toBeNull()

  // The page keeps working on the value it holds.
  press('내 링크 추가')
  type('이름', 'Notion')
  type('주소', 'https://notion.so')
  press('저장')
  expect(within(card('내 링크')).getAllByRole('link')).toHaveLength(2)
})

it('warns about secrets in addresses', () => {
  renderPage()
  expect(
    within(card('내 링크')).getByText('내 링크는 이 브라우저에만 저장돼요. 비밀번호나 토큰이 들어간 주소는 넣지 마세요.'),
  ).toBeInTheDocument()
})

it('defines the menu', async () => {
  expect(menu).toMatchObject({ id: 'link-hub', group: 'ops', order: 110, label: '바로가기', description: '자주 쓰는 콘솔과 문서를 한곳에서 열어요', keywords: ['링크', 'Firebase', 'Play Console', 'App Store', '콘솔'] })
  expect(menu.usesPeriod).toBe(false)
  expect(menu.usesGa).toBe(false)
  expect((await menu.load()).default).toBe(LinkHubPage)
})
