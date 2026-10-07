import { Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useNav } from '../menu/NavContext'
import { REGISTRY, type Registry } from '../menu/registry'
import { useIsDesktop } from '../menu/useIsDesktop'
import { CommandMenu } from './CommandMenu'
import { MobileMenu } from './MobileMenu'
import { PageHeader } from './PageHeader'
import { PageOutlet, prefetchPages } from './PageOutlet'
import { QuotaBadge } from './QuotaBadge'
import { SideMenu } from './SideMenu'

const shortcutLabel = () => (navigator.platform.startsWith('Mac') ? '⌘K' : 'Ctrl K')

/** App frame: top bar, menu, page header and page. Knows menus only through the registry. */
export function Shell({ registry = REGISTRY }: { registry?: Registry }): ReactElement {
  const { logout } = useAuth()
  const { menu, setMenu } = useNav()
  const isDesktop = useIsDesktop()
  const [commandOpen, setCommandOpen] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const focusTitle = useCallback(() => titleRef.current?.focus(), [])
  const current = registry.findMenu(menu) ?? registry.findMenu(registry.lookup.defaultMenu)
  const Menu = isDesktop ? SideMenu : MobileMenu

  useEffect(() => prefetchPages(registry.menus), [registry])

  return (
    <div className="adm-shell">
      <header className="adm-topbar">
        <p className="adm-topbar__brand">파르페 대시보드</p>
        <button
          type="button"
          className="adm-topbar__search"
          aria-label="메뉴 검색"
          onClick={() => setCommandOpen(true)}
        >
          <Search className="adm-topbar__search-icon" size={18} aria-hidden="true" />
          <span className="adm-topbar__search-text">검색</span>
          {isDesktop && <kbd className="adm-topbar__kbd">{shortcutLabel()}</kbd>}
        </button>
        <button type="button" className="adm-button adm-button--ghost adm-topbar__logout" onClick={() => void logout()}>
          로그아웃
        </button>
      </header>
      <div className="adm-shell__body">
        <Menu groups={registry.groups} active={current?.id ?? menu} onSelect={setMenu} />
        <main className="adm-page">
          {current && (
            <>
              <PageHeader menu={current} titleRef={titleRef} />
              <PageOutlet menu={current} onRetry={focusTitle} />
            </>
          )}
        </main>
      </div>
      <footer className="adm-shell__footer">{current?.usesGa && <QuotaBadge />}</footer>
      <CommandMenu groups={registry.groups} open={commandOpen} onOpenChange={setCommandOpen} onSelect={setMenu} />
    </div>
  )
}
