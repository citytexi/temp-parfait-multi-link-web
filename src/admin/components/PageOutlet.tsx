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

// Both caches are keyed by the definition object, not its id: a rebuilt registry never inherits stale entries.
// Components whose chunk has arrived, filled by the idle prefetch and by the lazy loader alike.
const resolvedPages = new WeakMap<MenuDef, ComponentType>()
// Lazy wrappers for chunks still on their way. A wrapper whose load failed is dropped.
const lazyPages = new WeakMap<MenuDef, LazyExoticComponent<ComponentType>>()

function loadPage(menu: MenuDef): Promise<{ default: ComponentType }> {
  return menu.load().then((mod) => {
    resolvedPages.set(menu, mod.default)
    return mod
  })
}

function lazyPage(menu: MenuDef): LazyExoticComponent<ComponentType> {
  const cached = lazyPages.get(menu)
  if (cached) return cached
  const page: LazyExoticComponent<ComponentType> = lazy(() =>
    loadPage(menu).catch((error: unknown) => {
      // A failed load must not stay cached, whether or not anything is mounted to see it fail.
      // Compare first: a rejection that arrives late must not drop a newer wrapper.
      if (lazyPages.get(menu) === page) lazyPages.delete(menu)
      throw error
    }),
  )
  lazyPages.set(menu, page)
  return page
}

type Picked = { menu: MenuDef; Page: ComponentType; ready: boolean }

function pickPage(menu: MenuDef): Picked {
  const Ready = resolvedPages.get(menu)
  return Ready ? { menu, Page: Ready, ready: true } : { menu, Page: lazyPage(menu), ready: false }
}

/**
 * Loads every page chunk while the browser is idle so later menu changes are instant.
 * Failures are ignored here; the outlet reports them when the page is actually opened.
 * Returns a function that cancels the load if it has not started yet.
 */
export function prefetchPages(menus: readonly MenuDef[]): () => void {
  const run = () => {
    for (const menu of menus) {
      if (!resolvedPages.has(menu)) loadPage(menu).catch(() => {})
    }
  }
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(run)
    return () => window.cancelIdleCallback(handle)
  }
  const timer = window.setTimeout(run, PREFETCH_DELAY_MS)
  return () => window.clearTimeout(timer)
}

type BoundaryProps = { fallback: ReactNode; children: ReactNode }

class PageErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** The page itself: at once when its chunk has already arrived, behind a loading status otherwise. */
function PageBody({ menu }: { menu: MenuDef }): ReactElement {
  // Chosen once per mount. Swapping the lazy wrapper for the resolved component on a later
  // render would change the element type and remount the page, losing its state.
  const [picked, setPicked] = useState(() => pickPage(menu))
  if (picked.menu !== menu) setPicked(pickPage(menu))
  const { Page, ready } = picked.menu === menu ? picked : pickPage(menu)

  if (ready) return <Page />
  return (
    <Suspense
      fallback={
        <p className="adm-page__loading" role="status">
          불러오는 중이에요
        </p>
      }
    >
      <Page />
    </Suspense>
  )
}

/**
 * Renders the menu's page with loading and failure states. `onRetry` runs when the user asks
 * for another try, so the shell can move focus before the retry button goes away.
 */
export function PageOutlet({ menu, onRetry }: { menu: MenuDef; onRetry?: () => void }): ReactElement {
  // Retries made for the menu `id`; a different menu starts again from 0.
  const [tries, setTries] = useState({ id: menu.id, attempt: 0 })
  if (tries.id !== menu.id) setTries({ id: menu.id, attempt: 0 })
  const attempt = tries.id === menu.id ? tries.attempt : 0

  const retry = () => {
    setTries({ id: menu.id, attempt: attempt + 1 })
    onRetry?.()
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
    // A new key remounts the boundary and the page, which then loads a failed chunk again.
    <PageErrorBoundary key={`${menu.id}:${attempt}`} fallback={failure}>
      <PageBody menu={menu} />
    </PageErrorBoundary>
  )
}
