import { act, renderHook } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORE_PREFIX, forgetUnsaved, newId, readStored, useStored, writeStored, type Parser } from './localStore'

const KEY = 'parfait-admin:test'
const OTHER_KEY = 'parfait-admin:other'
const strings: Parser<string[]> = (raw) =>
  Array.isArray(raw) && raw.every((x) => typeof x === 'string') ? (raw as string[]) : null

const store = (key: string, items: unknown) => localStorage.setItem(key, JSON.stringify({ v: 1, items }))
const stored = (key: string): unknown => JSON.parse(localStorage.getItem(key) ?? 'null')
const failWrites = () =>
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError')
  })
const storageEvent = (key: string | null) => act(() => { window.dispatchEvent(new StorageEvent('storage', { key })) })

// src/test/setup.ts calls forgetUnsaved() after every test.
beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('readStored and writeStored', () => {
  it('wraps and unwraps the versioned envelope', () => {
    expect(writeStored(KEY, ['a'])).toBe(true)
    expect(localStorage.getItem(KEY)).toBe('{"v":1,"items":["a"]}')
    expect(readStored(KEY, strings, [])).toEqual(['a'])
  })
  it.each([
    ['a missing value', null],
    ['broken JSON', '{'],
    ['another version', '{"v":2,"items":["a"]}'],
    ['a value the parser rejects', '{"v":1,"items":[1]}'],
    ['a bare value without the envelope', '["a"]'],
    ['null', 'null'],
  ])('falls back on %s', (_name, raw) => {
    if (raw !== null) localStorage.setItem(KEY, raw)
    expect(readStored(KEY, strings, ['fallback'])).toEqual(['fallback'])
  })
  it('falls back when storage access throws and reports a failed write without throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readStored(KEY, strings, [])).toEqual([])
    failWrites()
    expect(writeStored(KEY, ['a'])).toBe(false)
  })
  it('reports a value that cannot be serialised as a failed write', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(writeStored(KEY, circular)).toBe(false)
  })
  it('does not overwrite an envelope written by a newer version', () => {
    const newer = '{"v":2,"items":{"shape":"new"}}'
    localStorage.setItem(KEY, newer)
    expect(writeStored(KEY, ['a'])).toBe(false)
    expect(localStorage.getItem(KEY)).toBe(newer)
    // An older or unreadable value is not protected.
    localStorage.setItem(KEY, '{"v":0,"items":["old"]}')
    expect(writeStored(KEY, ['a'])).toBe(true)
    localStorage.setItem(KEY, '{')
    expect(writeStored(KEY, ['b'])).toBe(true)
    expect(stored(KEY)).toEqual({ v: 1, items: ['b'] })
  })
  it('rejects keys without the prefix in dev', () => {
    expect(STORE_PREFIX).toBe('parfait-admin:')
    expect(() => readStored('other:key', strings, [])).toThrow(/parfait-admin:/)
    expect(() => writeStored('other:key', [])).toThrow(/parfait-admin:/)
    expect(() => renderHook(() => useStored('other:key', strings, []))).toThrow(/parfait-admin:/)
  })
})

