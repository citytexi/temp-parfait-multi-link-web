import type { Parser } from '../../../lib/localStore'
import { CHECKLIST, PLATFORMS, PLATFORM_LABEL, type ChecklistItem, type ChecklistSection, type ReleasePlatform } from './template'

export const RELEASES_KEY = 'parfait-admin:release-checklist:releases'
export const RELEASES_MAX = 30
export const NAME_MAX = 40
export const LIMIT_MESSAGE = '릴리즈는 30개까지 둘 수 있어요. 지난 릴리즈를 지워 주세요.'

export type Release = {
  id: string
  name: string
  platforms: ReleasePlatform[]
  /** Item id to ISO time. A prototype-less object: read it with Object.hasOwn only. */
  checked: Record<string, string>
  createdAt: string
}

const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/
// Direction marks, overrides, isolates and invisible characters: they reorder or hide the text around a name.
// U+200C and U+200D stay allowed: they join emoji and letters and reorder nothing.
const FORMAT = /[\u061c\u200b\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/
// In unicode mode a surrogate matches only when it is not part of a pair.
const LONE_SURROGATE = /[\ud800-\udfff]/u

export function validateName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim()
  if (name === '') return { ok: false, error: '버전 이름을 넣어 주세요' }
  if (CONTROL.test(raw) || FORMAT.test(raw) || LONE_SURROGATE.test(raw)) return { ok: false, error: '버전 이름에 줄바꿈이나 제어 문자는 쓸 수 없어요' }
  if ([...name].length > NAME_MAX) return { ok: false, error: '버전 이름은 40자까지 쓸 수 있어요' }
  return { ok: true, name }
}

/** PLATFORMS order without duplicates; null when empty or anything is not a platform. */
export function normalizePlatforms(raw: unknown): ReleasePlatform[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  if (!raw.every((p) => PLATFORMS.includes(p as ReleasePlatform))) return null
  return PLATFORMS.filter((p) => raw.includes(p))
}

export function platformsLabel(platforms: readonly ReleasePlatform[]): string {
  return platforms.map((p) => PLATFORM_LABEL[p]).join(', ')
}

export function newRelease(input: {
  id: string
  name: string
  platforms: readonly ReleasePlatform[]
  now: string
  checked?: readonly string[]
}): Release {
  const checked: Record<string, string> = Object.create(null)
  for (const itemId of input.checked ?? []) checked[itemId] = input.now
  return { id: input.id, name: input.name, platforms: [...input.platforms], checked, createdAt: input.now }
}

export function isChecked(release: Pick<Release, 'checked'>, itemId: string): boolean {
  return Object.hasOwn(release.checked, itemId)
}

export function toggleItem(release: Release, itemId: string, now: string): Release {
  const checked: Record<string, string> = Object.create(null)
  for (const key of Object.keys(release.checked)) checked[key] = release.checked[key]
  if (isChecked(release, itemId)) delete checked[itemId]
  else checked[itemId] = now
  return { ...release, checked }
}

export const parseReleases: Parser<Release[]> = (raw) => {
  if (!Array.isArray(raw)) return null
  const out: Release[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (out.length >= RELEASES_MAX) break
    if (typeof entry !== 'object' || entry === null) continue
    const { id, name, platforms, checked, createdAt } = entry as Record<string, unknown>
    if (typeof id !== 'string' || id === '' || seen.has(id)) continue
    if (typeof name !== 'string' || typeof createdAt !== 'string') continue
    const validName = validateName(name)
    if (!validName.ok || validName.name !== name) continue
    const normalized = normalizePlatforms(platforms)
    if (!normalized) continue
    const safe: Record<string, string> = Object.create(null)
    if (typeof checked === 'object' && checked !== null && !Array.isArray(checked)) {
      for (const key of Object.keys(checked)) {
        const time = (checked as Record<string, unknown>)[key]
        if (typeof time === 'string') safe[key] = time
      }
    }
    seen.add(id)
    out.push({ id, name, platforms: normalized, checked: safe, createdAt })
  }
  return out
}

export type VisibleSection = { id: string; title: string; items: readonly ChecklistItem[]; done: number }

export function visibleSections(
  release: Pick<Release, 'platforms' | 'checked'>,
  template: readonly ChecklistSection[] = CHECKLIST,
): VisibleSection[] {
  const sections: VisibleSection[] = []
  for (const section of template) {
    const items = section.items.filter((i) => !i.platforms || i.platforms.some((p) => release.platforms.includes(p)))
    if (items.length === 0) continue
    sections.push({ id: section.id, title: section.title, items, done: items.filter((i) => isChecked(release, i.id)).length })
  }
  return sections
}

export function progress(sections: readonly VisibleSection[]): { done: number; total: number } {
  return sections.reduce((acc, s) => ({ done: acc.done + s.done, total: acc.total + s.items.length }), { done: 0, total: 0 })
}

export function releaseText(
  release: Pick<Release, 'name' | 'platforms' | 'checked'>,
  template: readonly ChecklistSection[] = CHECKLIST,
): string {
  const sections = visibleSections(release, template)
  const { done, total } = progress(sections)
  const lines = [`파르페 ${release.name} 릴리즈 (${platformsLabel(release.platforms)}) ${done} / ${total}`, '']
  for (const s of sections) {
    lines.push(`${s.title} ${s.done}/${s.items.length}`)
    for (const item of s.items) lines.push(`${isChecked(release, item.id) ? '✅' : '⬜'} ${item.label}`)
  }
  return lines.join('\n')
}
