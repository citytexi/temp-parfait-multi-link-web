import { NAME_MAX, isChecked, normalizePlatforms, validateName, type Release } from './release'
import { CHECKLIST, type ChecklistSection, type ReleasePlatform } from './template'

export const SHARE_MAX = 4000
export type SharePayload = { name: string; platforms: ReleasePlatform[]; checked: string[] }

type Shareable = Pick<Release, 'name' | 'platforms' | 'checked'>

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function encodeShare(release: Shareable, template: readonly ChecklistSection[] = CHECKLIST): string {
  const checked = template.flatMap((s) => s.items).filter((i) => isChecked(release, i.id)).map((i) => i.id)
  const json = JSON.stringify({ v: 1, name: release.name, platforms: release.platforms, checked })
  return toBase64Url(new TextEncoder().encode(json))
}

/** The value comes from a link anyone can craft: null for anything off, never a throw. */
export function decodeShare(param: string, template: readonly ChecklistSection[] = CHECKLIST): SharePayload | null {
  try {
    if (param.length === 0 || param.length > SHARE_MAX) return null
    if (!/^[A-Za-z0-9_-]+$/.test(param)) return null
    const b64 = param.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    const data: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
    const { v, name, platforms, checked } = data as Record<string, unknown>
    if (v !== 1 || typeof name !== 'string') return null
    const validName = validateName(name)
    if (!validName.ok || validName.name !== name || [...name].length > NAME_MAX) return null
    const normalized = normalizePlatforms(platforms)
    if (!normalized) return null
    if (!Array.isArray(checked) || !checked.every((c) => typeof c === 'string')) return null
    const known = new Set(template.flatMap((s) => s.items.map((i) => i.id)))
    return { name, platforms: normalized, checked: [...new Set(checked as string[])].filter((id) => known.has(id)) }
  } catch {
    return null
  }
}

export function shareUrl(release: Shareable, loc: { origin: string; pathname: string }): string {
  return `${loc.origin}${loc.pathname}?menu=release-checklist&share=${encodeShare(release)}`
}
