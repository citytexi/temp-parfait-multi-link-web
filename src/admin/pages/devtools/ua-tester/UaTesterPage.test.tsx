import type { ReactElement } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { APP_STORE_URL, externalBrowserUrl, playIntentUrl } from '../../../../landing/ua'
import { LANDING_URL } from '../../../lib/siteUrls'
import { NavProvider } from '../../../menu/NavContext'
import type { MenuLookup } from '../../../menu/registry'
import { UA_PRESETS } from './config'
import { UaTesterPage } from './UaTesterPage'
import menu from './UaTesterPage.menu'

const R = 'utm_source=kakaotalk&utm_medium=social&utm_campaign=c'
const UTM = 'https://citytexi.github.io/temp-parfait-multi-link-web/?utm_source=kakaotalk&utm_medium=social&utm_campaign=c'
const PROMPT = '기기를 고르거나 UA 문자열을 넣어 주세요'
const NOT_HTTPS = 'https://로 시작하는 주소를 넣어 주세요'

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

const preset = (id: string) => UA_PRESETS.find((p) => p.id === id)!
const button = (name: string) => screen.getByRole('button', { name })
const presetButton = (id: string) => button(preset(id).label)
const uaField = () => screen.getByLabelText<HTMLInputElement>('UA 문자열')
const urlField = () => screen.getByLabelText<HTMLInputElement>('랜딩 주소')
const touchBox = () => screen.getByLabelText<HTMLInputElement>('터치를 지원해요')
const params = () => new URLSearchParams(window.location.search)
/** The <dd> of the result row with this name. */
function row(name: string): HTMLElement {
  const dd = screen.getByText(name, { selector: 'dt' }).nextElementSibling
  if (!(dd instanceof HTMLElement) || dd.tagName !== 'DD') throw new Error(`no value for the row "${name}"`)
  return dd
}
/** The buttons the landing would show: [label, address] per button. */
const shownButtons = () =>
  within(row('보이는 버튼'))
    .getAllByRole('listitem')
    .map((li) => Array.from(li.querySelectorAll('span'), (el) => el.textContent))
const pressedPresets = () =>
  UA_PRESETS.filter((p) => button(p.label).getAttribute('aria-pressed') === 'true').map((p) => p.id)

