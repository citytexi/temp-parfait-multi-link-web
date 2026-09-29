import type { MenuId } from '../lib/urlState'

export const MENU_ITEMS: readonly { id: MenuId; label: string }[] = [
  { id: 'overview', label: '한눈에 보기' },
  { id: 'users', label: '사용자' },
  { id: 'events', label: '많이 한 행동' },
  { id: 'retention', label: '다시 찾아온 사람' },
  { id: 'tech', label: '기기·지역' },
  { id: 'realtime', label: '지금 접속 중' },
]

type SideMenuProps = {
  active: MenuId
  onSelect(menu: MenuId): void
}

/** Left sidebar at ≥960px; a horizontally scrollable tab bar below that. */
export function SideMenu({ active, onSelect }: SideMenuProps) {
  return (
    <nav className="adm-menu" aria-label="메뉴">
      <ul className="adm-menu__list">
        {MENU_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="adm-menu__item"
              aria-current={item.id === active ? 'page' : undefined}
              onClick={() => onSelect(item.id)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
