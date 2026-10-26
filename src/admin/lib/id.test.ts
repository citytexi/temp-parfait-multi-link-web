import { describe, expect, it, vi } from 'vitest'
import { newId } from './id'

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
