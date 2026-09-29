import { menuLabel } from '../components/SideMenu'
import type { MenuId } from '../lib/urlState'

/** Page area for the active menu. Placeholder until Tasks 10/11 add the real pages. */
export function MenuPage({ menu }: { menu: MenuId }) {
  return <h1 className="adm-page__title">{menuLabel(menu)}</h1>
}
