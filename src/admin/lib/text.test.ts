import { describe, expect, it } from 'vitest'
import { hasUnsafeChars } from './text'

describe('hasUnsafeChars', () => {
  it('accepts ordinary names, emoji and joined emoji', () => {
    for (const text of ['1.5.0', '여름 캠페인', 'Figma — 디자인', '🍨', '👩\u200d💻', '']) {
      expect(hasUnsafeChars(text)).toBe(false)
    }
  })

  it('refuses control characters and line breaks', () => {
    for (const text of ['a\nb', 'a\tb', 'a\u0000b', 'a\u007fb', 'a\u0085b', 'a\u2028b', 'a\u2029b']) {
      expect(hasUnsafeChars(text)).toBe(true)
    }
  })

  it('refuses characters that reorder or hide text', () => {
    for (const text of ['a\u202eb', 'a\u200fb', 'a\u2066b', 'a\u200bb', 'a\ufeffb', 'a\u061cb']) {
      expect(hasUnsafeChars(text)).toBe(true)
    }
  })

  it('refuses half of a surrogate pair', () => {
    expect(hasUnsafeChars('a\ud83db')).toBe(true)
    expect(hasUnsafeChars('a\udc00')).toBe(true)
  })
})
