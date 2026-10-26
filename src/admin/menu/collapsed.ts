export const COLLAPSED_KEY = 'parfait-admin:menu-collapsed'

/** Collapsed group ids from localStorage; [] when missing, malformed or blocked. */
export function readCollapsed(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? 'null')
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function writeCollapsed(ids: readonly string[]): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(ids))
  } catch {
    // Storage is UI-only state; losing it is fine.
  }
}
