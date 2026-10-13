import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode, type ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PARAM_COMMIT_DELAY_MS } from '../../lib/useDebouncedPageParam'
import { NavProvider } from '../../menu/NavContext'
import type { MenuLookup } from '../../menu/registry'
import { SearchField } from './SearchField'

const lookup: MenuLookup = {
  defaultMenu: 'overview',
  isMenu: (id) => ['overview', 'event-stream'].includes(id),
  usesPeriod: () => false,
}
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const q = () => new URLSearchParams(window.location.search).get('q')

/** What the back or forward button does: the URL changes first, then popstate fires. */
function goTo(search: string) {
  window.history.replaceState(null, '', `/admin/${search}`)
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
}

function setup(search = '?menu=event-stream', strict = false) {
  window.history.replaceState(null, '', `/admin/${search}`)
  const onWrite = vi.fn()
  const field: ReactElement = (
    <NavProvider lookup={lookup}>
      <SearchField label="이벤트 검색" param="q" placeholder="이름" onWrite={onWrite} />
    </NavProvider>
  )
  const view = render(strict ? <StrictMode>{field}</StrictMode> : field)
  const input = screen.getByLabelText('이벤트 검색') as HTMLInputElement
  const type = (text: string) => fireEvent.change(input, { target: { value: text } })
  return { onWrite, input, type, unmount: view.unmount }
}

describe('SearchField', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
  })

  it('is a labelled search box that starts from the URL', () => {
    const { input } = setup('?menu=event-stream&q=view')
    expect(input).toHaveAttribute('type', 'search')
    expect(input).toHaveAttribute('placeholder', '이름')
    expect(screen.getByText('이벤트 검색')).toBeVisible()
    expect(input.value).toBe('view')
  })

  it('writes the URL 300ms after the last keystroke, once', () => {
    const { onWrite, type } = setup()
    type('a')
    advance(100)
    type('ab')
    advance(100)
    type('abc')
    advance(PARAM_COMMIT_DELAY_MS - 1)
    expect(q()).toBeNull()
    expect(onWrite).not.toHaveBeenCalled()
    advance(1)
    expect(q()).toBe('abc')
    expect(onWrite).toHaveBeenCalledTimes(1)
    expect(onWrite).toHaveBeenCalledWith('abc')
    advance(1000)
    expect(onWrite).toHaveBeenCalledTimes(1)
  })

  it('writes at once on Enter and on blur, and not again when the timer fires', () => {
    const { onWrite, input, type } = setup()
    type('abc')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(q()).toBe('abc')
    expect(onWrite).toHaveBeenCalledTimes(1)
    advance(1000)
    expect(onWrite).toHaveBeenCalledTimes(1)

    type('abcd')
    fireEvent.blur(input)
    expect(q()).toBe('abcd')
    expect(onWrite).toHaveBeenCalledTimes(2)
    advance(1000)
    expect(onWrite).toHaveBeenCalledTimes(2)
  })

  it('removes the param and reports null for an empty box', () => {
    const { onWrite, type } = setup('?menu=event-stream&q=abc')
    type('')
    advance(PARAM_COMMIT_DELAY_MS)
    expect(q()).toBeNull()
    expect(onWrite).toHaveBeenCalledTimes(1)
    expect(onWrite).toHaveBeenCalledWith(null)
  })

  it('does not write on a pause or on the Enter that picks an IME candidate, then writes after composition ends', () => {
    const { onWrite, input, type } = setup()
    fireEvent.compositionStart(input)
    type('ㅎ')
    advance(500)
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(onWrite).not.toHaveBeenCalled()
    fireEvent.compositionEnd(input)
    type('한')
    advance(PARAM_COMMIT_DELAY_MS - 1)
    expect(onWrite).not.toHaveBeenCalled()
    advance(1)
    expect(q()).toBe('한')
    expect(onWrite).toHaveBeenCalledTimes(1)
  })

  it('writes on blur even while composing: some keyboards compose every word', () => {
    const { onWrite, input, type } = setup()
    fireEvent.compositionStart(input)
    type('view')
    fireEvent.blur(input)
    expect(q()).toBe('view')
    expect(onWrite).toHaveBeenCalledTimes(1)
  })

  it('takes a value that changed outside and drops the pending write', () => {
    const { onWrite, input, type } = setup('?menu=event-stream&q=a')
    type('x')
    advance(100)
    goTo('?menu=event-stream&q=b')
    expect(input.value).toBe('b')
    advance(1000)
    expect(onWrite).not.toHaveBeenCalled()
    expect(q()).toBe('b')
  })

  it('does not stay stuck in composition after an outside change', () => {
    const { input, type } = setup('?menu=event-stream&q=a')
    fireEvent.compositionStart(input)
    goTo('?menu=event-stream&q=b')
    type('bc')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(q()).toBe('bc')
  })

  it('writes once under StrictMode and clears its timer on unmount', () => {
    const first = setup('?menu=event-stream', true)
    first.type('abc')
    advance(PARAM_COMMIT_DELAY_MS)
    expect(first.onWrite).toHaveBeenCalledTimes(1)
    first.type('abcd')
    first.unmount()
    advance(1000)
    expect(first.onWrite).toHaveBeenCalledTimes(1)
    expect(q()).toBe('abc')
  })
})