describe('newId', () => {
  it('makes ids that differ', () => {
    expect(newId()).not.toBe(newId())
  })
  it('makes ids that differ without crypto.randomUUID', () => {
    vi.stubGlobal('crypto', {})
    try {
      const a = newId()
      expect(a).not.toBe('')
      expect(a).not.toBe(newId())
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('useStored', () => {
  it('reads the stored value and returns the same reference across renders with a fresh fallback', () => {
    store(KEY, ['a'])
    const parse = vi.fn(strings)
    const { result, rerender } = renderHook(() => useStored(KEY, parse, []))
    const first = result.current.value
    expect(first).toEqual(['a'])
    rerender()
    storageEvent(KEY)
    expect(result.current.value).toBe(first)
    expect(parse).toHaveBeenCalledTimes(1)

    const empty = renderHook(() => useStored(OTHER_KEY, strings, []))
    const fallback = empty.result.current.value
    expect(fallback).toEqual([])
    empty.rerender()
    expect(empty.result.current.value).toBe(fallback)
  })
  it('reads the new key when the key changes', () => {
    store(KEY, ['a'])
    store(OTHER_KEY, ['o'])
    const { result, rerender } = renderHook(({ k }) => useStored(k, strings, []), { initialProps: { k: KEY } })
    rerender({ k: OTHER_KEY })
    expect(result.current.value).toEqual(['o'])
    act(() => { result.current.update((cur) => [...cur, 'p']) })
    expect(stored(OTHER_KEY)).toEqual({ v: 1, items: ['o', 'p'] })
    expect(stored(KEY)).toEqual({ v: 1, items: ['a'] })
  })
  it('applies update to the latest stored value, not to the value on screen', () => {
    store(KEY, ['a'])
    const { result } = renderHook(() => useStored(KEY, strings, []))
    store(KEY, ['a', 'b'])
    let ok = false
    act(() => { ok = result.current.update((cur) => [...cur, 'c']) })
    expect(ok).toBe(true)
    expect(result.current.value).toEqual(['a', 'b', 'c'])
    expect(stored(KEY)).toEqual({ v: 1, items: ['a', 'b', 'c'] })
  })
  it('chains two updates made in the same tick', () => {
    const { result } = renderHook(() => useStored(KEY, strings, []))
    act(() => {
      result.current.update((cur) => [...cur, 'a'])
      result.current.update((cur) => [...cur, 'b'])
    })
    expect(result.current.value).toEqual(['a', 'b'])
  })
  it('keeps working in memory when the write fails, and recovers', () => {
    store(KEY, ['old'])
    const { result } = renderHook(() => useStored(KEY, strings, []))
    const setItem = failWrites()
    let ok = true
    act(() => { ok = result.current.update(() => ['x']) })
    expect(ok).toBe(false)
    expect(result.current.value).toEqual(['x'])
    expect(result.current.persisted).toBe(false)

    act(() => {
      result.current.update((cur) => [...cur, 'y'])
      ok = result.current.update((cur) => [...cur, 'y2'])
    })
    expect(ok).toBe(false)
    expect(result.current.value).toEqual(['x', 'y', 'y2'])
    expect(result.current.persisted).toBe(false)

    setItem.mockRestore()
    act(() => { ok = result.current.update((cur) => [...cur, 'z']) })
    expect(ok).toBe(true)
    expect(result.current.persisted).toBe(true)
    expect(result.current.value).toEqual(['x', 'y', 'y2', 'z'])
    expect(stored(KEY)).toEqual({ v: 1, items: ['x', 'y', 'y2', 'z'] })
  })
  it('starts persisted', () => {
    expect(renderHook(() => useStored(KEY, strings, [])).result.current.persisted).toBe(true)
  })
  it('starts persisted with the fallback when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result } = renderHook(() => useStored(KEY, strings, ['fallback']))
    expect(result.current.value).toEqual(['fallback'])
    expect(result.current.persisted).toBe(true)
  })
  it('follows storage events for its key and for a cleared storage', () => {
    const { result } = renderHook(() => useStored(KEY, strings, []))
    store(KEY, ['n'])
    storageEvent(KEY)
    expect(result.current.value).toEqual(['n'])

    localStorage.clear()
    storageEvent(null)
    expect(result.current.value).toEqual([])

    const before = result.current
    store(KEY, ['ignored'])
    storageEvent(OTHER_KEY)
    expect(result.current).toBe(before)
  })
  it('takes the stored value and turns persisted back on when a storage event arrives after a failed write', () => {
    store(KEY, ['old'])
    const { result } = renderHook(() => useStored(KEY, strings, []))
    failWrites()
    act(() => { result.current.update(() => ['x']) })
    expect(result.current.persisted).toBe(false)
    storageEvent(KEY)
    expect(result.current.value).toEqual(['old'])
    expect(result.current.persisted).toBe(true)
  })
  it('calls fn once per update and keeps one listener under StrictMode', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const count = (spy: typeof add | typeof remove) => spy.mock.calls.filter(([type]) => type === 'storage').length

    const { result, rerender, unmount } = renderHook(() => useStored(KEY, strings, []), { wrapper: StrictMode })
    rerender()
    expect(count(add) - count(remove)).toBe(1)

    const fn = vi.fn((cur: string[]) => [...cur, 'a'])
    act(() => { result.current.update(fn) })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(result.current.value).toEqual(['a'])

    unmount()
    expect(count(add)).toBe(count(remove))
  })
})

describe('useStored: values that were not saved', () => {
  it('keeps an unsaved value across unmount and mount, until a write succeeds', () => {
    store(KEY, ['old'])
    const setItem = failWrites()
    const first = renderHook(() => useStored(KEY, strings, []))
    act(() => { first.result.current.update((cur) => [...cur, 'x']) })
    first.unmount()

    const second = renderHook(() => useStored(KEY, strings, []))
    expect(second.result.current.value).toEqual(['old', 'x'])
    expect(second.result.current.persisted).toBe(false)

    setItem.mockRestore()
    act(() => { second.result.current.update((cur) => [...cur, 'y']) })
    expect(second.result.current.persisted).toBe(true)
    expect(stored(KEY)).toEqual({ v: 1, items: ['old', 'x', 'y'] })
    second.unmount()

    // The entry is gone: the next mount reads storage, not the value the hook last held.
    store(KEY, ['fresh'])
    const third = renderHook(() => useStored(KEY, strings, []))
    expect(third.result.current.value).toEqual(['fresh'])
    expect(third.result.current.persisted).toBe(true)
  })
  it('keeps unsaved values apart by key', () => {
    failWrites()
    const a = renderHook(() => useStored(KEY, strings, []))
    act(() => { a.result.current.update(() => ['a']) })
    a.unmount()

    const other = renderHook(() => useStored(OTHER_KEY, strings, []))
    expect(other.result.current.value).toEqual([])
    expect(other.result.current.persisted).toBe(true)
    act(() => { other.result.current.update(() => ['o']) })
    other.unmount()

    expect(renderHook(() => useStored(KEY, strings, [])).result.current.value).toEqual(['a'])
    expect(renderHook(() => useStored(OTHER_KEY, strings, [])).result.current.value).toEqual(['o'])
  })
  it('drops the unsaved value when another tab wrote, mounted or not', () => {
    const setItem = failWrites()
    const first = renderHook(() => useStored(KEY, strings, []))
    act(() => { first.result.current.update(() => ['x']) })
    setItem.mockRestore()
    store(KEY, ['tab'])
    storageEvent(KEY)
    expect(first.result.current.value).toEqual(['tab'])
    first.unmount()
    expect(renderHook(() => useStored(KEY, strings, [])).result.current.persisted).toBe(true)

    // The same while no page is mounted to hear the event.
    const setItem2 = failWrites()
    const second = renderHook(() => useStored(OTHER_KEY, strings, []))
    act(() => { second.result.current.update(() => ['x']) })
    second.unmount()
    setItem2.mockRestore()
    store(OTHER_KEY, ['tab'])
    const third = renderHook(() => useStored(OTHER_KEY, strings, []))
    expect(third.result.current.value).toEqual(['tab'])
    expect(third.result.current.persisted).toBe(true)
  })
  it('forgets unsaved values on forgetUnsaved', () => {
    failWrites()
    const first = renderHook(() => useStored(KEY, strings, []))
    act(() => { first.result.current.update(() => ['x']) })
    first.unmount()
    forgetUnsaved()
    expect(renderHook(() => useStored(KEY, strings, [])).result.current.value).toEqual([])
  })
})

describe('useStored: a write from another tab before the listener is on', () => {
  it('picks it up without a storage event', () => {
    store(KEY, ['a'])
    let wrote = false
    const { result } = renderHook(() => {
      const held = useStored(KEY, strings, [])
      // After the first read, before the effect: what another tab does in that gap.
      if (!wrote) {
        wrote = true
        store(KEY, ['a', 'late'])
      }
      return held
    })
    expect(result.current.value).toEqual(['a', 'late'])
    expect(result.current.persisted).toBe(true)
  })
  it('renders once when nothing changed', () => {
    store(KEY, ['a'])
    let renders = 0
    renderHook(() => {
      renders += 1
      return useStored(KEY, strings, [])
    })
    expect(renders).toBe(1)
  })
})

describe('useStored: an envelope from a newer version', () => {
  const NEWER = '{"v":2,"items":{"shape":"new"}}'

  it('is read-only: the fallback, changes on screen only, storage untouched', () => {
    localStorage.setItem(KEY, NEWER)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { result, unmount } = renderHook(() => useStored(KEY, strings, ['fallback']))
    expect(result.current.value).toEqual(['fallback'])
    expect(result.current.persisted).toBe(false)

    let ok = true
    act(() => { ok = result.current.update((cur) => [...cur, 'x']) })
    expect(ok).toBe(false)
    expect(result.current.value).toEqual(['fallback', 'x'])
    expect(result.current.persisted).toBe(false)
    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.getItem(KEY)).toBe(NEWER)

    // The newer tab writes again: what is on screen stays.
    setItem.mockRestore()
    localStorage.setItem(KEY, '{"v":2,"items":{"shape":"newer still"}}')
    storageEvent(KEY)
    expect(result.current.value).toEqual(['fallback', 'x'])
    unmount()
    expect(renderHook(() => useStored(KEY, strings, ['fallback'])).result.current.value).toEqual(['fallback', 'x'])
  })
  it('stops writing when a newer version appears after the first read', () => {
    store(KEY, ['a'])
    const { result } = renderHook(() => useStored(KEY, strings, []))
    localStorage.setItem(KEY, NEWER)
    act(() => { result.current.update((cur) => [...cur, 'x']) })
    expect(result.current.persisted).toBe(false)
    expect(localStorage.getItem(KEY)).toBe(NEWER)
  })
  it('writes again once the newer value is gone', () => {
    localStorage.setItem(KEY, NEWER)
    const { result } = renderHook(() => useStored(KEY, strings, []))
    localStorage.clear()
    storageEvent(null)
    expect(result.current.persisted).toBe(true)
    act(() => { result.current.update(() => ['x']) })
    expect(stored(KEY)).toEqual({ v: 1, items: ['x'] })
  })
})
