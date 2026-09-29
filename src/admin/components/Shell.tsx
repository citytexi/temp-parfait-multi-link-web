import { useAuth } from '../auth/AuthContext'
import { useGa } from '../hooks/useGa'
import type { MenuId } from '../lib/urlState'
import { EventsPage } from '../pages/EventsPage'
import { OverviewPage } from '../pages/OverviewPage'
import { RealtimePage } from '../pages/RealtimePage'
import { RetentionPage } from '../pages/RetentionPage'
import { TechPage } from '../pages/TechPage'
import { UsersPage } from '../pages/UsersPage'
import { PeriodFilter } from './PeriodFilter'
import { QuotaBadge } from './QuotaBadge'
import { SideMenu } from './SideMenu'

function Page({ menu }: { menu: MenuId }) {
  switch (menu) {
    case 'overview':
      return <OverviewPage />
    case 'users':
      return <UsersPage />
    case 'events':
      return <EventsPage />
    case 'retention':
      return <RetentionPage />
    case 'tech':
      return <TechPage />
    case 'realtime':
      return <RealtimePage />
  }
}

export function Shell() {
  const { logout } = useAuth()
  const { menu, period, periodError, today, setMenu, setPeriod } = useGa()

  return (
    <div className="adm-shell">
      <header className="adm-topbar">
        <p className="adm-topbar__brand">파르페 대시보드</p>
        <div className="adm-topbar__filter">
          <PeriodFilter period={period} today={today} error={periodError} onChange={setPeriod} />
          <p className="adm-topbar__basis">기준: 어제까지, 한국 시간</p>
        </div>
        <button type="button" className="adm-button adm-button--ghost adm-topbar__logout" onClick={() => void logout()}>
          로그아웃
        </button>
      </header>
      <div className="adm-shell__body">
        <SideMenu active={menu} onSelect={setMenu} />
        <main className="adm-page">
          <Page menu={menu} />
        </main>
      </div>
      <footer className="adm-shell__footer">
        <QuotaBadge />
      </footer>
    </div>
  )
}
