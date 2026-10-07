import { useEffect, useRef, type ReactElement, type RefObject } from 'react'
import { useGa } from '../hooks/useGa'
import type { MenuDef } from '../menu/defineMenu'
import { PeriodFilter } from './PeriodFilter'

type PageHeaderProps = {
  menu: MenuDef
  /** Points at the page `<h1>`, so the shell can move focus there without knowing this markup. */
  titleRef: RefObject<HTMLHeadingElement | null>
}

/** Page title, description and (for menus that use it) the period filter, all from the menu definition. */
export function PageHeader({ menu, titleRef }: PageHeaderProps): ReactElement {
  const { period, today, periodError, setPeriod } = useGa()
  const prevId = useRef(menu.id)

  useEffect(() => {
    document.title = `${menu.label} · 파르페 대시보드`
  }, [menu.id, menu.label])

  // Move focus to the new title after navigation, never on first render. Comparing ids
  // (not a "first run" flag) stays correct when StrictMode runs the effect twice.
  useEffect(() => {
    if (prevId.current === menu.id) return
    prevId.current = menu.id
    titleRef.current?.focus()
  }, [menu.id, titleRef])

  return (
    <header className="adm-page-header">
      <div className="adm-page-header__text">
        <h1 ref={titleRef} className="adm-page__title" tabIndex={-1}>
          {menu.label}
        </h1>
        <p className="adm-page-header__desc">{menu.description}</p>
      </div>
      {menu.usesPeriod && (
        <div className="adm-page-header__tools">
          <PeriodFilter period={period} today={today} error={periodError} onChange={setPeriod} />
          <p className="adm-page-header__basis">기준: 어제까지, 한국 시간</p>
        </div>
      )}
    </header>
  )
}
