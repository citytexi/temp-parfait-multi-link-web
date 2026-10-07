import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { readCollapsed, writeCollapsed } from '../menu/collapsed'
import { groupOf, MenuItem, type MenuProps } from './MenuItem'

const without = (ids: readonly string[], id: string | undefined) => ids.filter((x) => x !== id)
const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i])

/** Grouped sidebar with collapsible sections. Collapsed state persists in localStorage. */
export function SideMenu({ groups, active, onSelect }: MenuProps): ReactElement {
  const activeGroup = groupOf(groups, active)
  const [stored] = useState(readCollapsed)
  const persisted = useRef(stored)
  const [collapsed, setCollapsed] = useState(() => without(stored, activeGroup))

  // Navigating to a menu reveals its group, including a move within the same group.
  useEffect(() => {
    setCollapsed((prev) => (prev.includes(activeGroup ?? '') ? without(prev, activeGroup) : prev))
  }, [active, activeGroup])

  // Write only when the list really differs from what is stored.
  useEffect(() => {
    if (sameList(collapsed, persisted.current)) return
    persisted.current = collapsed
    writeCollapsed(collapsed)
  }, [collapsed])

  const toggle = (id: string) =>
    setCollapsed((prev) => (prev.includes(id) ? without(prev, id) : [...prev, id]))

  return (
    <nav className="adm-menu adm-menu--side" aria-label="메뉴">
      {groups
        .filter((g) => g.menus.length > 0)
        .map((group) => {
          const open = !collapsed.includes(group.id)
          const listId = `adm-menu-group-${group.id}`
          return (
            <div key={group.id} className="adm-menu__section">
              <button
                type="button"
                className="adm-menu__group"
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => toggle(group.id)}
              >
                {group.label}
                <ChevronDown className="adm-menu__chevron" size={16} aria-hidden="true" />
              </button>
              {open && (
                <ul id={listId} className="adm-menu__list" aria-label={group.label}>
                  {group.menus.map((menu) => (
                    <MenuItem key={menu.id} menu={menu} current={menu.id === active} onSelect={onSelect} />
                  ))}
                </ul>
              )}
            </div>
          )
        })}
    </nav>
  )
}
