import {
  Component,
  lazy,
  Suspense,
  useState,
  type ComponentType,
  type LazyExoticComponent,
  type ReactElement,
  type ReactNode,
} from 'react'
import type { MenuDef } from '../menu/defineMenu'

const PREFETCH_DELAY_MS = 1500

// Keyed by the definition object, not its id: a rebuilt registry never inherits stale entries.
const lazyPages = new WeakMap<MenuDef, LazyExoticComponent<ComponentType>>()

function lazyPage(menu: MenuDef): LazyExoticComponent<ComponentType> {
  let page = lazyPages.get(menu)
  if (!page) {
    page = lazy(menu.load)
    lazyPages.set(menu, page)
  }
  return page
}

/**
 * Loads every page chunk while the browser is idle so later menu changes are instant.
 * Failures are ignored here; the outlet reports them when the page is actually opened.
 * Returns a function that cancels the load if it has not started yet.
 */
export function prefetchPages(menus: readonly MenuDef[]): () => void {
  const run = () => {
    for (const menu of menus) menu.load().catch(() => {})
  }
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(run)
    return () => window.cancelIdleCallback(handle)
  }
  const timer = window.setTimeout(run, PREFETCH_DELAY_MS)
  return () => window.clearTimeout(timer)
}

type BoundaryProps = { fallback: ReactNode; onError(): void; children: ReactNode }

class PageErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(): void {
    this.props.onError()
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** Renders the menu's page from its lazily loaded chunk, with loading and failure states. */
export function PageOutlet({ menu }: { menu: MenuDef }): ReactElement {
  // Retries made for the menu `id`; a different menu starts again from 0.
  const [tries, setTries] = useState({ id: menu.id, attempt: 0 })
  if (tries.id !== menu.id) setTries({ id: menu.id, attempt: 0 })
  const attempt = tries.id === menu.id ? tries.attempt : 0

  const Page = lazyPage(menu)

  const retry = () => {
    lazyPages.delete(menu)
    setTries({ id: menu.id, attempt: attempt + 1 })
  }

  const failure = (
    <div className="adm-state adm-state--error adm-page__failure" role="alert">
      <p className="adm-state__text">화면을 불러오지 못했어요</p>
      <div className="adm-page__failure-actions">
        <button type="button" className="adm-button adm-button--secondary" onClick={retry}>
          다시 시도
        </button>
        {attempt >= 1 && (
          <button type="button" className="adm-button adm-button--ghost" onClick={() => window.location.reload()}>
            새로고침
          </button>
        )}
      </div>
      {attempt >= 1 && <p className="adm-page__failure-note">새로고침하면 다시 로그인해야 해요.</p>}
    </div>
  )

  return (
    // A failed chunk is dropped from the cache, so retrying or coming back fetches it again.
    <PageErrorBoundary key={`${menu.id}:${attempt}`} fallback={failure} onError={() => lazyPages.delete(menu)}>
      <Suspense
        fallback={
          <p className="adm-page__loading" role="status">
            불러오는 중이에요
          </p>
        }
      >
        <Page />
      </Suspense>
    </PageErrorBoundary>
  )
}
