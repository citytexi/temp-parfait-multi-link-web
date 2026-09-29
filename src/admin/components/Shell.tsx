import { useAuth } from '../auth/AuthContext'
import { useGa } from '../hooks/useGa'
import { MenuPage } from '../pages/MenuPage'
import { PeriodFilter } from './PeriodFilter'
import { QuotaBadge } from './QuotaBadge'
import { SideMenu } from './SideMenu'

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
          <MenuPage menu={menu} />
        </main>
      </div>
      <footer className="adm-shell__footer">
        <QuotaBadge />
      </footer>
    </div>
  )
}
