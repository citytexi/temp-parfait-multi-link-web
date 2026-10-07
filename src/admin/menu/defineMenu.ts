import type { LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'

export type GroupId = 'metrics' | 'devtools' | 'ops'

export type MenuDef = {
  id: string
  group: GroupId
  order: number
  label: string
  description: string
  icon: LucideIcon
  keywords?: readonly string[]
  load: () => Promise<{ default: ComponentType }>
  usesPeriod?: boolean
  usesGa?: boolean
  scopes?: readonly string[]
}

// Identity helper: gives each *.menu.ts file a type-checked definition.
export function defineMenu(def: MenuDef): MenuDef {
  return def
}