function setClipboard() {
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  return writeText
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard')
  Reflect.deleteProperty(navigator, 'userAgent')
  Reflect.deleteProperty(navigator, 'maxTouchPoints')
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('asks for a device before showing a result', () => {
  renderAt('?menu=ua-tester', <UaTesterPage />)
  expect(screen.getByText(PROMPT)).toBeInTheDocument()
  expect(screen.queryByText('판정')).toBeNull()
  expect(urlField()).toHaveValue(LANDING_URL)
  expect(uaField()).toHaveValue('')
  expect(pressedPresets()).toEqual([])
})

it('shows the verdict, redirect, buttons, hint and campaign for KakaoTalk on Android', () => {
  renderAt(`?menu=ua-tester&preset=kakaotalk-android&url=${encodeURIComponent(UTM)}`, <UaTesterPage />)
  expect(screen.queryByText(PROMPT)).toBeNull()
  expect(row('판정')).toHaveTextContent(/^Android · 인앱 브라우저 · 카카오톡$/)
  expect(row('자동 이동')).toHaveTextContent(/^하지 않아요 \(인앱 브라우저라서\)$/)
  expect(shownButtons()).toEqual([
    ['Google Play에서 다운로드', playIntentUrl(R)],
    ['외부 브라우저로 열기', externalBrowserUrl(UTM, true)],
  ])
  expect(row('안내 문구')).toHaveTextContent(/^보여요$/)
  expect(row('Play로 넘기는 캠페인')).toHaveTextContent(R)
  expect(row('Play로 넘기는 캠페인').textContent).toBe(R)
  expect(pressedPresets()).toEqual(['kakaotalk-android'])
  for (const p of UA_PRESETS) expect(button(p.label)).toHaveAttribute('aria-pressed', String(p.id === 'kakaotalk-android'))
  expect(uaField()).toHaveValue(preset('kakaotalk-android').ua)
  expect(urlField()).toHaveValue(UTM)
  expect(touchBox()).toBeChecked()
})

it.each([
  ['iphone-safari', 'iOS · 일반 브라우저', '하지 않아요 (Android가 아니라서)', ['App Store에서 다운로드'], '안 보여요'],
  ['ipad', 'iOS · 일반 브라우저', '하지 않아요 (Android가 아니라서)', ['App Store에서 다운로드'], '안 보여요'],
  ['android-chrome', 'Android · 일반 브라우저', 'Play로 바로 보내요', ['Google Play에서 다운로드'], '안 보여요'],
  ['instagram-android', 'Android · 인앱 브라우저', '하지 않아요 (인앱 브라우저라서)', ['Google Play에서 다운로드', '외부 브라우저로 열기'], '보여요'],
  ['kakaotalk-ios', 'iOS · 인앱 브라우저 · 카카오톡', '하지 않아요 (Android가 아니라서)', ['App Store에서 다운로드'], '안 보여요'],
  ['naver-android', 'Android · 인앱 브라우저', '하지 않아요 (인앱 브라우저라서)', ['Google Play에서 다운로드', '외부 브라우저로 열기'], '보여요'],
  ['desktop', '그 밖의 기기 · 일반 브라우저', '하지 않아요 (Android가 아니라서)', ['Google Play에서 다운로드', 'App Store에서 다운로드'], '안 보여요'],
])('preset %s', (id, verdict, redirect, buttons, hint) => {
  renderAt('?menu=ua-tester', <UaTesterPage />)
  fireEvent.click(presetButton(id))
  expect(row('판정').textContent).toBe(verdict)
  expect(within(row('자동 이동')).getByText(redirect)).toBeInTheDocument()
  expect(shownButtons().map(([label]) => label)).toEqual(buttons)
  expect(row('안내 문구').textContent).toBe(hint)
  expect(pressedPresets()).toEqual([id])
  expect(uaField()).toHaveValue(preset(id).ua)
  expect(touchBox().checked).toBe(preset(id).touch)
  expect(params().get('preset')).toBe(id)
  expect(params().get('ua')).toBeNull()
  expect(params().get('touch')).toBeNull()
  // Nothing is left to be written later either.
  advance(300)
  expect(params().get('ua')).toBeNull()
  expect(params().get('touch')).toBeNull()
})

it('releases the preset when the UA is edited and keeps the touch value', () => {
  renderAt('?menu=ua-tester', <UaTesterPage />)
  fireEvent.click(presetButton('android-chrome'))
  fireEvent.change(uaField(), { target: { value: 'X Android' } })
  expect(pressedPresets()).toEqual([])
  for (const p of UA_PRESETS) expect(button(p.label)).toHaveAttribute('aria-pressed', 'false')
  expect(uaField()).toHaveValue('X Android')
  expect(touchBox()).toBeChecked()
  expect(row('판정').textContent).toBe('Android · 일반 브라우저')
  // The typed UA waits for the pause.
  expect(params().get('ua')).toBeNull()
  advance(300)
  expect(params().get('ua')).toBe('X Android')
  expect(params().get('touch')).toBe('1')
  expect(params().get('preset')).toBeNull()
})

it('treats the iPad preset as desktop once touch is unchecked', () => {
  renderAt('?menu=ua-tester', <UaTesterPage />)
  fireEvent.click(presetButton('ipad'))
  expect(row('판정').textContent).toBe('iOS · 일반 브라우저')
  fireEvent.click(touchBox())
  expect(touchBox()).not.toBeChecked()
  expect(row('판정').textContent).toBe('그 밖의 기기 · 일반 브라우저')
  expect(params().get('touch')).toBe('0')
  expect(params().get('preset')).toBe('ipad')
  expect(pressedPresets()).toEqual(['ipad'])
  expect(uaField()).toHaveValue(preset('ipad').ua)
})

it('fills in this browser without selecting a preset', () => {
  const mine = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) MyBrowser/1.0'
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: mine })
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 })
  renderAt('?menu=ua-tester&preset=desktop', <UaTesterPage />)
  fireEvent.click(button('내 브라우저'))
  expect(uaField()).toHaveValue(mine)
  expect(touchBox()).toBeChecked()
  expect(row('판정').textContent).toBe('Android · 일반 브라우저')
  // Written at once, without waiting for the pause.
  expect(params().get('ua')).toBe(mine)
  expect(params().get('touch')).toBe('1')
  expect(params().get('preset')).toBeNull()
  expect(button('내 브라우저')).not.toHaveAttribute('aria-pressed')
  expect(pressedPresets()).toEqual([])
})

it('blanks the addresses for a non-https landing address', () => {
  renderAt('?menu=ua-tester', <UaTesterPage />)
  fireEvent.click(presetButton('android-chrome'))
  expect(urlField()).not.toHaveAccessibleDescription()
  expect(screen.getAllByRole('button', { name: /주소 복사$/ })).toHaveLength(2)
  fireEvent.change(urlField(), { target: { value: 'http://a.b' } })
  expect(urlField()).toHaveAccessibleDescription(NOT_HTTPS)
  expect(urlField()).toHaveAttribute('aria-invalid', 'true')
  expect(row('판정').textContent).toBe('Android · 일반 브라우저')
  expect(within(row('자동 이동')).getByText('Play로 바로 보내요')).toBeInTheDocument()
  expect(row('자동 이동').textContent).toBe('Play로 바로 보내요—')
  expect(shownButtons()).toEqual([['Google Play에서 다운로드', '—']])
  expect(screen.queryAllByRole('button', { name: /주소 복사/ })).toHaveLength(0)
  expect(row('Play로 넘기는 캠페인').textContent).toBe('—')
  expect(row('안내 문구').textContent).toBe('안 보여요')
  expect(screen.queryByText(/intent:/)).toBeNull()
})

