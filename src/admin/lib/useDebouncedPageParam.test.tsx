import { act, fireEvent, renderHook } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NavProvider, useNav, usePageParam } from '../menu/NavContext'
import type { MenuLookup } from '../menu/registry'
import { useDebouncedPageParam } from './useDebouncedPageParam'

const lookup: MenuLookup = {
  defaultMenu: 'overview',
  isMenu: (id) => ['overview', 'utm-builder', 'link-hub'].includes(id),
  usesPeriod: () => false,
}
const wrapper = ({ children }: { children: ReactNode }) => <NavProvider lookup={lookup}>{children}</NavProvider>
const strictWrapper = ({ children }: { children: ReactNode }) => (
  <StrictMode>
    <NavProvider lookup={lookup}>{children}</NavProvider>
  </StrictMode>
)
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })
const camp = () => new URLSearchParams(window.location.search).get('camp')

function setup(search: string, w = wrapper) {
  window.history.replaceState(null, '', `/admin/${search}`)
  return renderHook(
    () => ({ field: useDebouncedPageParam('camp'), nav: useNav(), raw: usePageParam('camp') }),
    { wrapper: w },
  )
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useDebouncedPageParam', () => {
  it('starts from the URL value, or empty', () => {
    expect(setup('?menu=utm-builder&camp=x').result.current.field[0]).toBe('x')
    expect(setup('?menu=utm-builder').result.current.field[0]).toBe('')
  })

  it('writes once, 300ms after the last change', () => {
    const spy = vi.spyOn(window.history, 'replaceState')
    const { result } = setup('?menu=utm-builder')
    spy.mockClear()
    act(() => result.current.field[1]('a'))
    advance(100)
    act(() => result.current.field[1]('ab'))
    advance(100)
    act(() => result.current.field[1]('abc'))
    expect(result.current.field[0]).toBe('abc')
    advance(299)
    expect(spy).not.toHaveBeenCalled()
    advance(1)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(camp()).toBe('abc')
  })

  it('writes at once on flush, and not again when the timer fires', () => {
    const spy = vi.spyOn(window.history, 'replaceState')
    const { result } = setup('?menu=utm-builder')
    spy.mockClear()
    act(() => result.current.field[1]('a'))
    act(() => result.current.field[2]())
    expect(camp()).toBe('a')
    expect(spy).toHaveBeenCalledTimes(1)
    advance(500)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('writes the new value when set and flush run in the same handler', () => {
    const { result } = setup('?menu=utm-builder')
    act(() => {
      result.current.field[1]('x')
      result.current.field[2]()
    })
    expect(camp()).toBe('x')
  })

  it('keeps set and flush referentially stable', () => {
    const { result, rerender } = setup('?menu=utm-builder')
    const [, set, flush] = result.current.field
    act(() => set('a'))
    rerender()
    expect(result.current.field[1]).toBe(set)
    expect(result.current.field[2]).toBe(flush)
  })

  it('removes the param for an empty value', () => {
    const { result } = setup('?menu=utm-builder&camp=x')
    act(() => result.current.field[1](''))
    advance(300)
    expect(window.location.search).toBe('?menu=utm-builder')
  })

  it('does not write during IME composition, then writes 300ms after it ends', () => {
    const { result } = setup('?menu=utm-builder')
    fireEvent.compositionStart(document.body)
    act(() => result.current.field[1]('ㅎ'))
    advance(500)
    expect(camp()).toBeNull()
    act(() => result.current.field[1]('한'))
    fireEvent.compositionEnd(document.body)
    advance(299)
    expect(camp()).toBeNull()
    advance(1)
    expect(camp()).toBe('한')
  })

  it('flushes during composition', () => {
    const { result } = setup('?menu=utm-builder')
    fireEvent.compositionStart(document.body)
    act(() => result.current.field[1]('ㅎ'))
    act(() => result.current.field[2]())
    expect(camp()).toBe('ㅎ')
  })

  it('takes an outside change and drops the pending write', () => {
    const { result } = setup('?menu=utm-builder')
    act(() => result.current.field[1]('typed'))
    advance(100)
    act(() => result.current.raw[1]('outside'))
    expect(result.current.field[0]).toBe('outside')
    advance(300)
    expect(camp()).toBe('outside')
  })

  it('keeps what the user typed when its own write comes back', () => {
    const { result, rerender } = setup('?menu=utm-builder')
    act(() => result.current.field[1]('ab'))
    advance(300)
    expect(camp()).toBe('ab')
    act(() => result.current.field[1]('abc'))
    rerender()
    expect(result.current.field[0]).toBe('abc')
  })

  it('does not write after unmount', () => {
    const { result, unmount } = setup('?menu=utm-builder')
    act(() => result.current.field[1]('x'))
    const spy = vi.spyOn(window.history, 'replaceState')
    unmount()
    advance(300)
    expect(spy).not.toHaveBeenCalled()
  })

  it('drops the pending write and resets the field when the menu changes under it', () => {
    const { result } = setup('?menu=utm-builder')
    act(() => result.current.field[1]('x'))
    act(() => result.current.nav.setMenu('link-hub'))
    expect(result.current.field[0]).toBe('')
    advance(300)
    expect(window.location.search).toBe('?menu=link-hub')
  })

  it('keeps one timer and one pair of listeners under StrictMode', () => {
    const add = vi.spyOn(document, 'addEventListener')
    const remove = vi.spyOn(document, 'removeEventListener')
    const spy = vi.spyOn(window.history, 'replaceState')
    const { result, unmount } = setup('?menu=utm-builder', strictWrapper)
    spy.mockClear()
    act(() => result.current.field[1]('a'))
    advance(300)
    expect(spy).toHaveBeenCalledTimes(1)
    const added = (type: string) => add.mock.calls.filter(([t]) => t === type).length
    const removed = (type: string) => remove.mock.calls.filter(([t]) => t === type).length
    unmount()
    expect(removed('compositionstart')).toBe(added('compositionstart'))
    expect(removed('compositionend')).toBe(added('compositionend'))
    expect(added('compositionstart')).toBeGreaterThan(0)
  })
})
