import { act, render, renderHook } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Period } from '../lib/period'
import { NavProvider, useNav, usePageParam } from './NavContext'
import type { MenuLookup } from './registry'

const lookup: MenuLookup = {
  defaultMenu: 'overview',
  isMenu: (id) => ['overview', 'users', 'events', 'tech', 'realtime', 'utm'].includes(id),
  usesPeriod: (id) => !['realtime', 'utm'].includes(id),
}

const P90: Period = { kind: 'preset', preset: '90d' }
const P28: Period = { kind: 'preset', preset: '28d' }

function setup(url = '/admin/', strict = false) {
  window.history.replaceState(null, '', url)
  const pushSpy = vi.spyOn(window.history, 'pushState')
  const replaceSpy = vi.spyOn(window.history, 'replaceState')
  const wrapper = ({ children }: { children: ReactNode }) => {
    const tree = <NavProvider lookup={lookup}>{children}</NavProvider>
    return strict ? <StrictMode>{tree}</StrictMode> : tree
  }
  const hook = renderHook(() => ({ nav: useNav(), param: usePageParam('q') }), { wrapper })
  return { ...hook, pushSpy, replaceSpy }
}

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/')
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('NavProvider', () => {
  it('pushes history on a menu change and replaces on a period change', () => {
    const { result, pushSpy, replaceSpy } = setup()
    act(() => result.current.nav.setMenu('users'))
    expect(pushSpy).toHaveBeenLastCalledWith(null, '', '/admin/?menu=users&period=7d')
    act(() => result.current.nav.setPeriod(P90))
    expect(replaceSpy).toHaveBeenLastCalledWith(null, '', '/admin/?menu=users&period=90d')
    expect(result.current.nav.menu).toBe('users')
    expect(result.current.nav.period).toEqual(P90)
  })

  it('does not push when the menu is unchanged', () => {
    const { result, pushSpy } = setup()
    act(() => result.current.nav.setMenu('overview'))
    expect(pushSpy).not.toHaveBeenCalled()
  })

  it('ignores an id that is not a menu and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result, pushSpy, replaceSpy } = setup('/admin/?menu=users&q=hello')
    replaceSpy.mockClear()
    act(() => result.current.nav.setMenu('nope'))
    expect(pushSpy).not.toHaveBeenCalled()
    expect(replaceSpy).not.toHaveBeenCalled()
    expect(window.location.pathname + window.location.search).toBe('/admin/?menu=users&q=hello')
    expect(result.current.nav.menu).toBe('users')
    expect(result.current.param[0]).toBe('hello')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0].join(' ')).toContain('nope')
  })

  it('clears page params on a menu change', () => {
    const { result, pushSpy } = setup('/admin/?menu=utm&q=hello')
    expect(result.current.param[0]).toBe('hello')
    act(() => result.current.nav.setMenu('events'))
    expect(pushSpy).toHaveBeenLastCalledWith(null, '', '/admin/?menu=events&period=7d')
    expect(result.current.param[0]).toBeNull()
  })

  it('writes and removes a page param with replaceState, keeping the others', () => {
    const { result, replaceSpy, pushSpy } = setup('/admin/?menu=utm&a=1')
    act(() => result.current.param[1]('x'))
    expect(replaceSpy).toHaveBeenLastCalledWith(null, '', '/admin/?menu=utm&a=1&q=x')
    expect(result.current.param[0]).toBe('x')
    act(() => result.current.param[1](null))
    expect(replaceSpy).toHaveBeenLastCalledWith(null, '', '/admin/?menu=utm&a=1')
    expect(result.current.param[0]).toBeNull()
    expect(pushSpy).not.toHaveBeenCalled()
  })

  it('keeps the chosen period across a visit to a period-less menu', () => {
    const { result } = setup()
    act(() => result.current.nav.setPeriod(P28))
    act(() => result.current.nav.setMenu('utm'))
    act(() => result.current.nav.setMenu('events'))
    expect(window.location.pathname + window.location.search).toBe('/admin/?menu=events&period=28d')
  })

  it('restores the menu on popstate and falls back to overview for an unknown id', () => {
    const { result } = setup('/admin/?menu=users')
    expect(result.current.nav.menu).toBe('users')
    window.history.replaceState(null, '', '/admin/?menu=nope')
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(result.current.nav.menu).toBe('overview')
  })

  it('keeps the in-memory period when popstate lands on a period-less menu', () => {
    const { result } = setup('/admin/?menu=events')
    act(() => result.current.nav.setPeriod(P28))
    window.history.replaceState(null, '', '/admin/?menu=utm')
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(result.current.nav.menu).toBe('utm')
    expect(result.current.nav.period).toEqual(P28)
  })

  it('throws when usePageParam is given a reserved key', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <NavProvider lookup={lookup}>
          <Reserved />
        </NavProvider>,
      ),
    ).toThrow(/menu/)
  })

  it('keeps setMenu, setPeriod and the page param setter stable across state changes', () => {
    const { result } = setup()
    const { setMenu, setPeriod } = result.current.nav
    const setQ = result.current.param[1]
    act(() => result.current.nav.setMenu('users'))
    act(() => result.current.nav.setPeriod(P90))
    act(() => result.current.param[1]('v'))
    expect(result.current.nav.setMenu).toBe(setMenu)
    expect(result.current.nav.setPeriod).toBe(setPeriod)
    expect(result.current.param[1]).toBe(setQ)
  })

  it('does not touch history when a value is unchanged', () => {
    const { result, pushSpy, replaceSpy } = setup('/admin/?menu=utm&q=a')
    replaceSpy.mockClear()
    act(() => result.current.nav.setPeriod({ kind: 'preset', preset: '7d' }))
    act(() => result.current.param[1]('a'))
    act(() => result.current.nav.setMenu('utm'))
    expect(pushSpy).not.toHaveBeenCalled()
    expect(replaceSpy).not.toHaveBeenCalled()
  })

  it('does not touch history when removing a param that is not set', () => {
    const { result, pushSpy, replaceSpy } = setup('/admin/?menu=utm')
    replaceSpy.mockClear()
    act(() => result.current.param[1](null))
    expect(pushSpy).not.toHaveBeenCalled()
    expect(replaceSpy).not.toHaveBeenCalled()
  })

  it('pushes once per menu change under StrictMode', () => {
    const { result, pushSpy } = setup('/admin/', true)
    act(() => result.current.nav.setMenu('users'))
    expect(pushSpy).toHaveBeenCalledTimes(1)
  })
})

function Reserved() {
  usePageParam('menu')
  return null
}