it('stays empty when the address is cleared, and drops the param for the default address', () => {
  renderAt(`?menu=ua-tester&preset=android-chrome&url=${encodeURIComponent(UTM)}`, <UaTesterPage />)
  fireEvent.change(urlField(), { target: { value: '' } })
  expect(urlField()).toHaveValue('')
  expect(screen.getByText(NOT_HTTPS)).toBeInTheDocument()
  advance(300)
  // Still empty once the param is gone: the field does not fall back to the default.
  expect(params().get('url')).toBeNull()
  expect(urlField()).toHaveValue('')
  expect(screen.getByText(NOT_HTTPS)).toBeInTheDocument()

  fireEvent.change(urlField(), { target: { value: 'https://a.b/' } })
  advance(300)
  expect(params().get('url')).toBe('https://a.b/')
  fireEvent.change(urlField(), { target: { value: LANDING_URL } })
  expect(urlField()).toHaveValue(LANDING_URL)
  expect(screen.queryByText(NOT_HTTPS)).toBeNull()
  advance(300)
  expect(params().get('url')).toBeNull()
  expect(urlField()).toHaveValue(LANDING_URL)
})

it('names each copy button after what it copies', async () => {
  const writeText = setClipboard()
  renderAt('?menu=ua-tester&preset=android-chrome', <UaTesterPage />)
  fireEvent.click(button('Google Play에서 다운로드 주소 복사'))
  await flush()
  expect(writeText).toHaveBeenCalledTimes(1)
  expect(writeText).toHaveBeenLastCalledWith(playIntentUrl())
  expect(screen.getByRole('status')).toHaveTextContent('복사했어요')
  fireEvent.click(button('자동 이동 주소 복사'))
  await flush()
  expect(writeText).toHaveBeenCalledTimes(2)
  expect(writeText).toHaveBeenLastCalledWith(playIntentUrl())
})

it('names the copy button of every shown button', async () => {
  const writeText = setClipboard()
  renderAt(`?menu=ua-tester&preset=kakaotalk-android&url=${encodeURIComponent(UTM)}`, <UaTesterPage />)
  expect(screen.queryByRole('button', { name: '자동 이동 주소 복사' })).toBeNull()
  fireEvent.click(button('외부 브라우저로 열기 주소 복사'))
  await flush()
  expect(writeText).toHaveBeenLastCalledWith(externalBrowserUrl(UTM, true))
  fireEvent.click(presetButton('desktop'))
  fireEvent.click(button('App Store에서 다운로드 주소 복사'))
  await flush()
  expect(writeText).toHaveBeenLastCalledWith(APP_STORE_URL)
})

it('renders result addresses as text, never as links', () => {
  const { container } = renderAt(
    `?menu=ua-tester&preset=kakaotalk-android&url=${encodeURIComponent(UTM)}`,
    <UaTesterPage />,
  )
  expect(container.querySelector('dl')).not.toBeNull()
  expect(container.querySelector('dl a')).toBeNull()
  expect(container.querySelector('a')).toBeNull()
  expect(container.querySelector('[href]')).toBeNull()
})

it('sets the input attributes that keep phones from rewriting the text', () => {
  renderAt('?menu=ua-tester', <UaTesterPage />)
  for (const input of [uaField(), urlField()]) {
    expect(input).toHaveAttribute('autocapitalize', 'none')
    expect(input).toHaveAttribute('autocorrect', 'off')
    expect(input).toHaveAttribute('spellcheck', 'false')
  }
  expect(urlField()).toHaveAttribute('inputmode', 'url')
})

it('does not make the result a live region', () => {
  const { container } = renderAt('?menu=ua-tester&preset=android-chrome', <UaTesterPage />)
  const dl = container.querySelector('dl')
  expect(dl).not.toBeNull()
  for (let el: Element | null = dl; el; el = el.parentElement) {
    expect(el).not.toHaveAttribute('aria-live')
    expect(el).not.toHaveAttribute('role', 'status')
    expect(el).not.toHaveAttribute('role', 'alert')
  }
  expect(dl!.querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull()
  // The page's one status region is mounted from the start and stays outside the result.
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})

it('groups the preset buttons under one name', () => {
  renderAt('?menu=ua-tester', <UaTesterPage />)
  const group = screen.getByRole('group', { name: '기기' })
  expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual([
    ...UA_PRESETS.map((p) => p.label),
    '내 브라우저',
  ])
})

it('lets a UA in the link win over its preset', () => {
  renderAt('?menu=ua-tester&preset=desktop&ua=X%20iPhone&touch=1', <UaTesterPage />)
  expect(uaField()).toHaveValue('X iPhone')
  expect(touchBox()).toBeChecked()
  expect(pressedPresets()).toEqual([])
  expect(row('판정').textContent).toBe('iOS · 일반 브라우저')
  // Reading the link writes nothing back.
  advance(300)
  expect(window.location.search).toBe('?menu=ua-tester&preset=desktop&ua=X%20iPhone&touch=1')
})

it('defines the menu', () => {
  expect(menu).toMatchObject({ id: 'ua-tester', group: 'devtools', order: 120, label: '랜딩 분기 테스트', description: '기기와 앱마다 랜딩이 어떻게 열리는지 확인해요', keywords: ['UA', 'user agent', '딥링크', '인앱', '랜딩'] })
  expect(menu.usesPeriod).toBe(false)
  expect(menu.usesGa).toBe(false)
})
