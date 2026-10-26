import type { GroupId, MenuDef } from './defineMenu'
import { GROUPS } from './groups'

export type MenuGroup = { id: GroupId; label: string; menus: readonly MenuDef[] }
export type MenuLookup = { defaultMenu: string; isMenu(id: string): boolean; usesPeriod(id: string): boolean }
export type Registry = {
  menus: readonly MenuDef[]
  groups: readonly MenuGroup[]
  findMenu(id: string): MenuDef | undefined
  lookup: MenuLookup
}

export function buildRegistry(defs: readonly MenuDef[], defaultMenu = 'overview'): Registry {
  const groupIndex = new Map<GroupId, number>(GROUPS.map((g, i) => [g.id, i]))
  const seen = new Set<string>()
  for (const d of defs) {
    if (seen.has(d.id)) throw new Error(`Duplicate menu id: ${d.id}`)
    seen.add(d.id)
    if (!groupIndex.has(d.group)) throw new Error(`Unknown menu group "${d.group}" in menu "${d.id}"`)
  }
  const menus = [...defs].sort(
    (a, b) =>
      groupIndex.get(a.group)! - groupIndex.get(b.group)! ||
      a.order - b.order ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
  const groups = GROUPS.map((g) => ({ ...g, menus: menus.filter((m) => m.group === g.id) })).filter((g) => g.menus.length > 0)
  const byId = new Map(menus.map((m) => [m.id, m]))
  // A default that is not a menu would leave the page area blank. An empty registry has no page to show anyway.
  if (menus.length > 0 && !byId.has(defaultMenu)) throw new Error(`Default menu "${defaultMenu}" is not a registered menu`)
  return {
    menus,
    groups,
    findMenu: (id) => byId.get(id),
    lookup: {
      defaultMenu,
      isMenu: (id) => byId.has(id),
      usesPeriod: (id) => byId.get(id)?.usesPeriod === true,
    },
  }
}

const modules = import.meta.glob<MenuDef>('../pages/**/*.menu.ts', { eager: true, import: 'default' })

export const REGISTRY: Registry = buildRegistry(Object.values(modules), 'overview')
