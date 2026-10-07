import type { ReactElement, Ref } from 'react'
import type { MenuDef } from '../menu/defineMenu'
import type { MenuGroup } from '../menu/registry'

export type MenuProps = {
  groups: readonly MenuGroup[]
  active: string
  onSelect(id: string): void
}

type MenuItemProps = {
  menu: MenuDef
  current: boolean
  onSelect(id: string): void
  buttonRef?: Ref<HTMLButtonElement>
}

/** One menu button: icon plus label. Shared by the sidebar and the mobile tabs. */
export function MenuItem({ menu, current, onSelect, buttonRef }: MenuItemProps): ReactElement {
  const Icon = menu.icon
  return (
    <li>
      <button
        ref={buttonRef}
        type="button"
        className="adm-menu__item"
        aria-current={current ? 'page' : undefined}
        onClick={() => onSelect(menu.id)}
      >
        <Icon className="adm-menu__icon" size={18} aria-hidden="true" />
        {menu.label}
      </button>
    </li>
  )
}

/** Group id that owns the menu, if any. */
export function groupOf(groups: readonly MenuGroup[], menuId: string): string | undefined {
  return groups.find((g) => g.menus.some((m) => m.id === menuId))?.id
}
