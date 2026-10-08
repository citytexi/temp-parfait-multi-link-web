import { expect, it, vi } from 'vitest'
import html from '../../index.html?raw'
import { UA_PRESETS } from '../admin/pages/devtools/ua-tester/config'
import { BASE, CAMPAIGN_CASES } from './__fixtures__/campaignUrls'
import { detectPlatform, landingView, playIntentUrl } from './ua'

const ANDROID = UA_PRESETS.find((p) => p.id === 'android-chrome')!.ua
const MIXED: [string, string][] = [
  ['android and iphone tokens', `${ANDROID} like iPhone`],
  ['android and kakaotalk', `${ANDROID} KAKAOTALK/10.0.0`],
  ['android and line', `${ANDROID} Line/13.0.0`],
  ['lower-case android', 'mozilla/5.0 (linux; android 14) chrome/124.0 mobile'],
  ['lower-case iphone with android', 'mozilla/5.0 (linux; android 14) like iphone'],
]
const UAS: [string, string][] = [...UA_PRESETS.map((p): [string, string] => [p.id, p.ua]), ...MIXED]

function inlineBody(): string {
  const found = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  expect(found).toHaveLength(1)
  return found[0][1]
}

function run(nav: object, loc: { replace: ReturnType<typeof vi.fn>; href?: string }): string | null {
  new Function('navigator', 'location', inlineBody())(nav, loc)
  expect(loc.replace.mock.calls.length).toBeLessThanOrEqual(1)
  return (loc.replace.mock.calls[0]?.[0] as string | undefined) ?? null
}

const at = (ua: string, href: string) => run({ userAgent: ua }, { href, replace: vi.fn() })

it.each(UAS)('redirects like landingView for %s', (_id, ua) => {
  for (const [name, pageUrl] of CAMPAIGN_CASES) {
    expect(at(ua, pageUrl), name).toBe(landingView(detectPlatform(ua, 0), pageUrl).autoRedirect)
  }
})

it('really carries the referrer (the comparison above is not vacuous)', () => {
  const [, pageUrl, referrer] = CAMPAIGN_CASES.find(([name]) => name === 'all six keys')!
  expect(at(ANDROID, pageUrl)).toBe(playIntentUrl(referrer))
  expect(at(ANDROID, pageUrl)).toContain('referrer=utm_source%3Dinstagram')
})

it('falls back to the plain intent when reading the address throws', () => {
  const loc = {
    replace: vi.fn(),
    get href(): string {
      throw new Error('blocked')
    },
  }
  expect(run({ userAgent: ANDROID }, loc)).toBe(playIntentUrl())
})

it('does nothing and does not throw without a user agent', () => {
  expect(run({}, { href: BASE, replace: vi.fn() })).toBeNull()
})

it('is written in ES5', () => {
  // Comments are not checked.
  const code = inlineBody()
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  expect(code).not.toMatch(/=>|\bconst\b|\blet\b|`|URLSearchParams|new URL\b/)
})
