import { beforeEach, describe, expect, it, vi } from 'vitest'
import { COLLAPSED_KEY, readCollapsed, writeCollapsed } from './collapsed'

describe('collapsed menu groups storage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('returns [] when nothing is stored', () => expect(readCollapsed()).toEqual([]))

  it('round-trips ids', () => {
    writeCollapsed(['ops', 'devtools'])
    expect(readCollapsed()).toEqual(['ops', 'devtools'])
  })

  it.each(['{not json', '"ops"', '{"a":1}', 'null'])('returns [] for malformed value %s', (raw) => {
    localStorage.setItem(COLLAPSED_KEY, raw)
    expect(readCollapsed()).toEqual([])
  })

  it('drops non-string entries', () => {
    localStorage.setItem(COLLAPSED_KEY, '["ops", 3, null]')
    expect(readCollapsed()).toEqual(['ops'])
  })

  it('returns [] and does not throw when storage access throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(readCollapsed()).toEqual([])
    expect(() => writeCollapsed(['ops'])).not.toThrow()
  })
})
