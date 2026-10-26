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
// Errors a chunk load ended with. Any other error the boundary catches was thrown by a page while rendering.
const loadErrors = new WeakSet<object>()

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
      if (typeof error === 'object' && error !== null) loadErrors.add(error)
      throw error
    }),
  )
  lazyPages.set(menu, page)
  return page
}

type Picked = { menu: MenuDef; Page: ComponentType }

function pickPage(menu: MenuDef): Picked {
  return { menu, Page: resolvedPages.get(menu) ?? lazyPage(menu) }
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

/** `load`: the chunk did not arrive. `render`: the page arrived and threw. */
type Failure = 'load' | 'render'
type BoundaryProps = { fallback(kind: Failure): ReactNode; children: ReactNode }
type BoundaryState = { failed: Failure | null }

class PageErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: null }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    const load = typeof error === 'object' && error !== null && loadErrors.has(error)
    return { failed: load ? 'load' : 'render' }
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback(this.state.failed) : this.props.children
  }
}

/**
 * The page itself, behind a loading status until its chunk has arrived. A page whose chunk is
 * already here sits under the same Suspense, so one that suspends on its own shows the status too.
 */
function PageBody({ menu }: { menu: MenuDef }): ReactElement {
  // Chosen once per mount. Swapping the lazy wrapper for the resolved component on a later
  // render would change the element type and remount the page, losing its state.
  const [picked, setPicked] = useState(() => pickPage(menu))
  if (picked.menu !== menu) setPicked(pickPage(menu))
  const { Page } = picked.menu === menu ? picked : pickPage(menu)

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

  const failure = (kind: Failure) => {
    // Another try can fetch a chunk again. A page that threw will most likely throw again, so the
    // reload is offered at once.
    const offerReload = kind === 'render' || attempt >= 1
    return (
      <div className="adm-state adm-state--error adm-page__failure" role="alert">
        <p className="adm-state__text">
          {kind === 'load' ? '화면을 불러오지 못했어요' : '화면을 보여 주다가 문제가 생겼어요'}
        </p>
        <div className="adm-page__failure-actions">
          <button type="button" className="adm-button adm-button--secondary" onClick={retry}>
            다시 시도
          </button>
          {offerReload && (
            <button type="button" className="adm-button adm-button--ghost" onClick={() => window.location.reload()}>
              새로고침
            </button>
          )}
        </div>
        {offerReload && <p className="adm-page__failure-note">새로고침하면 다시 로그인해야 해요.</p>}
      </div>
    )
  }

  return (
    // A new key remounts the boundary and the page, which then loads a failed chunk again.
    <PageErrorBoundary key={`${menu.id}:${attempt}`} fallback={failure}>
      <PageBody menu={menu} />
    </PageErrorBoundary>
  )
}
