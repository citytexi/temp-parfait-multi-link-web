import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom lacks these; cmdk and responsive layout code need them. Guarded because
// `// @vitest-environment node` tests load this file too and have no window.
if (typeof window !== 'undefined') {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
  if (!window.matchMedia) {
    // Desktop by default.
    window.matchMedia = (media: string) =>
      ({
        matches: true,
        media,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList
  }
}

afterEach(cleanup)
