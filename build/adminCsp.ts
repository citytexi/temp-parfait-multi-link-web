import fs from 'node:fs'
import path from 'node:path'

export type CspFragment = { file: string; directives: Record<string, string[]> }

/** Directives a page fragment may extend. Everything else (script-src, default-src, ...) is fixed here. */
export const FRAGMENT_DIRECTIVES: readonly string[] = ['connect-src', 'img-src', 'frame-src']

// Admin CSP (spec §3). GitHub Pages cannot set headers, so it ships as a <meta>.
const BASE_DIRECTIVES: Record<string, string> = {
  'default-src': "'self'",
  // GIS token client library.
  'script-src': "'self' https://accounts.google.com/gsi/client",
  // React inline style attributes; GIS button styles; Pretendard stylesheet.
  'style-src': "'self' 'unsafe-inline' https://accounts.google.com/gsi/style https://cdn.jsdelivr.net",
  // Pretendard font files.
  'font-src': 'https://cdn.jsdelivr.net',
  // Google account avatars shown by GIS.
  'img-src': "'self' data: https://*.googleusercontent.com",
  // 'self': Vite's modulepreload polyfill fetches same-origin chunks.
  // GA Data API; GIS endpoints (Google's documented requirement); token revoke on logout.
  'connect-src': "'self' https://analyticsdata.googleapis.com https://accounts.google.com/gsi/ https://oauth2.googleapis.com",
  // GIS iframes (Google's documented requirement, narrower than the spec's accounts.google.com).
  'frame-src': 'https://accounts.google.com/gsi/',
  // Hardening: no <base> hijack, no form posts, no plugins.
  'base-uri': "'self'",
  'form-action': "'none'",
  'object-src': "'none'",
}

// Strict allowlist: https scheme, dotted hostname, optional port. No path, userinfo, query, wildcard,
// or any character (&, <, quotes, whitespace, ;, ...) that could be decoded or parsed into another source or directive.
const SOURCE_PATTERN = /^https:\/\/[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(:\d{1,5})?$/

/** Escape a value for use inside a double-quoted HTML attribute. */
export function escapeHtmlAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function validate(fragment: CspFragment): void {
  const { file, directives } = fragment
  if (typeof directives !== 'object' || directives === null || Array.isArray(directives)) {
    throw new Error(`${file}: CSP fragment must be a JSON object`)
  }
  for (const [name, sources] of Object.entries(directives)) {
    if (!FRAGMENT_DIRECTIVES.includes(name)) {
      throw new Error(`${file}: directive "${name}" is not allowed (allowed: ${FRAGMENT_DIRECTIVES.join(', ')})`)
    }
    if (!Array.isArray(sources) || !sources.every((s) => typeof s === 'string')) {
      throw new Error(`${file}: "${name}" must be an array of strings`)
    }
    for (const source of sources) {
      if (!SOURCE_PATTERN.test(source)) {
        throw new Error(`${file}: invalid source ${JSON.stringify(source)} in "${name}"`)
      }
    }
  }
}

export function buildAdminCsp(fragments: readonly CspFragment[]): string {
  fragments.forEach(validate)
  const merged: Record<string, string[]> = {}
  for (const [name, value] of Object.entries(BASE_DIRECTIVES)) merged[name] = value.split(' ')
  for (const { directives } of fragments) {
    for (const [name, sources] of Object.entries(directives)) {
      for (const source of sources) {
        if (!merged[name].includes(source)) merged[name].push(source)
      }
    }
  }
  return Object.entries(merged)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ')
}

export function readCspFragments(pagesDir: string): CspFragment[] {
  if (!fs.existsSync(pagesDir)) return []
  return fs
    .readdirSync(pagesDir, { recursive: true, encoding: 'utf8' })
    .map((rel) => rel.replaceAll('\\', '/'))
    .filter((rel) => rel.endsWith('.csp.json'))
    .sort()
    .map((rel) => {
      const file = path.join(pagesDir, rel)
      let directives: unknown
      try {
        directives = JSON.parse(fs.readFileSync(file, 'utf8'))
      } catch (error) {
        throw new Error(`${file}: cannot read CSP fragment (${error instanceof Error ? error.message : String(error)})`)
      }
      return { file, directives: directives as Record<string, string[]> }
    })
}
