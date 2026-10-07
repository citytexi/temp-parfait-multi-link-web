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
  /**
   * Imports the page module. The shell may call this more than once (idle prefetch, render,
   * retry), and the idle prefetch calls it for every signed-in user whether or not they open
   * the page. So the page module's top level must be free of side effects: no requests,
   * listeners, timers or storage writes at import time.
   */
  load: () => Promise<{ default: ComponentType }>
  usesPeriod?: boolean
  usesGa?: boolean
  scopes?: readonly string[]
}

// Identity helper: gives each *.menu.ts file a type-checked definition.
export function defineMenu(def: MenuDef): MenuDef {
  return def
}
