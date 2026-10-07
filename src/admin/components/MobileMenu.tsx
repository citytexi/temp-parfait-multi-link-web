import { useEffect, useRef, useState, type ReactElement } from 'react'
import { groupOf, MenuItem, type MenuProps } from './MenuItem'

/** Mobile menu: a group switch above a horizontally scrolling tab list. */
export function MobileMenu({ groups, active, onSelect }: MenuProps): ReactElement {
  const activeGroup = groupOf(groups, active)
  const [picked, setPicked] = useState(activeGroup ?? groups[0]?.id)
  const activeTab = useRef<HTMLButtonElement>(null)

  // Following navigation: any change of the active menu shows that menu's group again.
  useEffect(() => {
    if (activeGroup) setPicked(activeGroup)
  }, [active, activeGroup])

  useEffect(() => {
    activeTab.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [active, picked])

  const shown = groups.find((g) => g.id === picked) ?? groups[0]

  return (
    <nav className="adm-menu adm-menu--mobile" aria-label="메뉴">
      {groups.length > 1 && (
        <div className="adm-menu__switch" role="group" aria-label="메뉴 그룹">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className="adm-menu__segment"
              aria-pressed={g.id === shown?.id}
              aria-controls="adm-mobile-tabs"
              onClick={() => setPicked(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}
      {shown && (
        <ul id="adm-mobile-tabs" className="adm-menu__list" aria-label={shown.label}>
          {shown.menus.map((menu) => (
            <MenuItem
              key={menu.id}
              menu={menu}
              current={menu.id === active}
              onSelect={onSelect}
              buttonRef={menu.id === active ? activeTab : undefined}
            />
          ))}
        </ul>
      )}
    </nav>
  )
}
