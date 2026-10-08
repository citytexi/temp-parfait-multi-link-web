import type { Parser } from '../../../lib/localStore'

export const PERSONAL_KEY = 'parfait-admin:link-hub:personal'
export const PERSONAL_MAX = 50
export const LABEL_MAX = 40

export type PersonalLink = { id: string; label: string; url: string }
export type PersonalErrors = { label?: string; url?: string }

const URL_ERROR = 'https://로 시작하는 주소만 넣을 수 있어요'

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

/** The parsed address when it is an https URL, otherwise null. Control characters (which URL parsing silently strips) are refused. */
function parseHttps(text: string): string | null {
  if (CONTROL_CHARS.test(text)) return null
  try {
    const url = new URL(text)
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

export function validatePersonal(input: {
  label: string
  url: string
}): { ok: true; label: string; url: string } | { ok: false; errors: PersonalErrors } {
  const label = input.label.trim()
  const rawUrl = input.url.trim()
  const errors: PersonalErrors = {}
  if (label === '') errors.label = '이름을 넣어 주세요'
  else if ([...label].length > LABEL_MAX) errors.label = `이름은 ${LABEL_MAX}자까지 쓸 수 있어요`
  let url = ''
  if (rawUrl === '') errors.url = '주소를 넣어 주세요'
  else {
    const parsed = parseHttps(rawUrl)
    if (parsed === null) errors.url = URL_ERROR
    else url = parsed
  }
  if (errors.label !== undefined || errors.url !== undefined) return { ok: false, errors }
  return { ok: true, label, url }
}

/** Stored links are untrusted: each one is validated again and only the valid ones stay. */
export const parsePersonal: Parser<PersonalLink[]> = (raw) => {
  if (!Array.isArray(raw)) return null
  const seen = new Set<string>()
  const links: PersonalLink[] = []
  for (const item of raw as unknown[]) {
    if (links.length >= PERSONAL_MAX) break
    if (typeof item !== 'object' || item === null) continue
    const { id, label, url } = item as { id?: unknown; label?: unknown; url?: unknown }
    if (typeof id !== 'string' || id === '' || seen.has(id)) continue
    if (typeof label !== 'string' || typeof url !== 'string') continue
    const checked = validatePersonal({ label, url })
    if (!checked.ok) continue
    seen.add(id)
    links.push({ id, label: checked.label, url: checked.url })
  }
  return links
}

export function matchesQuery(link: { label: string; url: string; description?: string }, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (needle === '') return true
  return [link.label, link.description ?? '', link.url].some((text) => text.toLowerCase().includes(needle))
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}
